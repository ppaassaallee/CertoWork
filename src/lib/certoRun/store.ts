import { isDecision, isRunWorld, type Decision, type Lane, type Priority } from "./vocab";
import type { DeskItem, Outcome } from "./types";

/** Certo Run records. Never the Certo Work `tasks` collection. */
export const RUN_COLLECTION = "run_items";

function priorityOf(value: unknown): Priority {
  if (value === "P1" || value === 1 || value === "1") return "P1";
  if (value === "P2" || value === 2 || value === "2") return "P2";
  if (value === "P4" || value === 4 || value === "4") return "P4";
  return "P3";
}

function laneOf(value: unknown): Lane {
  if (value === "admin" || value === "commercial" || value === "projects" || value === "personal") return value;
  return "projects";
}

export function runDocToDeskItem(
  id: string,
  data: Record<string, unknown>,
  workspace: { id: string; name: string },
): DeskItem {
  const status = String(data.status || "open");
  const decision = typeof data.decision === "string" && isDecision(data.decision) ? data.decision : "make";
  return {
    id,
    externalId: id,
    workspaceId: String(data.workspaceId || workspace.id),
    world: typeof data.world === "string" && isRunWorld(data.world) ? data.world : "",
    type: "pbi",
    lane: decision === "admin_batch" ? "admin" : laneOf(data.lane),
    decision,
    priority: priorityOf(data.priority),
    title: String(data.title || "Untitled"),
    context: String(data.description || ""),
    deliverable: "",
    doneWhen: "",
    epic: String(data.epic || ""),
    feature: "",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    assigneeName: String(data.assigneeName || ""),
    dueDate: typeof data.dueDate === "string" ? data.dueDate : "",
    queueOrder: null,
    state: status === "archived" ? "archived" : status === "done" ? "done" : "open",
    outcome: data.outcome && typeof data.outcome === "object" ? (data.outcome as Outcome) : undefined,
    inQueue: data.inQueue !== false,
    runTop3Date: typeof data.runTop3Date === "string" ? data.runTop3Date : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
  };
}

export function isRunDecision(value: string): value is Decision {
  return isDecision(value);
}
