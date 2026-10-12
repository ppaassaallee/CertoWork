/** Soft-removed work items stay restorable and stay out of normal lists. */

export const REMOVED_WORK_STATUSES = ["archived", "deleted"] as const;
export const UNDO_WINDOW_MS = 10_000;
export const SOFT_DELETE_MS = 30 * 24 * 60 * 60 * 1000;

function removalRecord(item: unknown) {
  if (!item || typeof item !== "object") return { status: "", deletedAt: undefined as unknown };
  const record = item as { status?: unknown; deletedAt?: unknown };
  return { status: String(record.status || "").toLowerCase(), deletedAt: record.deletedAt };
}

export function isRemovedWorkItem(item: unknown) {
  const record = removalRecord(item);
  return REMOVED_WORK_STATUSES.includes(record.status as (typeof REMOVED_WORK_STATUSES)[number]) || Boolean(record.deletedAt);
}

/**
 * Removed items match only an explicit archived/deleted filter.
 * Every other status filter, including Done and Backlog, hides them.
 */
export function removedItemMatchesStatus(item: unknown, statusFilter: string) {
  if (!isRemovedWorkItem(item)) return true;
  return statusFilter === removalRecord(item).status;
}

export function softDeletePatch(previousStatus: unknown, now = Date.now()) {
  const status = String(previousStatus || "backlog").toLowerCase();
  const previous = status === "archived" || status === "deleted" ? "backlog" : status || "backlog";
  return {
    status: "deleted",
    previousStatus: previous,
    deletedAt: new Date(now).toISOString(),
    purgeAfter: new Date(now + SOFT_DELETE_MS).toISOString(),
    archivedAt: null,
  };
}

export function restoreItemPatch(previousStatus: unknown) {
  const status = String(previousStatus || "backlog").toLowerCase();
  const next = status === "archived" || status === "deleted" ? "backlog" : status || "backlog";
  return {
    status: next,
    deletedAt: null,
    purgeAfter: null,
    archivedAt: null,
  };
}

let deleteArmedUntil = 0;

/** A second click in the same spot must not delete the row that slid up. */
export function consumeDeleteGesture(now = Date.now()) {
  if (now < deleteArmedUntil) return false;
  deleteArmedUntil = now + 500;
  return true;
}

export function resetDeleteGestureForTests() {
  deleteArmedUntil = 0;
}
