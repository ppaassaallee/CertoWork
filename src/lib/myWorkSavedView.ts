import { ROW_QUICK_ACTIONS, type RowQuickAction } from "./quickActions";

const columnAction: Record<string, RowQuickAction> = {
  project: "project",
  delivery: "delivery_entity",
  client: "client_entity",
  tags: "tags",
  category: "work_category",
  phase: "product_phase",
  status: "status",
  priority: "priority",
  gtd: "gtd",
  action_board: "bucket",
  assignee: "assignees",
  due: "due",
  sprint: "sprint",
};

/** The saved-view columns control the attribute icons in My Work's list. */
export function rowActionsForView(columns: Array<{ id: string }>, current: readonly RowQuickAction[]): RowQuickAction[] {
  const selected = new Set(columns.map((column) => column.id));
  return ROW_QUICK_ACTIONS.filter((action) => {
    if (action === "collab" || action === "parent") return current.includes(action);
    const column = Object.keys(columnAction).find((key) => columnAction[key] === action);
    return Boolean(column && selected.has(column));
  });
}

export function itemGroupForView(groupBy: string | null): string {
  const mapped: Record<string, string> = {
    project: "project",
    status: "status",
    priority: "priority",
    assignee: "owner",
    type: "type",
    category: "work_category",
    phase: "product_phase",
    tags: "tag",
    due: "due",
    sprint: "sprint",
    delivery: "delivery_entity",
    client: "client_entity",
    gtd: "gtd",
    action_board: "actionBoard",
  };
  return groupBy ? mapped[groupBy] || "hierarchy" : "hierarchy";
}
