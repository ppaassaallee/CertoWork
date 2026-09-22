import type { CSSProperties } from "react";
import type { MessageCard } from "../../../lib/collab/types";

const shell: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#1F2430",
  background: "#fff",
};

export function InvoiceCard({ card }: { card: MessageCard }) {
  const title = String(card.ref.title || card.ref.number || card.ref.name || "Invoice");
  const status = card.ref.status != null ? String(card.ref.status) : null;
  const amount = card.ref.amount != null ? String(card.ref.amount) : null;
  const currency = card.ref.currency != null ? String(card.ref.currency) : "";

  return (
    <div className="collab-card collab-card-invoice" data-testid="collab-invoice-card" style={shell}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#2547C4", marginBottom: 4 }}>Invoice</div>
      <strong style={{ display: "block", fontSize: 14 }}>{title}</strong>
      {(amount || status) && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#6B7280" }}>
          {[amount ? `${currency ? `${currency} ` : ""}${amount}` : null, status]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}
