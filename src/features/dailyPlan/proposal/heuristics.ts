import type { PlanBucket, PlanProposal } from "../types";
import type { Candidate } from "./candidates";
import { Timestamp } from "firebase/firestore";

const DEFAULT_LIMITS = { fire: 3, growth: 3, extra: 5 };

function reasonFor(c: Candidate, bucket: PlanBucket): string {
  const s = c.signals;
  if (bucket === "fire") {
    if (s.overdue) return `Overdue by ${Math.max(1, s.leftoverDays || 1)} days`;
    if (s.dueToday) return "Due today";
    if (s.semaforoRed) return "Red status";
    if (s.isLeftover) return `Left from prior plan`;
  }
  if (bucket === "growth") {
    if (s.projectMilestoneSoon) return "Milestone this week";
    if (s.dueThisWeek) return "Due this week";
    if (s.semaforoYellow) return "At risk / attention";
  }
  if (!c.item.dueDate && !c.item.targetDate) return "No due date — follow-up";
  return "Helpful follow-up";
}

export function heuristicProposal(
  candidates: Candidate[],
  limits = DEFAULT_LIMITS,
): Omit<PlanProposal, "createdAt"> & { createdAt?: Timestamp } {
  const fire = candidates
    .filter(
      (c) =>
        c.signals.overdue ||
        c.signals.dueToday ||
        c.signals.semaforoRed ||
        c.signals.leftoverDays >= 2,
    )
    .sort((a, b) => b.signals.leftoverDays - a.signals.leftoverDays)
    .slice(0, limits.fire);

  const used = new Set(fire.map((c) => c.item.id));
  const growth = candidates
    .filter((c) => !used.has(c.item.id))
    .filter(
      (c) =>
        /pbi|epic|feature|story/.test(c.signals.type) &&
        (c.signals.dueThisWeek || c.signals.projectMilestoneSoon || c.signals.semaforoYellow),
    )
    .slice(0, limits.growth);
  growth.forEach((c) => used.add(c.item.id));

  const extra = candidates
    .filter((c) => !used.has(c.item.id))
    .filter((c) => /task|bug|subtask|ticket|issue/.test(c.signals.type) || !c.signals.type)
    .slice(0, limits.extra);

  const entries = [
    ...fire.map((c) => ({ itemId: c.item.id, bucket: "fire" as PlanBucket, reason: reasonFor(c, "fire") })),
    ...growth.map((c) => ({
      itemId: c.item.id,
      bucket: "growth" as PlanBucket,
      reason: reasonFor(c, "growth"),
    })),
    ...extra.map((c) => ({
      itemId: c.item.id,
      bucket: "extra" as PlanBucket,
      reason: reasonFor(c, "extra"),
    })),
  ];

  const keyItemId = growth[0]?.item.id || fire[0]?.item.id || null;
  return {
    createdAt: Timestamp.now(),
    source: "heuristic",
    entries,
    keyItemId,
    summary: `Proposed ${entries.length} items · ${fire.length} fires · ${growth.length} growth · ${extra.length} extras`,
  };
}

/** LLM path: not wired (no shared llmCall) — always heuristic. */
export async function llmProposal(
  candidates: Candidate[],
  _events: unknown,
  heuristic: ReturnType<typeof heuristicProposal>,
): Promise<PlanProposal> {
  void candidates;
  void _events;
  return {
    ...heuristic,
    createdAt: Timestamp.now(),
    source: "heuristic",
  };
}
