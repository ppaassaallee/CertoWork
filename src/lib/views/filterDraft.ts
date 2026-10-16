import type { FilterRule, SavedView } from "./types";
import { canonicalWorkStatus } from "../workStatuses";

/** Saved legacy filters must match the same status catalog as task rows. */
export function normalizeTaskView(view: SavedView): SavedView {
  return { ...view, filters: view.filters.map((rule) => rule.columnId === "status" && typeof rule.value === "string"
    ? { ...rule, value: canonicalWorkStatus({ status: rule.value }) }
    : rule) };
}

export const valueFreeFilterOps: FilterRule["op"][] = ["empty", "notEmpty", "me", "overdue", "today", "week"];

export function applyPendingFilter(view: SavedView, columnId: string, op: FilterRule["op"], value: string): SavedView {
  if (!columnId || (!valueFreeFilterOps.includes(op) && !value.trim())) return view;
  const rule: FilterRule = { columnId, op, ...(!valueFreeFilterOps.includes(op) ? { value: value.trim() } : {}) };
  if (view.filters.some((current) => current.columnId === columnId && current.op === op && current.value === rule.value)) return view;
  return { ...view, filters: [...view.filters, rule] };
}
