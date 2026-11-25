import type { FilterRule } from "./views/types";

type LifecycleRow = { status?: unknown; deletedAt?: unknown; [key: string]: unknown };
export function projectLifecycleStatus(row: LifecycleRow): string {
  // A tombstone remains authoritative until Restore explicitly clears it.
  return row.deletedAt
    ? "deleted"
    : String(row.status || "planning")
        .trim()
        .toLowerCase();
}
export function viewRequestsDeletedProjects(filters: FilterRule[]): boolean {
  return filters.some(
    (rule) =>
      rule.columnId === "status" &&
      ((rule.op === "eq" && String(rule.value).trim().toLowerCase() === "deleted") ||
        (rule.op === "in" &&
          Array.isArray(rule.value) &&
          rule.value.some((value) => String(value).trim().toLowerCase() === "deleted"))),
  );
}
export function matchesPortfolioLifecycle(
  row: LifecycleRow,
  filter: string,
  statusFilters: string[],
  savedViewRequestsDeleted = false,
): boolean {
  const status = projectLifecycleStatus(row);
  if (statusFilters.length)
    return statusFilters.some((value) =>
      value === "active" ? ["active", "in_progress"].includes(status) : status === value,
    );
  if (status === "deleted")
    return filter === "deleted" || (savedViewRequestsDeleted && ["all", "active"].includes(filter));
  if (filter === "all") return true;
  if (filter === "active")
    return !["completed", "archived", "done", "closed", "cancelled", "canceled"].includes(status);
  return status === filter;
}

function timestamp(value: unknown): [number, number] {
  if (value && typeof value === "object" && "seconds" in value) {
    const stamp = value as { seconds: number; nanoseconds?: number };
    if (Number.isFinite(stamp.seconds)) return [stamp.seconds, Number(stamp.nanoseconds || 0)];
  }
  const milliseconds = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(milliseconds) ? [Math.floor(milliseconds / 1000), (milliseconds % 1000) * 1000000] : [0, 0];
}
/** Multiple role queries can deliver the same project out of order. Never
 * replace a confirmed newer deletion/restoration with an older bucket copy. */
export function preferRecentProjectSnapshot<T>(previous: T, incoming: T): T {
  const version = (row: T) => {
    const data = row as Record<string, unknown>;
    // Prefer the server update version, not a potentially skewed client date.
    return (
      [data.updatedAt, data.restoredAt, data.deletedAt, data.createdAt]
        .map(timestamp)
        .find((stamp) => stamp[0] !== 0 || stamp[1] !== 0) || [0, 0]
    );
  };
  const a = version(previous),
    b = version(incoming);
  return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) ? previous : incoming;
}
