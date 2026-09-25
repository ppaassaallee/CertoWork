import type { RecordDoc, RecordValue, TableDoc } from "../../../lib/tables";
import { updateRecordField, deleteRecord, createRecord } from "../../../lib/tables/storage";
import {
  canEditColumn,
  canViewColumn,
} from "../../../lib/tables/permissions";
import type {
  ActionContext,
  ActionDef,
  ColumnDef,
  EntityAdapter,
  SavedView,
  Surface,
} from "../../../lib/views/types";
import type { TableMember } from "../cells/RecordCells";
import { t } from "../../../lib/i18n";

export type RecordAdapterDeps = {
  table: TableDoc;
  members: TableMember[];
  actorId: string;
  onOpenRecord: (id: string) => void;
  onCreateRecord?: (title?: string) => Promise<void> | void;
  onCreateItem?: (record: RecordDoc) => Promise<void> | void;
  onCreateTicket?: (record: RecordDoc) => Promise<void> | void;
  onCreateNote?: (record: RecordDoc) => Promise<void> | void;
};

function toneOf(raw?: string): string {
  return raw || "neutral";
}

export function buildRecordAdapter(deps: RecordAdapterDeps): EntityAdapter<RecordDoc> {
  const { table, members, actorId } = deps;
  const actor = { userId: actorId };
  const titleCol = table.keyColumns.title;
  const statusCol = table.keyColumns.status || null;
  const ownerCol = table.keyColumns.owner || null;

  const columns: ColumnDef<RecordDoc>[] = table.columns
    .filter((col) => !col.hidden && canViewColumn(table, col, actor))
    .map((col) => {
      const editable = canEditColumn(table, col, actor);
      return {
        id: col.id,
        label: col.name,
        type: col.type,
        width: col.width,
        sortable: true,
        groupable: col.type === "status" || col.type === "dropdown" || col.type === "person",
        filterable: true,
        fixed: col.id === titleCol,
        render: col.id === titleCol ? ("title" as const) : ("default" as const),
        read: (row: RecordDoc) => (row.values?.[col.id] ?? null) as RecordValue,
        write: editable
          ? async (row: RecordDoc, value: RecordValue) => {
              await updateRecordField({
                table,
                recordId: row.id,
                columnId: col.id,
                value,
                actorId,
              });
            }
          : undefined,
        options:
          col.options?.length
            ? () =>
                (col.options || []).map((opt) => ({
                  id: opt.id,
                  label: opt.label,
                  tone: toneOf(opt.tone),
                }))
            : undefined,
      };
    });

  const actions: ActionDef<RecordDoc>[] = [
    {
      id: "set_status",
      label: t("views.action.setStatus"),
      icon: "CircleDot",
      kind: "both",
      group: "state",
      canRun: (rows) => Boolean(statusCol) && rows.length > 0,
      run: async () => {
        /* status changes go through cell / bulk bar select */
      },
    },
    {
      id: "assign",
      label: t("views.action.assign"),
      icon: "User",
      kind: "both",
      group: "assign",
      canRun: (rows) => Boolean(ownerCol) && rows.length > 0 && members.length > 0,
      run: async () => {},
    },
    {
      id: "create_item",
      label: t("views.action.createItem"),
      icon: "ListTodo",
      kind: "row",
      group: "navigate",
      canRun: (rows) => Boolean(deps.onCreateItem) && rows.length === 1,
      run: async (rows) => {
        if (deps.onCreateItem) await deps.onCreateItem(rows[0]);
      },
    },
    {
      id: "create_ticket",
      label: t("views.action.createTicket"),
      icon: "Inbox",
      kind: "row",
      group: "navigate",
      canRun: (rows) => Boolean(deps.onCreateTicket) && rows.length === 1,
      run: async (rows) => {
        if (deps.onCreateTicket) await deps.onCreateTicket(rows[0]);
      },
    },
    {
      id: "create_note",
      label: t("views.action.createNote"),
      icon: "FileText",
      kind: "row",
      group: "navigate",
      canRun: (rows) => Boolean(deps.onCreateNote) && rows.length === 1,
      run: async (rows) => {
        if (deps.onCreateNote) await deps.onCreateNote(rows[0]);
      },
    },
    {
      id: "odysseus",
      label: t("views.action.odysseus"),
      icon: "Sparkles",
      kind: "row",
      group: "ai",
      canRun: (rows) => rows.length === 1,
      run: async (rows, ctx: ActionContext) => {
        ctx.openOdysseus({ entityType: "record", entityId: rows[0].id });
      },
    },
    {
      id: "delete",
      label: t("views.action.delete"),
      icon: "Trash2",
      kind: "both",
      group: "danger",
      danger: true,
      canRun: (rows) => rows.length > 0,
      run: async (rows, ctx) => {
        for (const row of rows) {
          await deleteRecord(table.id, row.id, table.workspaceId);
        }
        ctx.toast(
          rows.length === 1
            ? t("views.toast.recordDeleted")
            : t("views.toast.recordsDeleted").replace("{n}", String(rows.length)),
        );
      },
    },
  ];

  return {
    kind: "record",
    columns,
    actions,
    rowId: (row) => row.id,
    defaultView: (surface: Surface): SavedView => {
      const now = new Date().toISOString();
      return {
        id: `default:${surface}`,
        workspaceId: table.workspaceId,
        surface,
        name: t("views.default"),
        scope: "personal",
        ownerId: actorId,
        layout: "table",
        columns: columns.map((col) => ({ id: col.id, width: col.width })),
        quickActions: ["set_status", "assign", "odysseus", "delete"].filter((id) =>
          actions.some((action) => action.id === id),
        ),
        filters: [],
        sort: [],
        groupBy: null,
        density: "comfortable",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      };
    },
  };
}

export async function createBlankRecord(
  table: TableDoc,
  actorId: string,
  title?: string,
): Promise<string> {
  return createRecord({
    tableId: table.id,
    workspaceId: table.workspaceId,
    values: title ? { [table.keyColumns.title]: title } : {},
    actorId,
  });
}
