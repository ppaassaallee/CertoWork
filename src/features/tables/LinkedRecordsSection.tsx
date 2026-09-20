import { useEffect, useState } from "react";
import { listLinkedRecords, type EntityRef } from "../../lib/tables/services/linkService";

/** Shows table records linked to an item / note / project / invoice. */
export function LinkedRecordsSection(props: {
  workspaceId: string;
  entity: EntityRef;
  onOpenRecord?(recordId: string, tableId: string): void;
}) {
  const [rows, setRows] = useState<Array<{ recordId: string; tableId: string; title?: string }>>(
    [],
  );
  useEffect(() => {
    let live = true;
    void listLinkedRecords(props.workspaceId, props.entity).then((r) => {
      if (live) setRows(r);
    });
    return () => {
      live = false;
    };
  }, [props.workspaceId, props.entity.type, props.entity.id]);

  if (!rows.length) return null;
  return (
    <section className="cw-linked-records" style={{ marginTop: 12 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#1F2430" }}>Linked records</h4>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((r) => (
          <li key={r.recordId}>
            <button
              type="button"
              className="cw-link-btn"
              style={{
                background: "transparent",
                border: "none",
                color: "#2547C4",
                cursor: "pointer",
                padding: "4px 0",
                fontSize: 13,
              }}
              onClick={() => props.onOpenRecord?.(r.recordId, r.tableId)}
            >
              ▦ {r.title || r.recordId}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
