import type { CSSProperties } from "react";
import type { MessageCard } from "../../../lib/collab/types";

const shell: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#1F2430",
  background: "#fff",
};

export function SignalCardEmbed({ card }: { card: MessageCard }) {
  const title = String(card.ref.title || "Signal");
  const body = card.ref.body != null ? String(card.ref.body) : null;
  const kind = card.ref.kind != null ? String(card.ref.kind) : null;
  const severity = card.ref.severity != null ? String(card.ref.severity) : null;

  return (
    <div className="collab-card collab-card-signal" data-testid="collab-signal-card" style={shell}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#2547C4", marginBottom: 4 }}>
        {[kind || "Signal", severity].filter(Boolean).join(" · ")}
      </div>
      <strong style={{ display: "block", fontSize: 14 }}>{title}</strong>
      {body ? <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7280" }}>{body}</p> : null}
    </div>
  );
}
