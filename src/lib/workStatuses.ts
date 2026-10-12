/** Single catalog for item status. Filters, board, table, Gantt, and calendar use these eight. */

export const WORK_STATUSES = [
  { key: "backlog", label: "Backlog", completed: false },
  { key: "ready", label: "Ready", completed: false },
  { key: "todo", label: "To do", completed: false },
  { key: "in_progress", label: "Doing", completed: false },
  { key: "in_review", label: "In review", completed: false },
  { key: "blocked", label: "Blocked", completed: false },
  { key: "done", label: "Done", completed: true },
  { key: "cancelled", label: "Cancelled", completed: true },
] as const;

export type WorkStatusKey = (typeof WORK_STATUSES)[number]["key"];

export const WORK_STATUS_KEYS: WorkStatusKey[] = WORK_STATUSES.map((status) => status.key);

const COMPLETED_ALIASES = new Set(["done", "completed", "closed", "cancelled", "canceled"]);
const REMOVED_STATUSES = new Set(["archived", "deleted"]);

export function isCompletedWorkStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (COMPLETED_ALIASES.has(value)) return true;
  return WORK_STATUSES.some((entry) => entry.key === value && entry.completed);
}

export function isRemovedWorkStatus(status?: string | null) {
  return REMOVED_STATUSES.has(String(status || "").toLowerCase());
}

export function workStatusLabel(status?: string | null) {
  const value = String(status || "").toLowerCase();
  return WORK_STATUSES.find((entry) => entry.key === value)?.label || value.replace(/_/g, " ");
}

export function canonicalWorkStatus(item?: { status?: string | null } | null): string {
  const status = String(item?.status || "").toLowerCase();
  if ((WORK_STATUS_KEYS as readonly string[]).includes(status)) return status;
  if (status === "completed" || status === "closed") return "done";
  if (status === "canceled") return "cancelled";
  if (status === "blocked" || status === "waiting") return "blocked";
  if (status === "in_review") return "in_review";
  if (status === "in_progress" || status === "active" || status === "doing") return "in_progress";
  if (status === "ready") return "ready";
  if (status === "todo" || status === "to_do" || status === "to do") return "todo";
  if (isRemovedWorkStatus(status)) return status;
  return "backlog";
}

/**
 * Status filters compose with the completed toggle.
 * "all" shows every live status. "open" hides Done and Cancelled until the toggle is on.
 * Choosing Done or Cancelled directly still shows those items.
 * Archived and deleted stay out unless the filter names them.
 */
export function passesStatusView(
  item: { status?: string | null } | null | undefined,
  statusFilter: string,
  showCompleted = false,
) {
  const filter = String(statusFilter || "all").toLowerCase();
  const status = canonicalWorkStatus(item);
  if (filter === "all") return true;
  if (isRemovedWorkStatus(status)) return filter === status;
  const completed = isCompletedWorkStatus(status);
  if (filter === "open") return showCompleted || !completed;
  if (completed && !showCompleted && filter !== status) return false;
  return status === filter;
}
