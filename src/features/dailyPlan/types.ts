import type { Timestamp } from "firebase/firestore";

/**
 * Personal daily triage buckets (Fires / Growth / Extras).
 * Separate from team item priority and from legacy `day_plans` key/focus docs.
 */
export type PlanBucket = "fire" | "growth" | "extra";

export interface TimeBlock {
  start: Timestamp;
  end: Timestamp;
  calendarEventId?: string | null;
  accountId?: string | null;
}

export interface DayPlanEntry {
  itemId: string;
  bucket: PlanBucket;
  order: number;
  doneToday: boolean;
  doneAt?: Timestamp | null;
  addedAt: Timestamp;
  timeBlock?: TimeBlock | null;
}

export interface EventTag {
  eventKey: string;
  bucket: PlanBucket;
  itemId?: string | null;
}

export interface PlanProposal {
  createdAt: Timestamp;
  source: "llm" | "heuristic";
  entries: Array<{ itemId: string; bucket: PlanBucket; reason: string }>;
  keyItemId?: string | null;
  summary: string;
}

export interface DayPlan {
  id: string;
  uid: string;
  date: string;
  entries: DayPlanEntry[];
  /** Key task lives on legacy day_plans when existingKeyTask is present. */
  keyItemId?: string | null;
  eventTags?: EventTag[];
  plannedAt?: Timestamp | null;
  closedAt?: Timestamp | null;
  autoClosed?: boolean;
  closingNote?: string | null;
  focusScore?: number | null;
  pendingProposal?: PlanProposal | null;
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
