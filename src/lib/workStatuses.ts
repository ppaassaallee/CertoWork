/** Single catalog for item status. Filters, board, table, Gantt, and calendar use these eight. */
import { getLocale } from "./i18n";
import { localize } from "./localize";

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
const BACKLOG_ALIASES = new Set(["open", "new", "planned", "not_started", "to_do", "to do"]);
const unknownStatusSeen = new Set<string>();

/** Known legacy words stay mapped. Anything else is logged once and left as stored. */
export function noteUnknownWorkStatus(status: string) {
  const value = String(status || "").toLowerCase();
  if (!value || unknownStatusSeen.has(value)) return;
  unknownStatusSeen.add(value);
  console.warn(`[work-status] unknown status "${value}" was not remapped to Backlog`);
}

export function resetUnknownWorkStatusLogForTests() {
  unknownStatusSeen.clear();
}

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
  const spanish: Record<string, string> = {
      backlog: "Pendiente", ready: "Listo", todo: "Por hacer", in_progress: "En curso",
      in_review: "En revisión", blocked: "Bloqueado", done: "Terminado", cancelled: "Cancelado",
  };
  const english = WORK_STATUSES.find((entry) => entry.key === value)?.label || value.replace(/_/g, " ");
  return localize(getLocale(), english, spanish[value] || english);
}

export function canonicalWorkStatus(item?: { status?: string | null; deletedAt?: unknown } | null): string {
  if (item && typeof item === "object" && item.deletedAt) {
    const removed = String(item.status || "").toLowerCase();
    return isRemovedWorkStatus(removed) ? removed : "deleted";
  }
  const status = String(item?.status || "").toLowerCase();
  if (!status) return "backlog";
  if ((WORK_STATUS_KEYS as readonly string[]).includes(status)) return status;
  if (status === "completed" || status === "closed") return "done";
  if (status === "canceled") return "cancelled";
  if (status === "blocked" || status === "waiting") return "blocked";
  if (status === "in_review" || status === "review") return "in_review";
  if (status === "in_progress" || status === "active" || status === "doing") return "in_progress";
  if (status === "ready") return "ready";
  if (status === "todo" || status === "to_do" || status === "to do") return "todo";
  if (BACKLOG_ALIASES.has(status)) return "backlog";
  if (isRemovedWorkStatus(status)) return status;
  noteUnknownWorkStatus(status);
  return status;
}

/**
 * Status filters compose with the completed toggle.
 * "all" shows every open live status until the completed toggle is on.
 * "open" has the same completed behavior while still excluding removed work.
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
  if (isRemovedWorkStatus(status)) return filter === status;
  const completed = isCompletedWorkStatus(status);
  if (filter === "all") return showCompleted || !completed;
  if (filter === "open") return showCompleted || !completed;
  if (completed && !showCompleted && filter !== status) return false;
  return status === filter;
}
