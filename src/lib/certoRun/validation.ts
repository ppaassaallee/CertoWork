import { checkTitle } from "./intake";
import { RUN_WORLDS, isDecision } from "./vocab";

export type IntakeReport = { ok: boolean; errors: string[]; warnings: string[]; counts: Record<string, number> };
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const dateValid = (value: unknown) => {
  if (value === "" || value === undefined) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** Pure preflight only. Never imports records or mutates either source document. */
export function validateRunIngest(input: unknown): IntakeReport {
  const errors: string[] = [], warnings: string[] = [];
  const counts: Record<string, number> = {};
  if (!object(input)) return { ok: false, errors: ["Expected a JSON object."], warnings, counts };
  if (input.format !== "certo-run-ingest/1") errors.push('format must be "certo-run-ingest/1".');
  if (input.mode !== undefined && input.mode !== "merge" && input.mode !== "replace") errors.push("mode must be merge or replace.");
  const rows = (key: string) => {
    if (input[key] === undefined) return [];
    if (!Array.isArray(input[key])) { errors.push(`${key} must be an array.`); return []; }
    counts[key] = input[key].length;
    return input[key] as unknown[];
  };
  const epics = new Map<string, string>();
  const epicWorld = (epic: unknown, world: unknown, at: string) => {
    if (typeof epic !== "string" || !epic.trim()) { errors.push(`${at}: epic is required.`); return; }
    if (typeof world !== "string") return;
    const previous = epics.get(epic);
    if (previous && previous !== world) errors.push(`${at}: epic "${epic}" belongs to both ${previous} and ${world}.`);
    else epics.set(epic, world);
  };
  const ids = new Set<string>();
  for (const [i, row] of rows("items").entries()) {
    const at = `items[${i}]`;
    if (!object(row)) { errors.push(`${at}: expected an object.`); continue; }
    if (typeof row.external_id !== "string" || !row.external_id.trim()) errors.push(`${at}: external_id is required.`);
    else if (ids.has(row.external_id)) errors.push(`${at}: duplicate external_id ${row.external_id}.`);
    else ids.add(row.external_id);
    if (!RUN_WORLDS.includes(row.world as typeof RUN_WORLDS[number])) errors.push(`${at}: invalid world.`);
    if (typeof row.title !== "string" || !checkTitle(row.title).ok) errors.push(`${at}: title must have 1–12 words and no dates, stars or prefixes.`);
    if (!["commercial", "projects", "admin", "personal"].includes(String(row.lane))) errors.push(`${at}: invalid lane.`);
    if (!isDecision(String(row.decision))) errors.push(`${at}: invalid decision.`);
    if (row.lane === "admin" && row.decision === "make") errors.push(`${at}: admin is never Make.`);
    if ((row.world === "Personal") !== (row.lane === "personal")) errors.push(`${at}: personal lane and world must match.`);
    if (row.priority !== undefined && !["P1", "P2", "P3", "P4"].includes(String(row.priority))) errors.push(`${at}: invalid priority.`);
    if (!dateValid(row.due_date)) errors.push(`${at}: invalid due_date.`);
    epicWorld(row.epic, row.world, at);
    for (const field of ["context", "deliverable", "done_when", "next_step", "source"]) if (!row[field]) warnings.push(`${at}: ${field} is empty.`);
    if (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== "string"))) errors.push(`${at}: tags must be strings.`);
    if ((!row.owner || !row.due_date) && !(Array.isArray(row.tags) && row.tags.includes("needs-info"))) warnings.push(`${at}: missing owner/date; add needs-info.`);
  }
  for (const [i, row] of rows("projects").entries()) {
    if (!object(row)) { errors.push(`projects[${i}]: expected an object.`); continue; }
    epicWorld(row.epic, row.world, `projects[${i}]`);
    if (!RUN_WORLDS.includes(row.world as typeof RUN_WORLDS[number])) errors.push(`projects[${i}]: invalid world.`);
    if (row.pipeline_stage !== undefined && !["Discovery", "Proposal and pricing", "Negotiation and contract", "Closing and kickoff"].includes(String(row.pipeline_stage))) errors.push(`projects[${i}]: invalid pipeline_stage.`);
    if (row.health !== undefined && !["green", "amber", "red"].includes(String(row.health))) errors.push(`projects[${i}]: invalid health.`);
  }
  for (const [i, row] of rows("people").entries()) {
    if (!object(row) || typeof row.name !== "string" || !row.name.trim() || !["Pure AI", "Boldr AI"].includes(String(row.world))) errors.push(`people[${i}]: name and a work world are required.`);
  }
  const loads = new Map<string, number>();
  for (const [i, row] of rows("allocations").entries()) {
    if (!object(row)) { errors.push(`allocations[${i}]: expected an object.`); continue; }
    if (!row.week || !dateValid(row.week) || new Date(`${row.week}T00:00:00Z`).getUTCDay() !== 1) errors.push(`allocations[${i}]: week must be a valid Monday.`);
    if (typeof row.pct !== "number" || !Number.isFinite(row.pct) || row.pct <= 0 || row.pct > 100) { errors.push(`allocations[${i}]: pct must be 1–100.`); continue; }
    const key = `${row.person}|${row.week}`;
    loads.set(key, (loads.get(key) || 0) + row.pct);
  }
  for (const [key, load] of loads) if (load > 100) errors.push(`${key}: allocation ${load}% exceeds 100%.`);
  return { ok: errors.length === 0, errors, warnings, counts };
}
