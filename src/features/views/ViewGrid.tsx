import { Fragment, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  Archive,
  Calendar,
  CalendarDays,
  Check,
  CircleDot,
  Copy,
  FileText,
  FolderKanban,
  Inbox,
  ListTodo,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Repeat,
  Sparkles,
  Star,
  Trash2,
  User,
  UserPlus,
} from "../../components/ui/Icon";
import { applyView } from "../../lib/views/apply";
import type {
  ActionContext,
  ActionDef,
  EntityAdapter,
  SavedView,
} from "../../lib/views/types";
import type { RecordValue } from "../../lib/tables";
import { t } from "../../lib/i18n";
import { CellRenderer, type TableMember } from "./cells/RecordCells";
import type { Column } from "../../lib/tables/types";

const ICON_MAP = {
  CircleDot,
  User,
  UserPlus,
  ListTodo,
  Inbox,
  FileText,
  Sparkles,
  Trash2,
  MoreHorizontal,
  Plus,
  Check,
  Star,
  Calendar,
  CalendarDays,
  Archive,
  Copy,
  Repeat,
  MessageSquare,
  FolderKanban,
  AlertTriangle,
} as const;

export type ViewGridProps<Row> = {
  adapter: EntityAdapter<Row>;
  view: SavedView;
  rows: Row[];
  ctx: ActionContext;
  members?: TableMember[];
  /** Extra ids that count as "me" for assignee filters (workspace member ids). */
  memberIds?: string[];
  /** When set, title/status columns use table Column defs for CellRenderer. */
  cellColumnLookup?: (columnId: string) => Column | undefined;
  onViewChange?(next: SavedView): void;
  onOpenRow?(row: Row): void;
  onCreateRow?(title?: string): void;
  testId?: string;
};

function ActionIcon({ name }: { name: string }) {
  const Cmp = ICON_MAP[name as keyof typeof ICON_MAP] || MoreHorizontal;
  return <Cmp size={14} />;
}

