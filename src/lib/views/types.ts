import type { ColumnType, RecordValue } from "../tables/types";

export const SAVED_VIEWS = "saved_views";

export type EntityKind = "task" | "project" | "record";
export type ViewLayout = "table" | "board" | "calendar" | "gantt";
export type ViewScope = "personal" | "team";
export type Surface = "my-work" | "projects-list" | `project:${string}` | `table:${string}`;

export type ColumnDef<Row> = {
  id: string;
  label: string;
  type: ColumnType;
  width?: number;
  minWidth?: number;
  fixed?: boolean;
  sortable?: boolean;
  groupable?: boolean;
  filterable?: boolean;
  read: (row: Row) => RecordValue;
  write?: (row: Row, value: RecordValue) => Promise<void>;
  options?: () => Array<{ id: string; label: string; tone: string }>;
  render?: "default" | "title" | "hierarchy";
};

export type ActionContext = {
  userId: string;
  workspaceId: string;
  navigate: (to: string) => void;
  openItem: (id: string) => void;
  openOdysseus: (scope: { entityType: string; entityId: string }) => void;
  toast: (msg: string) => void;
};

export type ActionDef<Row> = {
  id: string;
  label: string;
  icon: string;
  kind: "row" | "bulk" | "both";
  canRun: (rows: Row[], ctx: ActionContext) => boolean;
  run: (rows: Row[], ctx: ActionContext) => Promise<void>;
  shortcut?: string;
  danger?: boolean;
  group?: "state" | "assign" | "time" | "ai" | "navigate" | "danger";
};

export type EntityAdapter<Row> = {
  kind: EntityKind;
  columns: ColumnDef<Row>[];
  actions: ActionDef<Row>[];
  rowId: (row: Row) => string;
  parentId?: (row: Row) => string | null;
  defaultView: (surface: Surface) => SavedView;
  /** Optional live subscription; parents may pass rows directly to ViewGrid instead. */
  subscribe?: (surface: Surface, onRows: (rows: Row[]) => void) => () => void;
};

export type FilterRule = {
  columnId: string;
  op:
    | "eq"
    | "ne"
    | "in"
    | "contains"
    | "empty"
    | "notEmpty"
    | "before"
    | "after"
    | "me"
    | "overdue"
    | "today"
    | "week";
  value?: unknown;
};

export type SavedView = {
  id: string;
  workspaceId: string;
  surface: Surface;
  name: string;
  icon?: string;
  scope: ViewScope;
  ownerId: string;
  layout: ViewLayout;
  columns: Array<{ id: string; width?: number }>;
  quickActions: string[];
  filters: FilterRule[];
  sort: Array<{ columnId: string; dir: "asc" | "desc" }>;
  groupBy: string | null;
  density: "comfortable" | "compact";
  showSubtasks?: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApplyContext = {
  userId: string;
  now?: Date;
};

export type ApplyGroup<Row> = {
  key: string;
  label: string;
  rows: Row[];
};

export type ApplyResult<Row> = {
  rows: Row[];
  groups: ApplyGroup<Row>[];
};
