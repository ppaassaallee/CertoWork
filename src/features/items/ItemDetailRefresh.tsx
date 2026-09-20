import { useState } from "react";
import { DButton, DPill, DSegmented, DSheet } from "../../desktop/ui";
import "../../desktop/ui/desktop-ui.css";

export type ItemDetailModel = {
  id: string;
  title: string;
  status?: string;
  labels?: string[];
  priority?: string;
  assignees?: string[];
  due?: string | null;
  dueLabel?: string;
  overdue?: boolean;
  description?: string;
  commentCount?: number;
  comments?: Array<{ id: string; author: string; text: string; at?: string }>;
};

export function ItemDetailRefresh({
  item,
  open,
  onClose,
  onComplete,
  onSummarize,
}: {
  item: ItemDetailModel | null;
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onSummarize?: () => Promise<string>;
}) {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [streaming, setStreaming] = useState(false);

  if (!item) return null;

  return (
    <DSheet
      footer={
        <DButton onClick={onComplete}>Mark completed</DButton>
      }
      onClose={onClose}
      open={open}
      title={item.title}
    >
      <DSegmented
        onChange={setTab}
        options={[
          { id: "overview", label: "Overview" },
          { id: "comments", label: `Comments (${item.commentCount || item.comments?.length || 0})` },
        ]}
        value={tab}
      />
      {tab === "overview" ? (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>{item.title}</h2>
          <dl className="inv-props">
            <div>
              <dt>Status</dt>
              <dd>
                <DPill>{item.status || "Open"}</DPill>
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>
                <DPill
                  tone={
                    (item.priority || "").toLowerCase() === "critical"
                      ? "overdue"
                      : (item.priority || "").toLowerCase() === "high"
                        ? "overdue"
                        : "neutral"
                  }
                >
                  {item.priority || "Not set"}
                </DPill>
              </dd>
            </div>
            <div>
              <dt>Deadline</dt>
              <dd className={item.overdue ? "due-bad" : undefined}>
                {item.dueLabel || item.due || "—"}
              </dd>
            </div>
          </dl>
          <button
            className="d-ask-ody"
            disabled={streaming}
            onClick={async () => {
              setStreaming(true);
              try {
                const text = onSummarize
                  ? await onSummarize()
                  : `Summary of ${item.title}: ${item.description || "No description."}`;
                setSummary(text);
                setSummaryOpen(true);
              } finally {
                setStreaming(false);
              }
            }}
            type="button"
          >
            {streaming ? "Asking Odysseus…" : "Ask Odysseus to summarize"}
          </button>
          {summary ? (
            <div style={{ marginTop: 10, border: "1px solid var(--c-line)", borderRadius: 10, padding: 10 }}>
              <button
                onClick={() => setSummaryOpen((o) => !o)}
                style={{ border: 0, background: "transparent", fontWeight: 600, color: "var(--c-blue)" }}
                type="button"
              >
                {summaryOpen ? "Collapse summary" : "Expand summary"}
              </button>
              {summaryOpen ? <p style={{ margin: "8px 0 0", fontSize: 13 }}>{summary}</p> : null}
            </div>
          ) : null}
          {item.description ? (
            <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{item.description}</div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", minHeight: 280 }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            {(item.comments || []).map((c) => (
              <div key={c.id} style={{ marginBottom: 10, fontSize: 13 }}>
                <strong>{c.author}</strong>
                <p style={{ margin: "4px 0 0" }}>{c.text}</p>
              </div>
            ))}
            {!item.comments?.length ? <p style={{ color: "var(--c-ink-2)" }}>No comments yet.</p> : null}
          </div>
          <input
            aria-label="Add comment"
            placeholder="Write a comment…"
            style={{
              marginTop: 8,
              border: "1px solid var(--c-line)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          />
        </div>
      )}
    </DSheet>
  );
}
