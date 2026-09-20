import { useState } from "react";
import type { Column, RecordValue, TableDoc } from "../../lib/tables";
import {
  exportCsv,
  parseWorkbook,
  previewToColumns,
  rowsToValues,
  type ImportPreview,
} from "../../lib/tables/services/importService";
import { createTable, createRecord } from "../../lib/tables/services/tableService";

export function ImportExportModal(props: {
  workspaceId: string;
  userId: string;
  mode: "import" | "export";
  table?: TableDoc;
  records?: Array<{ values: Record<string, RecordValue> }>;
  onClose(): void;
  onImported?(tableId: string): void;
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (props.mode === "export" && props.table) {
    const csv = exportCsv(
      props.table.columns.filter((c) => !c.hidden),
      (props.records || []).map((r) => r.values),
    );
    return (
      <div className="cw-import-modal" data-testid="export-modal" style={{ padding: 20 }}>
        <h3>Export CSV</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Current view columns · {props.records?.length || 0} rows</p>
        <textarea readOnly value={csv} rows={12} style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            style={{ background: "#2547C4", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px" }}
            onClick={() => {
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${props.table!.name}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download
          </button>
          <button type="button" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cw-import-modal" data-testid="import-modal" style={{ padding: 20, maxWidth: 640 }}>
      <h3>Import from CSV / Excel</h3>
      <input
        type="file"
        accept=".csv,.tsv,.xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void parseWorkbook(file).then((p) => {
            setPreview(p);
            setColumns(previewToColumns(p.inferred));
          });
        }}
      />
      {preview ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13 }}>
            {preview.rows.length} rows · override types below
          </p>
          <div style={{ display: "grid", gap: 6, maxHeight: 240, overflow: "auto" }}>
            {columns.map((col, i) => (
              <div key={col.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ flex: 1, fontSize: 13 }}>{col.name}</span>
                <select
                  value={col.type}
                  onChange={(e) => {
                    const next = [...columns];
                    next[i] = { ...col, type: e.target.value as Column["type"] };
                    setColumns(next);
                  }}
                >
                  {["text", "number", "date", "email", "phone", "status", "people"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {error ? <p style={{ color: "#991B1B", fontSize: 13 }}>{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            style={{ marginTop: 12, background: "#2547C4", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px" }}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  const tableId = await createTable({
                    workspaceId: props.workspaceId,
                    createdBy: props.userId,
                    name: preview.headers[0] ? `Import · ${preview.headers[0]}` : "Imported table",
                    columns,
                    titleColumnId: columns[0]?.id,
                  });
                  const valuesList = rowsToValues(columns, preview.rows);
                  // Cap interactive import; CF chunks larger sets (Step 23).
                  const slice = valuesList.slice(0, 500);
                  const fakeTable = {
                    id: tableId,
                    workspaceId: props.workspaceId,
                    columns,
                    groups: [{ id: "g-default", name: "Main", color: "#2547C4", order: 0 }],
                    titleColumnId: columns[0]?.id,
                    keyColumns: { title: columns[0]?.id || "title" },
                    recordCount: 0,
                  } as TableDoc;
                  for (const values of slice) {
                    await createRecord({ table: fakeTable, createdBy: props.userId, values });
                  }
                  props.onImported?.(tableId);
                  props.onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Import failed");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Importing…" : "Create table"}
          </button>
        </div>
      ) : null}
      <button type="button" onClick={props.onClose} style={{ marginTop: 12 }}>
        Cancel
      </button>
    </div>
  );
}
