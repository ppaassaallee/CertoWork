/** Undo stays available for 10 seconds. The record itself can be restored for 30 days. */
export const UNDO_WINDOW_MS = 10_000;
export const SOFT_DELETE_MS = 30 * 24 * 60 * 60 * 1000;

export function purgeDeadline(from = new Date()) {
  return new Date(from.getTime() + SOFT_DELETE_MS).toISOString();
}

export function archivePatch(previousStatus: string, now = new Date()) {
  return {
    status: "archived" as const,
    previousStatus: previousStatus || "active",
    archivedAt: now.toISOString(),
    deletedAt: null,
    purgeAfter: null,
  };
}

export function softDeletePatch(previousStatus: string, now = new Date()) {
  const deletedAt = now.toISOString();
  return {
    status: "deleted" as const,
    previousStatus: previousStatus || "active",
    deletedAt,
    purgeAfter: purgeDeadline(now),
    archivedAt: null,
  };
}

export function restorePatch(previousStatus: string, now = new Date()) {
  const status =
    previousStatus && previousStatus !== "archived" && previousStatus !== "deleted"
      ? previousStatus
      : "active";
  return {
    status,
    previousStatus: null,
    archivedAt: null,
    deletedAt: null,
    purgeAfter: null,
    restoredAt: now.toISOString(),
  };
}
