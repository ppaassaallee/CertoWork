import type { RecordDoc, TableDoc } from "../../lib/tables";

/** Minimal timeline/Gantt surface by a timeline or start/end date pair. */
export function TableTimelineView(props: {
  table: TableDoc;
  records: RecordDoc[];
  startColumnId: string;
  endColumnId?: string;
  onOpenRecord(id: string): void;
}) {
  const titleCol = props.table.titleColumnId || props.table.keyColumns.title;
  const rows = props.records
    .map((r) => {
      const start = String(r.values[props.startColumnId] || "");
      const end = props.endColumnId ? String(r.values[props.endColumnId] || "") : start;
      return { id: r.id, title: String(r.values[titleCol] || r.title || "Untitled"), start, end };
    })
    .filter((r) => r.start)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="cw-tables-timeline" data-testid="table-timeline" style={{ padding: 12 }}>
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => props.onOpenRecord(r.id)}
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 8,
            width: "100%",
            textAlign: "left",
            border: "none",
            background: "transparent",
            padding: "8px 0",
            borderBottom: "1px solid #ECEEF3",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 13, color: "#1F2430" }}>{r.title}</span>
          <span
            style={{
              height: 18,
              borderRadius: 6,
              background: "rgba(37,71,196,.18)",
              color: "#1E3A8A",
              fontSize: 11,
              padding: "2px 8px",
              alignSelf: "center",
            }}
          >
            {r.start}
            {r.end && r.end !== r.start ? ` → ${r.end}` : ""}
          </span>
        </button>
      ))}
      {!rows.length ? <p style={{ color: "#6B7280", fontSize: 13 }}>No dated records</p> : null}
    </div>
  );
}

/** Simple chart counts by a status/dropdown column. */
export function TableChartView(props: {
  table: TableDoc;
  records: RecordDoc[];
  groupColumnId: string;
}) {
  const col = props.table.columns.find((c) => c.id === props.groupColumnId);
  const counts: Record<string, number> = {};
  for (const r of props.records) {
    const k = String(r.values[props.groupColumnId] ?? "(empty)");
    counts[k] = (counts[k] || 0) + 1;
  }
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="cw-tables-chart" data-testid="table-chart" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: 14 }}>{col?.name || "Chart"}</h3>
      <div style={{ display: "grid", gap: 8 }}>
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "120px 1fr 40px", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12 }}>{k}</span>
            <div style={{ background: "#F7F8FA", borderRadius: 6, height: 16, overflow: "hidden" }}>
              <div style={{ width: `${(v / max) * 100}%`, height: "100%", background: "#2547C4" }} />
            </div>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
