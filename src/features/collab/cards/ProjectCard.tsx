import type { CSSProperties } from "react";
import type { MessageCard } from "../../../lib/collab/types";

const shell: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#1F2430",
  background: "#fff",
};

export function ProjectCard({ card }: { card: MessageCard }) {
  const title = String(card.ref.title || card.ref.name || "Project");
  const stage = card.ref.stage != null ? String(card.ref.stage) : null;
  const health = card.ref.health != null ? String(card.ref.health) : null;

  return (
    <div className="collab-card collab-card-project" data-testid="collab-project-card" style={shell}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#2547C4", marginBottom: 4 }}>Project</div>
      <strong style={{ display: "block", fontSize: 14 }}>{title}</strong>
      {(stage || health) && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#6B7280" }}>
          {[stage, health].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
