import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  CalendarDays,
  Filter,
  Kanban,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Settings2,
  Zap,
} from "../../components/ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";
import { t } from "../../lib/i18n";
import {
  TABLE_RECORDS,
  createRecord,
  deleteRecord,
  updateRecordField,
  updateTableColumns,
  type KeyColumns,
  type Column,
  type RecordActivity,
  type RecordDoc,
  type RecordValue,
  type TableDoc,
} from "../../lib/tables";
import { ColumnsEditor } from "./ColumnsEditor";
import { RecordPanel } from "./RecordPanel";
import { RecordsBoard } from "./RecordsBoard";
import { RecordsCalendar } from "./RecordsCalendar";
import { RecordsGrid } from "./RecordsGrid";
import { TableAutomationComposer } from "./TableAutomationComposer";
import type { TableMember } from "./cells/RecordCells";

export type TableViewMode = "table" | "board" | "calendar";

export type TablePageProps = {
  table: TableDoc;
  records?: RecordDoc[];
  members: TableMember[];
  recordId?: string | null;
  activity?: RecordActivity[];
  onOpenRecord?(id: string | null): void;
  onOpenAutomations?(): void;
  onTableChange?(table: TableDoc): void;
  onFieldChange?(recordId: string, columnId: string, value: RecordValue): void;
  onCreateRecord?(values?: Record<string, RecordValue>): void | Promise<void>;
  onDeleteRecords?(ids: string[]): void | Promise<void>;
  onComment?(recordId: string, text: string): void;
  onLinkTask?(recordId: string): void;
  onLinkNote?(recordId: string): void;
  onLinkTicket?(recordId: string): void;
  onLinkRecord?(recordId: string): void;
};

