export const TABLES = "tables";
export const TABLE_RECORDS = "table_records";
export const RECORD_ACTIVITY = "table_record_activity";

export const RECORD_LINK_RELATION = "record_reference";
export const TABLE_ITEM_RELATION = "table_item";

export type TableStatus = "active" | "archived" | "deleted";

export type ColumnType =
  | "text"
  | "longtext"
  | "longText"
  | "number"
  | "currency"
  | "date"
  | "status"
  | "dropdown"
  | "person"
  | "people"
  | "tags"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "file"
  | "files"
  | "relation"
  | "link"
  | "lookup"
  | "rollup"
  | "formula"
  | "timeline"
  | "rating"
  | "progress"
  | "created_at"
  | "createdAt"
  | "created_by"
  | "createdBy"
  | "updated_at"
  | "updatedAt"
  | "autoNumber"
  | "ai"
  | "button";

export type SoftTint =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "teal";

export type ColumnSummary =
  | "none"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "countEmpty"
  | "distribution";

export type ColumnConfig = {
  format?: "plain" | "currency" | "percent";
  currency?: string;
  decimals?: number;
  options?: Array<{ id: string; label: string; color: SoftTint; done?: boolean }>;
  multi?: boolean;
  includeTime?: boolean;
  targetTableId?: string;
  twoWay?: boolean;
  backlinkColumnId?: string;
  viaColumnId?: string;
  targetColumnId?: string;
  fn?: "sum" | "count" | "avg" | "min" | "max" | "countIf";
  countIfValue?: unknown;
  expression?: string;
  resultType?: "number" | "text" | "boolean" | "date" | "option";
  prompt?: string;
  inputColumnIds?: string[];
  refresh?: "manual" | "onChange";
  maxFiles?: number;
};

export type StatusOption = {
  id: string;
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "purple";
  color?: SoftTint;
  done?: boolean;
};

export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  width?: number;
  required?: boolean;
  unique?: boolean;
  frozen?: boolean;
  hidden?: boolean;
  /**
   * When true, table viewers (non-editors) cannot see this column.
   * Prefer `access.defaultAccess = "none"`; kept for backward compatibility.
   */
  hiddenForViewers?: boolean;
  /** Per-column view/edit access (Notion-style property permissions). */
  access?: ColumnAccess;
  default?: unknown;
  summary?: ColumnSummary;
  config?: ColumnConfig;
  options?: StatusOption[];
  tagOptions?: string[];
  currency?: "USD" | "GTQ" | "MXN" | "COP" | "CLP" | string;
  relation?: {
    to: "task" | "project" | "note" | "ticket" | "record";
    tableId?: string;
    multiple?: boolean;
  };
};

/** Who can see/edit a property relative to table viewers. */
export type ColumnAccessLevel = "full" | "view" | "none";

export type ColumnAccessSubjectType = "user" | "role" | "group";

export type ColumnAccessException = {
  id: string;
  subjectType: ColumnAccessSubjectType;
  /** Member user id, workspace role key, or freeform group label. */
  subjectId: string;
  label?: string;
  access: ColumnAccessLevel;
};

export type ColumnAccess = {
  /** Access for people who can view the table but are not table editors. */
  defaultAccess: ColumnAccessLevel;
  exceptions: ColumnAccessException[];
};

export type KeyColumns = {
  status?: string | null;
  owner?: string | null;
  date?: string | null;
  title: string;
};

export type TableVisibility = "private" | "project" | "workspace" | "members";

export type TableGroup = {
  id: string;
  name: string;
  color: string;
  order: number;
  collapsed?: boolean;
};

export type TablePermissions = {
  visibility: TableVisibility;
  editors: string[];
  viewers: string[];
};

export type TableDoc = {
  id: string;
  workspaceId: string;
  /** Primary / home project (optional). Used when visibility === "project". */
  projectId?: string | null;
  /**
   * Related projects this table is an asset for (many).
   * Does not replace projectId — home + related are distinct.
   */
  relatedProjectIds?: string[];
  name: string;
  icon: string;
  color: string;
  description?: string;
  visibility: TableVisibility;
  columns: Column[];
  keyColumns: KeyColumns;
  groups?: TableGroup[];
  titleColumnId?: string;
  permissions?: TablePermissions;
  nounSingular?: string;
  nounPlural?: string;
  recordCount: number;
  itemCount?: number;
  templateId?: string | null;
  status?: TableStatus;
  previousStatus?: TableStatus | string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
  restoredAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  favorite?: boolean;
};

export type RecordValue =
  | string
  | number
  | boolean
  | string[]
  | { start: string; end: string }
  | Array<{ name: string; url: string }>
  | null;

export type RecordDoc = {
  id: string;
  tableId: string;
  workspaceId: string;
  values: Record<string, RecordValue>;
  computed?: Record<string, unknown>;
  groupId?: string;
  title?: string;
  order: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  linkCount?: number;
  routineRunId?: string | null;
};

export type RecordActivity = {
  id: string;
  recordId: string;
  tableId: string;
  workspaceId: string;
  actorId: string | null;
  kind: "created" | "field_changed" | "linked" | "unlinked" | "comment" | "automation";
  columnId?: string;
  from?: RecordValue;
  to?: RecordValue;
  text?: string;
  routineId?: string;
  createdAt: string;
};

export type TableEvent =
  | { type: "table.record_created"; tableId: string; recordId: string }
  | {
      type: "table.status_changed";
      tableId: string;
      recordId: string;
      columnId: string;
      from: string | null;
      to: string;
    }
  | {
      type: "table.record_changed";
      tableId: string;
      recordId: string;
      columnId: string;
      from: unknown;
      to: unknown;
    }
  | {
      type: "table.date_reached";
      tableId: string;
      recordId: string;
      columnId: string;
      offsetDays: number;
    }
  | {
      type: "table.record_moved";
      tableId: string;
      recordId: string;
      toGroupId: string;
    }
  | {
      type: "table.form_submitted";
      tableId: string;
      recordId: string;
      formId: string;
    };

export type RecordLinkTarget = {
  type: "task" | "project" | "note" | "ticket" | "record" | "invoice" | "item";
  id: string;
  tableId?: string;
};
