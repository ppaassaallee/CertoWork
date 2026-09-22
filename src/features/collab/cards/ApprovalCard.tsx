import type { CSSProperties } from "react";
import type { MessageCard } from "../../../lib/collab/types";

const shell: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#1F2430",
  background: "#fff",
};

const btnPrimary: CSSProperties = {
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
  background: "#2547C4",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 6,
  padding: "6px 12px",
  background: "#fff",
  color: "#1F2430",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

export function ApprovalCard({
  card,
  onApprove,
  onDecline,
}: {
  card: MessageCard;
  onApprove?: () => void;
  onDecline?: () => void;
}) {
  const title = String(card.ref.title || card.ref.name || "Approval needed");
  const reason = card.ref.reason != null ? String(card.ref.reason) : card.ref.why != null ? String(card.ref.why) : null;

  return (
    <div className="collab-card collab-card-approval" data-testid="collab-approval-card" style={shell}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#2547C4", marginBottom: 4 }}>Approval</div>
      <strong style={{ display: "block", fontSize: 14 }}>{title}</strong>
      {reason ? <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7280" }}>{reason}</p> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onApprove} style={btnPrimary} type="button">
          Approve
        </button>
        <button onClick={onDecline} style={btnSecondary} type="button">
          Decline
        </button>
      </div>
    </div>
  );
}
