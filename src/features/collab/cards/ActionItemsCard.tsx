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
  padding: "4px 10px",
  background: "#2547C4",
  color: "#fff",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  border: "1px solid #ECEEF3",
  borderRadius: 6,
  padding: "4px 10px",
  background: "#fff",
  color: "#1F2430",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

export type ActionItemRow = {
  id?: string;
  title?: string;
  text?: string;
  [key: string]: unknown;
};

export function ActionItemsCard({
  card,
  onCreateItem,
  onDismiss,
}: {
  card: MessageCard;
  onCreateItem?: (item: ActionItemRow, index: number) => void;
  onDismiss?: (item: ActionItemRow, index: number) => void;
}) {
  const raw = card.ref.items;
  const items: ActionItemRow[] = Array.isArray(raw)
    ? (raw as ActionItemRow[])
    : [];

  return (
    <div
      className="collab-card collab-card-action-items"
      data-testid="collab-action-items-card"
      style={shell}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "#2547C4", marginBottom: 4 }}>
        Action items
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>No action items.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item, index) => {
            const label = String(item.title || item.text || `Item ${index + 1}`);
            return (
              <li
                key={String(item.id || index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 0",
                  borderTop: index ? "1px solid #ECEEF3" : undefined,
                }}
              >
                <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
                <button onClick={() => onCreateItem?.(item, index)} style={btnPrimary} type="button">
                  Create
                </button>
                <button onClick={() => onDismiss?.(item, index)} style={btnGhost} type="button">
                  Dismiss
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
