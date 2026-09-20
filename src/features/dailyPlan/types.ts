import type { Timestamp } from "firebase/firestore";

/**
 * Personal daily triage buckets (Fires / Growth / Extras).
 * Separate from team item priority and from legacy `day_plans` key/focus docs.
 */
export type PlanBucket = "fire" | "growth" | "extra";

export interface DayPlanEntry {
  itemId: string;
  bucket: PlanBucket;
  order: number;
  doneToday: boolean;
  doneAt?: Timestamp | null;
  addedAt: Timestamp;
}

export interface DayPlan {
  id: string;
  uid: string;
  date: string;
  entries: DayPlanEntry[];
  /** Reserved Phase 2 — do not drive UI from this in Phase 1. */
  plannedAt?: Timestamp | null;
  closedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Item shape used when joining plan entries (Task from workspace pool). */
export type PlanItem = {
  id: string;
  title?: string;
  status?: string;
  workItemType?: string;
  type?: string;
  itemType?: string;
  dueDate?: string | null;
  targetDate?: string | null;
  projectId?: string | null;
  priority?: string | number | null;
  [key: string]: unknown;
};

export const DAY_PLANS_BUCKETS_COLLECTION = "dayPlans";

export const DONE_STATUSES = new Set([
  "done",
  "completed",
  "closed",
  "cancelled",
  "archived",
  "deleted",
]);

export function isItemDoneStatus(status: unknown): boolean {
  return DONE_STATUSES.has(String(status || "").toLowerCase());
}
