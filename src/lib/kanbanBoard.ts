export const KANBAN_COLUMNS = [
  { key: "backlog", label: "Backlog", statuses: ["backlog", "ready", "todo"] },
  { key: "doing", label: "In progress", statuses: ["in_progress", "in_review"] },
  { key: "blocked", label: "Blocked", statuses: ["blocked"] },
  { key: "done", label: "Completed", statuses: ["done", "cancelled"] },
] as const;

export type KanbanColumnKey = (typeof KANBAN_COLUMNS)[number]["key"];
export const DEFAULT_KANBAN_COLUMN_WIDTH = 280;

export function clampKanbanColumnWidth(value: number) {
  return Math.max(200, Math.min(520, Math.round(value)));
}

export function kanbanColumnForStatus(status?: string | null): KanbanColumnKey {
  const value = String(status || "backlog").toLowerCase();
  const column = KANBAN_COLUMNS.find((item) => item.statuses.includes(value as never));
  return column?.key || "backlog";
}

export function statusForKanbanColumn(column: string, previousStatus?: string | null) {
  const match = KANBAN_COLUMNS.find((item) => item.key === column);
  if (!match) return "backlog";
  const previous = String(previousStatus || "").toLowerCase();
  if (match.statuses.includes(previous as never)) return previous;
  return match.statuses[0];
}

export function laneForKanbanColumn(column: string): "backlog" | "in_progress" | "blocked" | "done" {
  const status = statusForKanbanColumn(column);
  if (status === "blocked") return "blocked";
  if (status === "done" || status === "cancelled") return "done";
  if (status === "in_progress" || status === "in_review") return "in_progress";
  return "backlog";
}
