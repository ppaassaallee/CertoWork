import { Fragment, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Plus, Trash2 } from "../../components/ui/Icon";
import type { RecordDoc, RecordValue, TableDoc } from "../../lib/tables";
import { t } from "../../lib/i18n";
import { CellRenderer, type TableMember } from "./cells/RecordCells";

export type RecordsGridProps = {
  table: TableDoc;
  records: RecordDoc[];
  members: TableMember[];
  onFieldChange(recordId: string, columnId: string, value: RecordValue): void;
  onCreateRecord(title?: string): void;
  onDeleteRecords(ids: string[]): void;
  onOpenRecord(id: string): void;
  groupByStatus?: boolean;
};

const helper = createColumnHelper<RecordDoc>();

export function RecordsGrid({
  table,
  records,
  members,
  onFieldChange,
  onCreateRecord,
  onDeleteRecords,
  onOpenRecord,
  groupByStatus = false,
}: RecordsGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draftTitle, setDraftTitle] = useState("");
  const titleColId = table.keyColumns.title;
  const statusColId = table.keyColumns.status || null;
  const ownerColId = table.keyColumns.owner || null;
  const statusCol = table.columns.find((c) => c.id === statusColId);
  const visibleCols = table.columns.filter((c) => !c.hidden);

  const columns = useMemo(
    () => [
      helper.display({
        id: "_select",
        header: () => {
          const all = records.length > 0 && selected.size === records.length;
          return (
            <input
              type="checkbox"
              aria-label={t("tables.grid.selectAll")}
              checked={all}
              onChange={(e) => {
                setSelected(e.target.checked ? new Set(records.map((r) => r.id)) : new Set());
              }}
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={t("tables.grid.selectRow")}
            checked={selected.has(row.original.id)}
            onChange={(e) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(row.original.id);
                else next.delete(row.original.id);
                return next;
              });
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 36,
      }),
      ...visibleCols.map((column) =>
        helper.accessor((row) => row.values[column.id] ?? null, {
          id: column.id,
          header: () => column.name,
          size: column.width || (column.id === titleColId ? 240 : 140),
          cell: ({ row, getValue }) => {
            const isTitle = column.id === titleColId;
            return (
              <div
                className={`cw-tables-cell ${isTitle ? "is-title" : ""}`}
                onDoubleClick={() => isTitle && onOpenRecord(row.original.id)}
              >
                <CellRenderer
                  column={column}
                  value={getValue() as RecordValue}
                  members={members}
                  onChange={(next) => onFieldChange(row.original.id, column.id, next)}
                />
              </div>
            );
          },
        }),
      ),
    ],
    [visibleCols, members, onFieldChange, onOpenRecord, records, selected, titleColId],
  );

  const sorted = useMemo(() => {
    const rows = [...records].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!groupByStatus || !statusColId) return [{ key: "all", label: "", rows }];
    const groups: Array<{ key: string; label: string; rows: RecordDoc[] }> = [];
    const byStatus = new Map<string, RecordDoc[]>();
    for (const opt of statusCol?.options || []) byStatus.set(opt.id, []);
    byStatus.set("__none__", []);
    for (const row of rows) {
      const key = String(row.values[statusColId] ?? "") || "__none__";
      if (!byStatus.has(key)) byStatus.set(key, []);
      byStatus.get(key)!.push(row);
    }
    for (const [key, groupRows] of byStatus) {
      if (!groupRows.length) continue;
      const label =
        key === "__none__"
          ? t("tables.status.empty")
          : statusCol?.options?.find((o) => o.id === key)?.label || key;
      groups.push({ key, label, rows: groupRows });
    }
    return groups;
  }, [records, groupByStatus, statusColId, statusCol]);

  const flatRows = useMemo(
    () => sorted.flatMap((g) => g.rows),
    [sorted],
  );

  const reactTable = useReactTable({
    data: flatRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const selectedIds = [...selected];
  const bulkStatus = statusCol?.options || [];

  const submitNew = () => {
    const title = draftTitle.trim();
    onCreateRecord(title || undefined);
    setDraftTitle("");
  };

  return (
    <div className="cw-tables-grid-wrap" data-testid="tables-grid">
      <div className="cw-tables-grid-scroll">
        <table className="cw-tables-grid">
          <thead>
            {reactTable.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={header.column.id === titleColId ? "is-sticky-title" : ""}
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {sorted.map((group) => (
              <Fragment key={group.key}>
                {groupByStatus && group.label ? (
                  <tr className="cw-tables-group-row">
                    <td colSpan={columns.length}>
                      <span className="cw-tables-group-label">{group.label}</span>
                      <span className="cw-tables-muted">{group.rows.length}</span>
                    </td>
                  </tr>
                ) : null}
                {group.rows.map((record) => {
                  const row = reactTable.getRowModel().rows.find((r) => r.id === record.id);
                  if (!row) return null;
                  return (
                    <tr
                      key={record.id}
                      className={selected.has(record.id) ? "is-selected" : ""}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("input,select,button,a,label")) return;
                        onOpenRecord(record.id);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cell.column.id === titleColId ? "is-sticky-title" : ""}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            <tr className="cw-tables-add-row">
              <td colSpan={columns.length}>
                <form
                  className="cw-tables-add-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitNew();
                  }}
                >
                  <Plus size={14} />
                  <span className="cw-tables-add-label">{t("tables.grid.newRow")}</span>
                  <input
                    className="cw-tables-input"
                    placeholder={t("tables.grid.titlePlaceholder")}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                  />
                  <button type="submit" className="cw-tables-btn-ghost">
                    {t("tables.grid.add")}
                  </button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
        {!records.length ? (
          <div className="cw-tables-empty">{t("tables.empty.records")}</div>
        ) : null}
      </div>

      {selectedIds.length > 0 ? (
        <div className="cw-tables-bulk-bar" role="toolbar">
          <span className="cw-tables-bulk-count">
            {t("tables.grid.selected").replace("{n}", String(selectedIds.length))}
          </span>
          {statusColId && bulkStatus.length ? (
            <label className="cw-tables-bulk-field">
              <span>{t("tables.key.status")}</span>
              <select
                className="cw-tables-select"
                defaultValue=""
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  for (const id of selectedIds) onFieldChange(id, statusColId, next);
                  e.target.value = "";
                }}
              >
                <option value="">{t("tables.grid.setStatus")}</option>
                {bulkStatus.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {ownerColId ? (
            <label className="cw-tables-bulk-field">
              <span>{t("tables.key.owner")}</span>
              <select
                className="cw-tables-select"
                defaultValue=""
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  for (const id of selectedIds) onFieldChange(id, ownerColId, next);
                  e.target.value = "";
                }}
              >
                <option value="">{t("tables.grid.setOwner")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="cw-tables-btn-danger"
            onClick={() => {
              onDeleteRecords(selectedIds);
              setSelected(new Set());
            }}
          >
            <Trash2 size={14} />
            {t("tables.grid.delete")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
