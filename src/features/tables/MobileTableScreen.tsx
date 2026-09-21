import { useMemo, useState } from "react";
import type { RecordDoc, RecordValue, TableDoc } from "../../lib/tables";
import { MChip, MFab, MHeader, MListRow, MSegmented, MSheet } from "../../mobile/ui";
import { CellRenderer, type TableMember } from "./cells/RecordCells";

export function MobileTableScreen(props: {
  table: TableDoc;
  records: RecordDoc[];
  members: TableMember[];
  onFieldChange(recordId: string, columnId: string, value: RecordValue): void;
  onOpenRecord(id: string): void;
  onCreateRecord(): void;
  onOpenAutomations?(): void;
}) {
  const [segment, setSegment] = useState("table");
  const [edit, setEdit] = useState<{ recordId: string; columnId: string } | null>(null);
  const titleCol = props.table.titleColumnId || props.table.keyColumns.title;
  const secondary = props.table.columns.filter((c) => c.id !== titleCol && !c.hidden).slice(0, 2);

  const groups = useMemo(() => {
    const map = new Map<string, RecordDoc[]>();
    for (const r of props.records) {
      const g = r.groupId || "g-default";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    }
    return map;
  }, [props.records]);

  const editingRecord = edit ? props.records.find((r) => r.id === edit.recordId) : null;
  const editingCol = edit ? props.table.columns.find((c) => c.id === edit.columnId) : null;

  return (
    <div className="cw-mobile-table" data-testid="mobile-table-screen">
      <MHeader title={props.table.name} subtitle={`${props.records.length} records`} />
      <div style={{ padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <MSegmented
          value={segment}
          onChange={setSegment}
          options={[
            { id: "table", label: "Table" },
            { id: "board", label: "Board" },
            { id: "calendar", label: "Calendar" },
          ]}
        />
        <MChip>Filter</MChip>
        <MChip>Group</MChip>
        {props.onOpenAutomations ? (
          <MChip onClick={props.onOpenAutomations}>Automations</MChip>
        ) : null}
      </div>
      <div style={{ padding: "0 8px 80px" }}>
        {[...groups.entries()].map(([gid, rows]) => {
          const gName = props.table.groups?.find((g) => g.id === gid)?.name || "Main";
          return (
            <section key={gid} style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "8px 12px", fontSize: 13, color: "#6B7280" }}>
                {gName} · {rows.length}
              </h4>
              {rows.map((r) => (
                <MListRow
                  key={r.id}
                  twoLine
                  title={String(r.values[titleCol] ?? r.title ?? "Untitled")}
                  subtitle={secondary
                    .map((c) => String(r.values[c.id] ?? ""))
                    .filter(Boolean)
                    .join(" · ")}
                  onClick={() => props.onOpenRecord(r.id)}
                  meta={
                    <div style={{ display: "flex", gap: 4 }}>
                      {secondary.slice(0, 1).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEdit({ recordId: r.id, columnId: c.id });
                          }}
                          style={{
                            border: "none",
                            background: "rgba(37,71,196,.1)",
                            color: "#1E3A8A",
                            borderRadius: 6,
                            padding: "2px 8px",
                            fontSize: 11,
                          }}
                        >
                          {String(r.values[c.id] ?? c.name)}
                        </button>
                      ))}
                    </div>
                  }
                />
              ))}
            </section>
          );
        })}
      </div>
      <MFab label="New" onClick={props.onCreateRecord} />
      <MSheet open={!!edit} title={editingCol ? `Edit ${editingCol.name}` : "Edit"} onClose={() => setEdit(null)}>
        {editingRecord && editingCol ? (
          <div style={{ padding: 16 }}>
            <CellRenderer
              column={editingCol}
              members={props.members}
              value={editingRecord.values[editingCol.id] ?? null}
              onChange={(next) => {
                props.onFieldChange(editingRecord.id, editingCol.id, next);
                setEdit(null);
              }}
            />
          </div>
        ) : null}
      </MSheet>
    </div>
  );
}