export function TablePage({
  table,
  records: recordsProp,
  members,
  recordId = null,
  activity = [],
  onOpenRecord,
  onOpenAutomations: _onOpenAutomations,
  onTableChange,
  onFieldChange,
  onCreateRecord,
  onDeleteRecords,
  onComment,
  onLinkTask,
  onLinkNote,
  onLinkTicket,
  onLinkRecord,
}: TablePageProps) {
  const { user } = useAuth();
  const actorId = user?.uid || table.createdBy;
  const [view, setView] = useState<TableViewMode>("table");
  const [menuOpen, setMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [liveRecords, setLiveRecords] = useState<RecordDoc[]>([]);
  const ownsData = recordsProp === undefined;

  useEffect(() => {
    if (!ownsData) return;
    const q = query(
      collection(db, TABLE_RECORDS),
      where("tableId", "==", table.id),
      orderBy("order", "asc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        setLiveRecords(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RecordDoc, "id">) })),
        );
      },
      () => setLiveRecords([]),
    );
  }, [ownsData, table.id]);

  const records = recordsProp ?? liveRecords;

  const openRecord = useCallback(
    (id: string | null) => {
      onOpenRecord?.(id);
    },
    [onOpenRecord],
  );

  const handleFieldChange = useCallback(
    async (recordId: string, columnId: string, value: RecordValue) => {
      if (onFieldChange) {
        onFieldChange(recordId, columnId, value);
        return;
      }
      await updateRecordField({
        table,
        recordId,
        columnId,
        value,
        actorId,
      });
    },
    [onFieldChange, table, actorId],
  );

  const handleCreate = useCallback(
    async (opts?: { title?: string; statusId?: string }) => {
      const values: Record<string, RecordValue> = {
        [table.keyColumns.title]: opts?.title?.trim() || t("tables.untitled"),
      };
      if (opts?.statusId && table.keyColumns.status) {
        values[table.keyColumns.status] = opts.statusId;
      }
      if (onCreateRecord) {
        await onCreateRecord(values);
        return;
      }
      await createRecord({
        tableId: table.id,
        workspaceId: table.workspaceId,
        values,
        actorId,
      });
    },
    [onCreateRecord, table, actorId],
  );

  const handleDelete = useCallback(
    async (ids: string[]) => {
      if (onDeleteRecords) {
        await onDeleteRecords(ids);
        return;
      }
      for (const id of ids) await deleteRecord(table.id, id);
      if (recordId && ids.includes(recordId)) openRecord(null);
    },
    [onDeleteRecords, table.id, recordId, openRecord],
  );

  const handleColumnsChange = useCallback(
    async (columns: Column[], keyColumns: KeyColumns) => {
      const next = { ...table, columns, keyColumns };
      onTableChange?.(next);
      await updateTableColumns(table.id, columns, keyColumns);
    },
    [table, onTableChange],
  );

  const activeRecord = useMemo(
    () => (recordId ? records.find((r) => r.id === recordId) || null : null),
    [recordId, records],
  );

  const meta = useMemo(() => {
    const parts = [
      t("tables.meta.records").replace("{n}", String(records.length)),
      table.visibility === "private"
        ? t("tables.visibility.private")
        : table.visibility === "project"
          ? t("tables.visibility.project")
          : t("tables.visibility.workspace"),
    ];
    return parts.join(" · ");
  }, [records.length, table.visibility]);

  return (
    <div className="cw-tables-page" data-testid="tables-page">
      <header className="cw-tables-page-header">
        <div className="cw-tables-page-brand">
          <span className="cw-tables-page-icon" aria-hidden>
            {table.icon || "▦"}
          </span>
          <div>
            <h1>{table.name}</h1>
            <p className="cw-tables-muted">{meta}</p>
          </div>
        </div>

        <div className="cw-tables-page-actions">
          <button
            type="button"
            className="cw-tables-chip-btn"
            onClick={() => setAutomationsOpen(true)}
          >
            <Zap size={14} />
            {t("tables.page.automations")}
          </button>
          <button type="button" className="cw-tables-chip-btn is-stub" disabled title={t("tables.page.filterSoon")}>
            <Filter size={14} />
            {t("tables.page.filter")}
          </button>
          <div className="cw-tables-menu-wrap">
            <button
              type="button"
              className="cw-tables-icon-btn"
              aria-label={t("tables.page.menu")}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen ? (
              <div className="cw-tables-popover">
                <button
                  type="button"
                  onClick={() => {
                    setColumnsOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Settings2 size={14} /> {t("tables.page.editColumns")}
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="cw-tables-btn"
            onClick={() => void handleCreate()}
          >
            <Plus size={14} />
            {t("tables.page.newRecord")}
          </button>
        </div>
      </header>

      <nav className="cw-tables-tabs" aria-label={t("tables.page.views")}>
        {(
          [
            ["table", t("tables.tabs.table"), LayoutGrid],
            ["board", t("tables.tabs.board"), Kanban],
            ["calendar", t("tables.tabs.calendar"), CalendarDays],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "is-active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      <div className="cw-tables-page-body">
        <div className="cw-tables-page-main">
          {view === "table" ? (
            <RecordsGrid
              table={table}
              records={records}
              members={members}
              onFieldChange={(id, col, val) => void handleFieldChange(id, col, val)}
              onCreateRecord={(title) => void handleCreate({ title })}
              onDeleteRecords={(ids) => void handleDelete(ids)}
              onOpenRecord={(id) => openRecord(id)}
            />
          ) : null}
          {view === "board" ? (
            <RecordsBoard
              table={table}
              records={records}
              members={members}
              onFieldChange={(id, col, val) => void handleFieldChange(id, col, val)}
              onOpenRecord={(id) => openRecord(id)}
              onCreateRecord={(statusId) => void handleCreate({ statusId })}
            />
          ) : null}
          {view === "calendar" ? (
            <RecordsCalendar
              table={table}
              records={records}
              onOpenRecord={(id) => openRecord(id)}
            />
          ) : null}
        </div>

        {activeRecord ? (
          <RecordPanel
            table={table}
            record={activeRecord}
            members={members}
            activity={activity.filter((a) => a.recordId === activeRecord.id)}
            onClose={() => openRecord(null)}
            onFieldChange={(col, val) => void handleFieldChange(activeRecord.id, col, val)}
            onComment={onComment ? (text) => onComment(activeRecord.id, text) : undefined}
            onLinkTask={onLinkTask ? () => onLinkTask(activeRecord.id) : undefined}
            onLinkNote={onLinkNote ? () => onLinkNote(activeRecord.id) : undefined}
            onLinkTicket={onLinkTicket ? () => onLinkTicket(activeRecord.id) : undefined}
            onLinkRecord={onLinkRecord ? () => onLinkRecord(activeRecord.id) : undefined}
          />
        ) : null}

        {columnsOpen ? (
          <ColumnsEditor
            table={table}
            onClose={() => setColumnsOpen(false)}
            onChange={(cols, keys) => void handleColumnsChange(cols, keys)}
          />
        ) : null}

        <TableAutomationComposer
          open={automationsOpen}
          table={table}
          onClose={() => setAutomationsOpen(false)}
        />
      </div>
    </div>
  );
}
