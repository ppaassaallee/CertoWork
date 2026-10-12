import { WORK_STATUSES, type WorkStatusKey } from "./workStatuses";

export const KANBAN_COLUMNS = WORK_STATUSES.map((status) => ({
  key: status.key,
  label: status.label,
  statuses: [status.key] as WorkStatusKey[],
}));

export type KanbanColumnKey = WorkStatusKey;
export const DEFAULT_KANBAN_COLUMN_WIDTH = 280;

const COLUMN_ALIASES: Record<string, KanbanColumnKey> = {
  doing: "in_progress",
  active: "in_progress",
  completed: "done",
  complete: "done",
  closed: "done",
  canceled: "cancelled",
};

export function clampKanbanColumnWidth(value: number) {
  return Math.max(200, Math.min(520, Math.round(value)));
}

export function normalizeKanbanColumn(column?: string | null): KanbanColumnKey {
  const value = String(column || "").toLowerCase();
  if (COLUMN_ALIASES[value]) return COLUMN_ALIASES[value];
  const match = KANBAN_COLUMNS.find((item) => item.key === value);
  return match?.key || "backlog";
}

export function kanbanColumnForStatus(status?: string | null): KanbanColumnKey {
  const value = String(status || "backlog").toLowerCase();
  if (COLUMN_ALIASES[value]) return COLUMN_ALIASES[value];
  const column = KANBAN_COLUMNS.find((item) => item.key === value || item.statuses.includes(value as WorkStatusKey));
  return column?.key || "backlog";
}

export function statusForKanbanColumn(column: string, previousStatus?: string | null) {
  const key = normalizeKanbanColumn(column);
  const match = KANBAN_COLUMNS.find((item) => item.key === key);
  if (!match) return "backlog";
  const previous = String(previousStatus || "").toLowerCase();
  if (match.statuses.includes(previous as WorkStatusKey)) return previous;
  return match.statuses[0];
}

export function laneForKanbanColumn(column: string): "backlog" | "in_progress" | "blocked" | "done" {
  const status = statusForKanbanColumn(column);
  if (status === "blocked") return "blocked";
  if (status === "done" || status === "cancelled") return "done";
  if (status === "in_progress" || status === "in_review") return "in_progress";
  return "backlog";
}

/** Cumulative-flow buckets stay four wide; the board itself is one column per status. */
export function cumulativeFlowBucket(column: string): "backlog" | "doing" | "blocked" | "done" {
  const value = String(column || "").toLowerCase();
  if (value === "blocked") return "blocked";
  if (value === "done" || value === "cancelled" || value === "completed" || value === "closed") return "done";
  if (value === "doing" || value === "in_progress" || value === "in_review") return "doing";
  return "backlog";
}

export function visibleBoardColumns(showCompleted: boolean, statusFilter = "open") {
  const filter = String(statusFilter || "").toLowerCase();
  return KANBAN_COLUMNS.filter((column) => {
    const completed = column.key === "done" || column.key === "cancelled";
    if (!completed) return true;
    return showCompleted || filter === "all" || filter === column.key;
  });
}

export function columnOrderAfterDrop<T extends { id: string }>(
  columnItems: T[],
  draggedId: string,
  destinationIndex: number,
) {
  const without = columnItems.filter((item) => item.id !== draggedId);
  const index = Math.max(0, Math.min(destinationIndex, without.length));
  const next = [
    ...without.slice(0, index),
    { id: draggedId } as T,
    ...without.slice(index),
  ];
  return next.map((item, order) => ({ id: item.id, order, rank: order }));
}
