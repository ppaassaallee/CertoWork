import type { CSSProperties } from "react";
import type { MessageCard } from "../../../lib/collab/types";

const shell: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#1F2430",
  background: "#fff",
};

export function BriefCard({ card }: { card: MessageCard }) {
  const headline = String(card.ref.headline || card.ref.title || "Daily brief");
  const summary = card.ref.summary != null ? String(card.ref.summary) : null;

  return (
    <div className="collab-card collab-card-brief" data-testid="collab-brief-card" style={shell}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#2547C4", marginBottom: 4 }}>Brief</div>
      <strong style={{ display: "block", fontSize: 14 }}>{headline}</strong>
      {summary ? <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7280" }}>{summary}</p> : null}
    </div>
  );
}
