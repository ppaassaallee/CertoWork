import type { FilterRule, SavedView, ViewLayout } from "../../lib/views/types";
import type { TableDoc } from "../../lib/tables";

/** Extended table view layouts beyond the shared engine. */
export type TableViewType =
  | "table"
  | "board"
  | "calendar"
  | "timeline"
  | "chart"
  | "form"
  | "gallery";

export type TableViewDef = Omit<SavedView, "layout" | "surface"> & {
  scopeKind: "table";
  tableId: string;
  type: TableViewType;
  personal?: boolean;
  chart?: {
    chartType: "bar" | "line" | "pie" | "number";
    valueColumnId: string;
    agg: "count" | "sum" | "avg";
    groupByColumnId?: string;
  };
  form?: {
    public: boolean;
    columnIds: string[];
    labels?: Record<string, string>;
    required?: string[];
    description?: string;
    successMessage?: string;
    groupId?: string;
    formId?: string;
  };
  gallery?: { coverColumnId?: string };
  timeline?: { startColumnId: string; endColumnId?: string };
};

export function toEngineLayout(type: TableViewType): ViewLayout {
  if (type === "board") return "board";
  if (type === "calendar") return "calendar";
  if (type === "timeline") return "gantt";
  return "table";
}

export function defaultMainView(table: TableDoc, ownerId: string): TableViewDef {
  const now = new Date().toISOString();
  return {
    id: "main",
    workspaceId: table.workspaceId,
    tableId: table.id,
    scopeKind: "table",
    name: "Main table",
    scope: "team",
    ownerId,
    type: "table",
    columns: table.columns.filter((c) => !c.hidden).map((c) => ({ id: c.id, width: c.width })),
    quickActions: [],
    filters: [],
    sort: [],
    groupBy: null,
    density: "compact",
    createdAt: now,
    updatedAt: now,
  };
}

export function occupiedPropertiesView(table: TableDoc, ownerId: string, occupancyColId: string): TableViewDef {
  const base = defaultMainView(table, ownerId);
  return {
    ...base,
    id: "occupied",
    name: "Occupied properties",
    filters: [{ columnId: occupancyColId, op: "eq", value: "occupied" } as FilterRule],
  };
}

export function pendingPaymentsView(
  table: TableDoc,
  ownerId: string,
  statusCol: string,
  typeCol: string,
): TableViewDef {
  const base = defaultMainView(table, ownerId);
  return {
    ...base,
    id: "pending-payments",
    name: "Pending payments",
    filters: [
      { columnId: statusCol, op: "ne", value: "complete" },
      { columnId: typeCol, op: "in", value: ["rent", "vendor"] },
    ],
    sort: [{ columnId: "due", dir: "asc" }],
  };
}
