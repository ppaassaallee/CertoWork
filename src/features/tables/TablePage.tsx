import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Archive,
  CalendarDays,
  FileText,
  Kanban,
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Zap,
} from "../../components/ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";
import { hasConfirmedSnapshotData } from "../../lib/firestoreSnapshotSafety";
import { t } from "../../lib/i18n";
import {
  TABLE_RECORDS,
  assertCanWriteColumn,
  createRecord,
  deleteRecord,
  emptyTableFilters,
  filterTableRecords,
  redactRecordsForActor,
  tableLifecycleStatus,
  updateRecordField,
  updateTableColumns,
  visibleColumnsForActor,
  type KeyColumns,
  type Column,
  type RecordActivity,
  type RecordDoc,
  type RecordLinkTarget,
  type RecordValue,
  type TableDoc,
  type TableFilterState,
} from "../../lib/tables";
import { ColumnsEditor } from "./ColumnsEditor";
import { RecordPanel } from "./RecordPanel";
import { RecordsBoard } from "./RecordsBoard";
import { RecordsCalendar } from "./RecordsCalendar";
import { RecordsViewSurface } from "../views/RecordsViewSurface";
import { TableAutomationComposer } from "./TableAutomationComposer";
import { AutomationCenter } from "./AutomationCenter";
import { TableFiltersBar } from "./TableFiltersBar";
import { TableFormView } from "./TableFormView";
import { TableGroupedGrid } from "./TableGroupedGrid";
import {
  TableItemsPanel,
  type TableItemCandidate,
} from "./TableItemsPanel";
import {
  TableProjectsBar,
  type TableProjectOption,
} from "./TableProjectsBar";
import type { TableMember } from "./cells/RecordCells";

export type TableViewMode = "table" | "board" | "calendar" | "items" | "form";

export type TablePageProps = {
  table: TableDoc;
  records?: RecordDoc[];
  members: TableMember[];
  projects?: TableProjectOption[];
  itemCandidates?: TableItemCandidate[];
  recordId?: string | null;
  activity?: RecordActivity[];
  onOpenRecord?(id: string | null): void;
  onOpenProject?(projectId: string): void;
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
  onOpenLink?(target: RecordLinkTarget): void;
  onOpenItem?(itemId: string): void;
  onArchiveTable?(): void;
  onDeleteTable?(): void;
  onRestoreTable?(): void;
  onPermanentlyDeleteTable?(): void;
  onOpenOdysseus?(opts: {
    kind: "table" | "record";
    entityId: string;
    label: string;
    prompt?: string;
  }): void;
};