export function ViewGrid<Row>({
  adapter,
  view,
  rows,
  ctx,
  members = [],
  memberIds = [],
  cellColumnLookup,
  onOpenRow,
  onCreateRow,
  testId = "views-grid",
}: ViewGridProps<Row>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draftTitle, setDraftTitle] = useState("");
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  const applied = useMemo(
    () =>
      applyView(rows, adapter, view, {
        userId: ctx.userId,
        memberIds,
      }),
    [rows, adapter, view, ctx.userId, memberIds],
  );

  const visibleColumnDefs = useMemo(() => {
    const byId = new Map(adapter.columns.map((col) => [col.id, col]));
    return view.columns
      .map((entry) => {
        const def = byId.get(entry.id);
        if (!def) return null;
        return { ...def, width: entry.width ?? def.width };
      })
      .filter(Boolean) as typeof adapter.columns;
  }, [adapter.columns, view.columns]);

  const titleCol = visibleColumnDefs.find((col) => col.render === "title" || col.fixed);
  const helper = useMemo(() => createColumnHelper<Row>(), []);

  const columns = useMemo(() => {
    const selectCol = helper.display({
      id: "_select",
      size: 36,
      header: () => {
        const all =
          applied.rows.length > 0 && selected.size === applied.rows.length;
        return (
          <input
            aria-label={t("tables.grid.selectAll")}
            checked={all}
            onChange={(e) => {
              setSelected(
                e.target.checked
                  ? new Set(applied.rows.map((row) => adapter.rowId(row)))
                  : new Set(),
              );
            }}
            type="checkbox"
          />
        );
      },
      cell: ({ row }) => {
        const id = adapter.rowId(row.original);
        return (
          <input
            aria-label={t("tables.grid.selectRow")}
            checked={selected.has(id)}
            onChange={(e) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onClick={(e) => e.stopPropagation()}
            type="checkbox"
          />
        );
      },
    });

    const dataCols = visibleColumnDefs.map((column) =>
      helper.accessor((row: Row) => column.read(row), {
        id: column.id,
        header: () => column.label,
        size: column.width || (column.render === "title" ? 240 : 140),
        cell: ({ row, getValue }) => {
          const tableCol =
            cellColumnLookup?.(column.id) ||
            ({
              id: column.id,
              name: column.label,
              type: column.type,
              options: column.options?.().map((opt) => ({
                id: opt.id,
                label: opt.label,
                tone: (opt.tone as "neutral") || "neutral",
              })),
            } as Column);
          const isTitle = column.render === "title" || column.render === "hierarchy" || column.fixed;
          const depth =
            column.render === "hierarchy" && adapter.parentId?.(row.original)
              ? 1
              : 0;
          return (
            <div
              className={`cw-views-cell${isTitle ? " is-title" : ""}${
                column.render === "hierarchy" ? " is-hierarchy" : ""
              }`}
              onDoubleClick={() => isTitle && onOpenRow?.(row.original)}
              style={depth ? { paddingLeft: depth * 16 } : undefined}
            >
              <CellRenderer
                column={tableCol}
                members={members}
                onChange={(next) => {
                  void column.write?.(row.original, next as RecordValue);
                }}
                value={getValue() as RecordValue}
              />
            </div>
          );
        },
      }),
    );

    const quick = view.quickActions
      .map((id) => adapter.actions.find((action) => action.id === id))
      .filter(Boolean) as ActionDef<Row>[];

    const actionsCol =
      quick.length > 0
        ? [
            helper.display({
              id: "_actions",
              header: () => t("views.actions"),
              size: 120,
              cell: ({ row }) => {
                const rowArr = [row.original];
                return (
                  <div className="cw-views-quick">
                    {quick.map((action) => {
                      const ok = action.canRun(rowArr, ctx);
                      return (
                        <button
                          aria-label={action.label}
                          className={`cw-views-pill${action.danger ? " is-danger" : ""}${
                            ok ? "" : " is-disabled"
                          }`}
                          disabled={!ok}
                          key={action.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void action.run(rowArr, ctx);
                          }}
                          title={action.label}
                          type="button"
                        >
                          <ActionIcon name={action.icon} />
                        </button>
                      );
                    })}
                    <button
                      aria-label="More"
                      className="cw-views-pill"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuRowId(adapter.rowId(row.original));
                      }}
                      type="button"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                );
              },
            }),
          ]
        : [];

    return [selectCol, ...dataCols, ...actionsCol];
  }, [
    adapter,
    applied.rows,
    cellColumnLookup,
    ctx,
    helper,
    members,
    onOpenRow,
    selected,
    view.quickActions,
    visibleColumnDefs,
  ]);

  const reactTable = useReactTable({
    data: applied.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => adapter.rowId(row),
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!focusedRowId) return;
      const row = applied.rows.find((entry) => adapter.rowId(entry) === focusedRowId);
      if (!row) return;
      const key = event.key.toLowerCase();
      const action = adapter.actions.find(
        (entry) => entry.shortcut?.toLowerCase() === key,
      );
      if (!action) return;
      if (!action.canRun([row], ctx)) return;
      event.preventDefault();
      void action.run([row], ctx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adapter, applied.rows, ctx, focusedRowId]);

  const selectedRows = applied.rows.filter((row) => selected.has(adapter.rowId(row)));
  const bulkActions = adapter.actions.filter(
    (action) =>
      (action.kind === "bulk" || action.kind === "both") &&
      action.canRun(selectedRows, ctx),
  );
  const densityClass =
    view.density === "compact" ? "is-compact" : "is-comfortable";

  const menuRow = menuRowId
    ? applied.rows.find((row) => adapter.rowId(row) === menuRowId)
    : null;
  const menuActions = menuRow
    ? adapter.actions.filter(
        (action) =>
          (action.kind === "row" || action.kind === "both") &&
          !view.quickActions.includes(action.id),
      )
    : [];

  return (
    <div className={`cw-views-grid-wrap ${densityClass}`} data-testid={testId}>
      <div className="cw-views-grid-scroll">
        <table className="cw-views-grid">
          <thead>
            {reactTable.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    className={
                      header.column.id === titleCol?.id ? "is-sticky-title" : ""
                    }
                    key={header.id}
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {applied.groups.map((group) => (
              <Fragment key={group.key}>
                {view.groupBy && group.label ? (
                  <tr className="cw-views-group-row">
                    <td colSpan={columns.length}>
                      <span className="cw-views-group-label">{group.label}</span>
                      <span className="cw-views-muted">{group.rows.length}</span>
                    </td>
                  </tr>
                ) : null}
                {group.rows.map((rowData) => {
                  const id = adapter.rowId(rowData);
                  const row = reactTable.getRowModel().rows.find((r) => r.id === id);
                  if (!row) return null;
                  return (
                    <tr
                      className={`${selected.has(id) ? "is-selected" : ""}${
                        focusedRowId === id ? " is-focused" : ""
                      }`}
                      key={id}
                      onClick={(e) => {
                        if (
                          (e.target as HTMLElement).closest(
                            "input,select,button,a,label",
                          )
                        ) {
                          return;
                        }
                        setFocusedRowId(id);
                        onOpenRow?.(rowData);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          className={
                            cell.column.id === titleCol?.id ? "is-sticky-title" : ""
                          }
                          key={cell.id}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {onCreateRow ? (
              <tr className="cw-views-add-row">
                <td colSpan={columns.length}>
                  <form
                    className="cw-views-add-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onCreateRow(draftTitle.trim() || undefined);
                      setDraftTitle("");
                    }}
                  >
                    <Plus size={14} />
                    <input
                      className="cw-views-input"
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder={t("tables.grid.titlePlaceholder")}
                      value={draftTitle}
                    />
                    <button className="cw-views-btn-ghost" type="submit">
                      {t("tables.grid.add")}
                    </button>
                  </form>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {!applied.rows.length ? (
          <div className="cw-views-empty">{t("views.empty")}</div>
        ) : null}
      </div>

      {selectedRows.length > 0 ? (
        <div className="cw-views-bulk-bar" role="toolbar">
          <span>
            {t("tables.grid.selected").replace("{n}", String(selectedRows.length))}
          </span>
          {bulkActions.map((action) => (
            <button
              className={action.danger ? "cw-views-btn-danger" : "cw-views-btn-ghost"}
              key={action.id}
              onClick={() => void action.run(selectedRows, ctx)}
              type="button"
            >
              <ActionIcon name={action.icon} />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      {menuRow ? (
        <div className="cw-views-row-menu" data-testid="views-row-menu">
          {menuActions.map((action) => (
            <button
              disabled={!action.canRun([menuRow], ctx)}
              key={action.id}
              onClick={() => {
                void action.run([menuRow], ctx);
                setMenuRowId(null);
              }}
              type="button"
            >
              <ActionIcon name={action.icon} />
              {action.label}
            </button>
          ))}
          <button onClick={() => setMenuRowId(null)} type="button">
            {t("views.close")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
