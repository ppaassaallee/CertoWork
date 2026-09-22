import { useMemo, useRef, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Column, RecordDoc, RecordValue, TableDoc, TableGroup } from "../../lib/tables";
import { footerSummary } from "../../lib/tables";
import { softTintToCss } from "../../lib/tables/extendedTypes";
import { CellRenderer, type TableMember } from "./cells/RecordCells";

export type TableGroupedGridProps = {
  table: TableDoc;
  records: RecordDoc[];
  members: TableMember[];
  projects?: Array<{ id: string; name: string }>;
  onOpenProject?(projectId: string): void;
  density?: "compact" | "comfortable";
  onFieldChange(recordId: string, columnId: string, value: RecordValue): void;
  onOpenRecord(id: string): void;
  onCreateRecord(groupId: string): void;
  onRenameGroup?(groupId: string, name: string): void;
};

function formatMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${n.toLocaleString()}`;
  }
}

function DistributionBar({
  counts,
  options,
}: {
  counts: Record<string, number>;
  options?: Column["options"] | Column["config"];
}) {
  const opts =
    (Array.isArray(options) ? options : null) ||
    (options && "options" in (options as object)
      ? (options as { options?: Array<{ id: string; label: string; color?: string }> }).options
      : []) ||
    [];
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="cw-tables-dist" title={JSON.stringify(counts)} style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", minWidth: 80 }}>
      {Object.entries(counts).map(([k, v]) => {
        const opt = opts.find((o) => o.id === k || o.label === k);
        const tint = softTintToCss((opt as { color?: "gray" })?.color || "gray");
        return (
          <div
            key={k}
            style={{ width: `${(v / total) * 100}%`, background: tint.bg, borderRight: "1px solid #fff" }}
            title={`${k}: ${v}`}
          />
        );
      })}
    </div>
  );
}

function SummaryCell({ column, records }: { column: Column; records: RecordDoc[] }) {
  const result = footerSummary(records, column);
  if (result.kind === "none") return <span />;
  if (result.kind === "distribution") {
    return (
      <DistributionBar
        counts={(result.value as Record<string, number>) || {}}
        options={column.options || column.config}
      />
    );
  }
  if (result.kind === "sum" || result.kind === "avg" || result.kind === "min" || result.kind === "max") {
    const currency = column.config?.currency || column.currency || "USD";
    const n = Number(result.value);
    if (column.type === "number" || column.type === "currency" || column.config?.format === "currency") {
      return <span className="cw-tables-sum" style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{formatMoney(n, currency)}</span>;
    }
    return <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{n}</span>;
  }
  return <span style={{ fontSize: 12, color: "#6B7280" }}>{String(result.value ?? "")}</span>;
}

export function TableGroupedGrid({
  table,
  records,
  members,
  projects = [],
  onOpenProject,
  density = "compact",
  onFieldChange,
  onOpenRecord,
  onCreateRecord,
  onRenameGroup,
}: TableGroupedGridProps) {
  const groups: TableGroup[] = useMemo(() => {
    const g = [...(table.groups || [])].sort((a, b) => a.order - b.order);
    if (!g.length) return [{ id: "g-default", name: "Main", color: "#2547C4", order: 0 }];
    return g;
  }, [table.groups]);

  const visibleCols = useMemo(
    () => (table.columns || []).filter((c) => !c.hidden),
    [table.columns],
  );
  const titleColId = table.titleColumnId || table.keyColumns?.title || visibleCols[0]?.id;

  const parentRef = useRef<HTMLDivElement>(null);
  const flatRows = useMemo(() => {
    const out: Array<
      | { kind: "header"; group: TableGroup; count: number }
      | { kind: "row"; record: RecordDoc; groupId: string }
      | { kind: "add"; groupId: string }
      | { kind: "footer"; group: TableGroup; records: RecordDoc[] }
      | { kind: "total"; records: RecordDoc[] }
    > = [];
    for (const group of groups) {
      const rows = records
        .filter((r) => (r.groupId || "g-default") === group.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      out.push({ kind: "header", group, count: rows.length });
      for (const record of rows) out.push({ kind: "row", record, groupId: group.id });
      out.push({ kind: "add", groupId: group.id });
      out.push({ kind: "footer", group, records: rows });
    }
    out.push({ kind: "total", records });
    return out;
  }, [groups, records]);

  const rowH = density === "compact" ? 36 : 44;
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const row = flatRows[i];
      if (row?.kind === "header") return 40;
      if (row?.kind === "footer" || row?.kind === "total") return 32;
      if (row?.kind === "add") return 36;
      return rowH;
    },
    overscan: 12,
  });

  return (
    <div className="cw-tables-grouped" data-testid="table-grouped-grid" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div
        ref={parentRef}
        style={{ overflow: "auto", flex: 1, border: "1px solid #ECEEF3", borderRadius: 8, background: "#fff" }}
      >
        <div style={{ display: "grid", gridTemplateColumns: `40px minmax(200px, 1.4fr) repeat(${Math.max(visibleCols.length - 1, 0)}, minmax(120px, 1fr))`, position: "sticky", top: 0, zIndex: 2, background: "#F7F8FA", borderBottom: "1px solid #ECEEF3" }}>
          <div style={{ padding: 8 }} />
          {visibleCols.map((col) => (
            <div key={col.id} style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "#1F2430", borderLeft: "1px solid #ECEEF3" }}>
              {col.name}
            </div>
          ))}
        </div>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const item = flatRows[vRow.index];
            const style: CSSProperties = {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: vRow.size,
              transform: `translateY(${vRow.start}px)`,
              display: "grid",
              gridTemplateColumns: `40px minmax(200px, 1.4fr) repeat(${Math.max(visibleCols.length - 1, 0)}, minmax(120px, 1fr))`,
              alignItems: "center",
              borderBottom: "1px solid #ECEEF3",
            };
            if (item.kind === "header") {
              return (
                <div key={vRow.key} style={{ ...style, background: "#F7F8FA", fontWeight: 600 }}>
                  <div style={{ height: "100%", width: 4, background: item.group.color, marginLeft: 8 }} />
                  <div style={{ gridColumn: `span ${visibleCols.length}`, padding: "0 10px", display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      defaultValue={item.group.name}
                      onBlur={(e) => onRenameGroup?.(item.group.id, e.target.value)}
                      style={{ border: "none", background: "transparent", fontWeight: 600, fontSize: 13, color: "#1F2430", minWidth: 120 }}
                    />
                    <span style={{ fontSize: 12, color: "#6B7280" }}>{item.count}</span>
                    <button type="button" onClick={() => onCreateRecord(item.group.id)} style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#2547C4", cursor: "pointer" }}>+
                    </button>
                  </div>
                </div>
              );
            }
            if (item.kind === "add") {
              return (
                <div key={vRow.key} style={style}>
                  <div />
                  <div style={{ gridColumn: `span ${visibleCols.length}`, padding: "0 10px" }}>
                    <button
                      type="button"
                      onClick={() => onCreateRecord(item.groupId)}
                      style={{ border: "none", background: "transparent", color: "#6B7280", cursor: "pointer", fontSize: 13 }}
                    >
                      + Add {table.nounSingular || "record"}
                    </button>
                  </div>
                </div>
              );
            }
            if (item.kind === "footer" || item.kind === "total") {
              return (
                <div key={vRow.key} style={{ ...style, background: item.kind === "total" ? "#F7F8FA" : "#fff", fontSize: 12 }}>
                  <div />
                  {visibleCols.map((col, i) => (
                    <div key={col.id} style={{ padding: "0 10px", borderLeft: i ? "1px solid #ECEEF3" : undefined }}>
                      {i === 0 && item.kind === "total" ? <strong>Total</strong> : null}
                      {i === 0 && item.kind === "footer" ? <span style={{ color: "#9CA3AF" }}>Sum</span> : null}
                      <SummaryCell column={col} records={item.records} />
                    </div>
                  ))}
                </div>
              );
            }
            const rec = item.record;
            return (
              <div
                key={vRow.key}
                style={{ ...style, background: "#fff" }}
                data-record-id={rec.id}
              >
                <div style={{ paddingLeft: 10 }}>
                  <input type="checkbox" aria-label="Select row" />
                </div>
                {visibleCols.map((col) => {
                  const isTitle = col.id === titleColId;
                  const value = (rec.computed?.[col.id] as RecordValue) ?? rec.values[col.id] ?? null;
                  return (
                    <div
                      key={col.id}
                      style={{ padding: "0 6px", borderLeft: "1px solid #ECEEF3", minHeight: rowH, display: "flex", alignItems: "center" }}
                      onDoubleClick={() => isTitle && onOpenRecord(rec.id)}
                    >
                      {isTitle ? (
                        <button
                          type="button"
                          onClick={() => onOpenRecord(rec.id)}
                          style={{ border: "none", background: "transparent", color: "#2547C4", cursor: "pointer", textAlign: "left", fontWeight: 500 }}
                        >
                          {String(value ?? "Untitled")}
                        </button>
                      ) : (
                        <CellRenderer
                          column={col}
                          members={members}
                          projects={projects}
                          onOpenProject={onOpenProject}
                          value={value}
                          onChange={(next) => onFieldChange(rec.id, col.id, next)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