export function TablePage({
  table,
  records: recordsProp,
  members,
  projects = [],
  itemCandidates = [],
  recordId = null,
  activity = [],
  onOpenRecord,
  onOpenProject,
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
  onOpenLink,
  onOpenItem,
  onArchiveTable,
  onDeleteTable,
  onRestoreTable,
  onPermanentlyDeleteTable,
  onOpenOdysseus,
}: TablePageProps) {
  const { user } = useAuth();
  const actorId = user?.uid || table.createdBy;
  const [view, setView] = useState<TableViewMode>("table");
  const [menuOpen, setMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TableFilterState>(() => emptyTableFilters());
  const [liveRecords, setLiveRecords] = useState<RecordDoc[]>([]);
  const [itemCount, setItemCount] = useState(Number(table.itemCount || 0));
  const ownsData = recordsProp === undefined;
  const lifecycle = tableLifecycleStatus(table);

  useEffect(() => {
    if (!ownsData) return;
    setLiveRecords([]);
    const q = query(
      collection(db, TABLE_RECORDS),
      where("tableId", "==", table.id),
      orderBy("order", "asc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        if (!hasConfirmedSnapshotData(snap)) return;
        setLiveRecords(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RecordDoc, "id">) })),
        );
      },
      (error) => console.error(`Table ${table.id} records could not be refreshed`, error),
    );
  }, [ownsData, table.id]);

  useEffect(() => {
    setItemCount(Number(table.itemCount || 0));
  }, [table.itemCount, table.id]);

  const records = recordsProp ?? liveRecords;
  const accessActor = useMemo(
    () => ({ userId: actorId, isAdmin: false }),
    [actorId],
  );
  const accessTable = useMemo(
    () => ({
      ...table,
      columns: visibleColumnsForActor(table, accessActor),
    }),
    [table, accessActor],
  );
  const filteredRecords = useMemo(
    () => filterTableRecords(table, records, filters),
    [table, records, filters],
  );
  const visibleRecords = useMemo(
    () => redactRecordsForActor(table, filteredRecords, accessActor),
    [table, filteredRecords, accessActor],
  );
  const readOnlyColumnIds = useMemo(() => {
    const locked = new Set<string>();
    for (const column of accessTable.columns) {
      try {
        assertCanWriteColumn(table, column.id, accessActor);
      } catch {
        locked.add(column.id);
      }
    }
    return locked;
  }, [accessTable.columns, table, accessActor]);

  const openRecord = useCallback(
    (id: string | null) => {
      onOpenRecord?.(id);
    },
    [onOpenRecord],
  );

  const handleFieldChange = useCallback(
    async (recordId: string, columnId: string, value: RecordValue) => {
      try {
        assertCanWriteColumn(table, columnId, accessActor);
      } catch {
        return;
      }
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
    [onFieldChange, table, actorId, accessActor],
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
      for (const id of ids) await deleteRecord(table.id, id, table.workspaceId);
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
      t("tables.meta.records").replace("{n}", String(visibleRecords.length)),
      t("tables.meta.items").replace("{n}", String(itemCount)),
      table.visibility === "private"
        ? t("tables.visibility.private")
        : table.visibility === "project"
          ? t("tables.visibility.project")
          : t("tables.visibility.workspace"),
    ];
    if (lifecycle === "archived") parts.push(t("tables.status.archived"));
    if (lifecycle === "deleted") parts.push(t("tables.status.deleted"));
    return parts.join(" · ");
  }, [visibleRecords.length, itemCount, table.visibility, lifecycle]);

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
          {onOpenOdysseus ? (
            <button
              type="button"
              className="cw-tables-chip-btn"
              data-testid="tables-odysseus-chip"
              onClick={() =>
                onOpenOdysseus({
                  kind: activeRecord ? "record" : "table",
                  entityId: activeRecord ? activeRecord.id : table.id,
                  label: activeRecord
                    ? String(activeRecord.values[table.keyColumns.title] ?? table.name)
                    : table.name,
                })
              }
            >
              <Sparkles size={14} />
              Odysseus
            </button>
          ) : null}
          <button
            type="button"
            className="cw-tables-chip-btn"
            onClick={() => setAutomationsOpen(true)}
          >
            <Zap size={14} />
            {t("tables.page.automations")}
          </button>
          <TableFiltersBar
            table={table}
            members={members}
            filters={filters}
            onChange={setFilters}
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
          />
          <div className="cw-tables-menu-wrap">
            <button
              type="button"
              className="cw-tables-icon-btn"
              aria-label={t("tables.page.menu")}
              data-testid="tables-page-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen ? (
              <div className="cw-tables-popover" data-testid="tables-page-menu-pop">
                <button
                  type="button"
                  onClick={() => {
                    setColumnsOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Settings2 size={14} /> {t("tables.page.editColumns")}
                </button>
                {lifecycle === "active" && onArchiveTable ? (
                  <button
                    type="button"
                    data-testid="tables-archive"
                    onClick={() => {
                      setMenuOpen(false);
                      onArchiveTable();
                    }}
                  >
                    <Archive size={14} /> {t("tables.page.archive")}
                  </button>
                ) : null}
                {lifecycle !== "deleted" && onDeleteTable ? (
                  <button
                    type="button"
                    className="is-danger"
                    data-testid="tables-delete"
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteTable();
                    }}
                  >
                    <Trash2 size={14} /> {t("tables.page.delete")}
                  </button>
                ) : null}
                {lifecycle !== "active" && onRestoreTable ? (
                  <button
                    type="button"
                    data-testid="tables-restore"
                    onClick={() => {
                      setMenuOpen(false);
                      onRestoreTable();
                    }}
                  >
                    <Archive size={14} /> {t("tables.page.restore")}
                  </button>
                ) : null}
                {lifecycle === "deleted" && onPermanentlyDeleteTable ? (
                  <button
                    type="button"
                    className="is-danger"
                    data-testid="tables-delete-forever"
                    onClick={() => {
                      setMenuOpen(false);
                      onPermanentlyDeleteTable();
                    }}
                  >
                    <Trash2 size={14} /> {t("tables.page.deleteForever")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {view !== "items" && view !== "form" ? (
            <button
              type="button"
              className="cw-tables-btn"
              onClick={() => void handleCreate()}
            >
              <Plus size={14} />
              {t("tables.page.newRecord")}
            </button>
          ) : null}
        </div>
      </header>

      {lifecycle === "active" ? (
        <TableProjectsBar
          table={table}
          projects={projects}
          onOpenProject={onOpenProject}
          onTableChange={onTableChange}
        />
      ) : null}

      <nav className="cw-tables-tabs" aria-label={t("tables.page.views")}>
        {(
          [
            ["table", t("tables.tabs.table"), LayoutGrid],
            ["board", t("tables.tabs.board"), Kanban],
            ["calendar", t("tables.tabs.calendar"), CalendarDays],
            ["items", t("tables.tabs.items"), ListChecks],
            ["form", t("tables.tabs.form"), FileText],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "is-active" : ""}
            data-testid={`tables-tab-${id}`}
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
            table.groups?.length ? (
              <TableGroupedGrid
                table={accessTable}
                records={visibleRecords}
                members={members}
                projects={projects}
                readOnlyColumnIds={readOnlyColumnIds}
                onOpenProject={onOpenProject}
                onFieldChange={(id, col, val) => void handleFieldChange(id, col, val)}
                onOpenRecord={(id) => openRecord(id)}
                onCreateRecord={(groupId) => {
                  void (async () => {
                    const values: Record<string, RecordValue> = {
                      [table.keyColumns.title]: t("tables.untitled"),
                    };
                    if (onCreateRecord) {
                      await onCreateRecord({ ...values, __groupId: groupId } as never);
                      return;
                    }
                    await createRecord({
                      tableId: table.id,
                      workspaceId: table.workspaceId,
                      values,
                      actorId,
                    });
                    void groupId;
                  })();
                }}
              />
            ) : (
              <RecordsViewSurface
                actorId={actorId || ""}
                members={members}
                projects={projects}
                onOpenProject={onOpenProject}
                onCreateRecord={(title) => void handleCreate({ title })}
                onDeleteRecords={(ids) => void handleDelete(ids)}
                onFieldChange={(id, col, val) => void handleFieldChange(id, col, val as never)}
                onOpenRecord={(id) => openRecord(id)}
                records={visibleRecords}
                table={accessTable}
                workspaceId={table.workspaceId}
              />
            )
          ) : null}
          {view === "board" ? (
            <RecordsBoard
              table={accessTable}
              records={visibleRecords}
              members={members}
              onFieldChange={(id, col, val) => void handleFieldChange(id, col, val)}
              onOpenRecord={(id) => openRecord(id)}
              onCreateRecord={(statusId) => void handleCreate({ statusId })}
            />
          ) : null}
          {view === "calendar" ? (
            <RecordsCalendar
              table={accessTable}
              records={visibleRecords}
              onOpenRecord={(id) => openRecord(id)}
            />
          ) : null}
          {view === "items" ? (
            <TableItemsPanel
              tableId={table.id}
              workspaceId={table.workspaceId}
              candidates={itemCandidates}
              onOpenItem={onOpenItem}
              onItemsChanged={(ids) => {
                setItemCount(ids.length);
                onTableChange?.({ ...table, itemCount: ids.length });
              }}
            />
          ) : null}
          {view === "form" ? <TableFormView table={table} members={members} /> : null}
        </div>

        {activeRecord && view !== "items" && view !== "form" ? (
          <RecordPanel
            table={accessTable}
            record={activeRecord}
            members={members}
            projects={projects}
            activity={activity.filter((a) => a.recordId === activeRecord.id)}
            recordOrder={visibleRecords.map((r) => r.id)}
            readOnlyColumnIds={readOnlyColumnIds}
            onClose={() => openRecord(null)}
            onOpenRecord={(id) => openRecord(id)}
            onOpenProject={onOpenProject}
            onAskOdysseus={
              onOpenOdysseus
                ? () =>
                    onOpenOdysseus({
                      kind: "record",
                      entityId: activeRecord.id,
                      label: String(activeRecord.values[table.keyColumns.title] ?? ""),
                      prompt: "Summarize this record",
                    })
                : undefined
            }
            onFieldChange={(col, val) => void handleFieldChange(activeRecord.id, col, val)}
            onComment={onComment ? (text) => onComment(activeRecord.id, text) : undefined}
            onLinkTask={onLinkTask ? () => onLinkTask(activeRecord.id) : undefined}
            onLinkNote={onLinkNote ? () => onLinkNote(activeRecord.id) : undefined}
            onLinkTicket={onLinkTicket ? () => onLinkTicket(activeRecord.id) : undefined}
            onLinkRecord={onLinkRecord ? () => onLinkRecord(activeRecord.id) : undefined}
            onOpenLink={onOpenLink}
          />
        ) : null}

        {columnsOpen ? (
          <ColumnsEditor
            table={table}
            members={members}
            onClose={() => setColumnsOpen(false)}
            onChange={(cols, keys) => void handleColumnsChange(cols, keys)}
          />
        ) : null}

        <TableAutomationComposer
          open={false}
          table={table}
          onClose={() => setAutomationsOpen(false)}
        />
        <AutomationCenter
          open={automationsOpen}
          table={table}
          selectedRecord={activeRecord}
          onClose={() => setAutomationsOpen(false)}
        />
      </div>
    </div>
  );
}
