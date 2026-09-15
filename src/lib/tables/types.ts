export const TABLES = "tables";
export const TABLE_RECORDS = "table_records";
export const RECORD_ACTIVITY = "table_record_activity";

export const RECORD_LINK_RELATION = "record_reference";
export const TABLE_ITEM_RELATION = "table_item";

export type TableStatus = "active" | "archived" | "deleted";

export type ColumnType =
  | "text"
  | "longtext"
  | "number"
  | "currency"
  | "date"
  | "status"
  | "person"
  | "tags"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "file"
  | "relation"
  | "created_at"
  | "created_by"
  | "updated_at";

export type StatusOption = {
  id: string;
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "purple";
};

export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  width?: number;
  required?: boolean;
  options?: StatusOption[];
  tagOptions?: string[];
  currency?: "USD" | "GTQ" | "MXN" | "COP" | "CLP";
  relation?: {
    to: "task" | "project" | "note" | "ticket" | "record";
    tableId?: string;
    multiple?: boolean;
  };
  hidden?: boolean;
};

export type KeyColumns = {
  status?: string | null;
  owner?: string | null;
  date?: string | null;
  title: string;
};

export type TableVisibility = "private" | "project" | "workspace";

export type TableDoc = {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  name: string;
  icon: string;
  color: string;
  description?: string;
  visibility: TableVisibility;
  columns: Column[];
  keyColumns: KeyColumns;
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

export type RecordValue = string | number | boolean | string[] | null;

export type RecordDoc = {
  id: string;
  tableId: string;
  workspaceId: string;
  values: Record<string, RecordValue>;
  order: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  linkCount?: number;
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
      type: "table.date_reached";
      tableId: string;
      recordId: string;
      columnId: string;
      offsetDays: number;
    };

export type RecordLinkTarget = {
  type: "task" | "project" | "note" | "ticket" | "record";
  id: string;
};
