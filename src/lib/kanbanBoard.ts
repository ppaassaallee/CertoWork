export const KANBAN_COLUMNS = [
  { key: "backlog", label: "Backlog", statuses: ["backlog", "ready", "todo"] },
  { key: "doing", label: "Doing", statuses: ["in_progress", "in_review"] },
  { key: "blocked", label: "Blocked", statuses: ["blocked"] },
  { key: "done", label: "Done", statuses: ["done", "cancelled"] },
] as const;

export type KanbanColumnKey = (typeof KANBAN_COLUMNS)[number]["key"];

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
