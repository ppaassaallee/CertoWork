/**
 * Pure matching for table.* event triggers.
 * Shared by tests and documented for the worker scheduler (mirrors logic in worker/routinesScheduler.js).
 */

export type TableEventFilter = {
  tableId?: string;
  columnId?: string;
  to?: string;
  offsetDays?: number;
};

export type TableEventMeta = {
  tableId?: string;
  columnId?: string;
  to?: string | null;
  offsetDays?: number;
  [key: string]: unknown;
};

/**
 * Returns true when an event-triggered table routine should fire for this event.
 * - When filter.tableId is set, event.meta.tableId must match.
 * - When filter.to is set, event.meta.to must match.
 * - When filter.columnId is set, event.meta.columnId must match.
 * - When filter.offsetDays is set, event.meta.offsetDays must match.
 */
export function matchesTableEventFilter(
  filter: TableEventFilter | Record<string, unknown> | null | undefined,
  meta: TableEventMeta | Record<string, unknown> | null | undefined,
): boolean {
  if (!filter || typeof filter !== "object") return true;
  const f = filter as TableEventFilter;
  const m = (meta || {}) as TableEventMeta;

  if (f.tableId != null && String(f.tableId) !== "") {
    if (m.tableId == null || String(m.tableId) !== String(f.tableId)) return false;
  }
  if (f.to != null && String(f.to) !== "") {
    if (m.to == null || String(m.to) !== String(f.to)) return false;
  }
  if (f.columnId != null && String(f.columnId) !== "") {
    if (m.columnId == null || String(m.columnId) !== String(f.columnId)) return false;
  }
  if (f.offsetDays != null && Number.isFinite(Number(f.offsetDays))) {
    if (m.offsetDays == null || Number(m.offsetDays) !== Number(f.offsetDays)) return false;
  }
  return true;
}
