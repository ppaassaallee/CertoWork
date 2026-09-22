import type { CSSProperties } from "react";
import type { MessageCard } from "../../../lib/collab/types";

const shell: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#1F2430",
  background: "#fff",
};

export function ItemCard({ card }: { card: MessageCard }) {
  const title = String(card.ref.title || card.ref.name || "Item");
  const status = card.ref.status != null ? String(card.ref.status) : null;
  const due = card.ref.dueDate != null ? String(card.ref.dueDate) : null;
  const id = card.ref.id != null ? String(card.ref.id) : null;

  return (
    <div className="collab-card collab-card-item" data-testid="collab-item-card" style={shell}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#2547C4", marginBottom: 4 }}>Item</div>
      <strong style={{ display: "block", fontSize: 14 }}>{title}</strong>
      {(status || due || id) && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#6B7280" }}>
          {[status, due ? `Due ${due}` : null, id ? `#${id.slice(0, 8)}` : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}
