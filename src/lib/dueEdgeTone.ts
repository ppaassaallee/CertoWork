import { dateKey, isClosed, localDateKey } from "./workspaceDisplay";

/** Soft neon edge under My Work rows — weeks overdue → tone. */
export type DueEdgeTone = "ontrack" | "week1" | "week2to3" | "week4plus" | null;

/**
 * Days past due (positive = overdue). Null when no usable due date.
 */
export function daysPastDue(
  item: { dueDate?: unknown; targetDate?: unknown; status?: unknown } | null | undefined,
  now = new Date(),
): number | null {
  if (!item) return null;
  const due = dateKey(item.dueDate || item.targetDate);
  if (!due) return null;
  const today = localDateKey(now);
  const dueTime = new Date(`${due}T12:00:00`).getTime();
  const todayTime = new Date(`${today}T12:00:00`).getTime();
  if (!Number.isFinite(dueTime) || !Number.isFinite(todayTime)) return null;
  return Math.floor((todayTime - dueTime) / 86_400_000);
}

/**
 * My Work bottom-edge tone:
 * - ontrack: due today or future (not overdue)
 * - week1: overdue 1–7 days
 * - week2to3: overdue 8–21 days
 * - week4plus: overdue 22+ days
 * - null: done/closed or no due date
 */
export function dueEdgeTone(
  item: { dueDate?: unknown; targetDate?: unknown; status?: unknown } | null | undefined,
  now = new Date(),
): DueEdgeTone {
  if (!item || isClosed(String(item.status || ""))) return null;
  const past = daysPastDue(item, now);
  if (past == null) return null;
  if (past <= 0) return "ontrack";
  if (past <= 7) return "week1";
  if (past <= 21) return "week2to3";
  return "week4plus";
}

export function dueEdgeClassName(
  item: { dueDate?: unknown; targetDate?: unknown; status?: unknown } | null | undefined,
  now = new Date(),
): string {
  const tone = dueEdgeTone(item, now);
  return tone ? `is-due-edge is-due-edge-${tone}` : "";
}
