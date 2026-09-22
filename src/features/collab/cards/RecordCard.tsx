import type { CSSProperties } from "react";
import type { MessageCard } from "../../../lib/collab/types";

const shell: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#1F2430",
  background: "#fff",
};

export function RecordCard({ card }: { card: MessageCard }) {
  const title = String(card.ref.title || card.ref.name || card.ref.label || "Record");
  const tableName = card.ref.tableName != null ? String(card.ref.tableName) : null;
  const tableId = card.ref.tableId != null ? String(card.ref.tableId) : null;

  return (
    <div className="collab-card collab-card-record" data-testid="collab-record-card" style={shell}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#2547C4", marginBottom: 4 }}>
        {tableName || "Record"}
      </div>
      <strong style={{ display: "block", fontSize: 14 }}>{title}</strong>
      {tableId && !tableName ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#6B7280" }}>Table {tableId.slice(0, 8)}</div>
      ) : null}
    </div>
  );
}
