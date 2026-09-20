import { useMemo, useState } from "react";
import { useMobileHeader } from "../MobileChromeContext";
import { MButton, MEmpty, MListRow, MSegmented } from "../ui";
import { formatDateRelative } from "../../shared/formatDate";

type Seg = "needs" | "mentions" | "updates";

export type InboxRow = {
  id: string;
  title: string;
  subtitle?: string;
  when?: unknown;
  kind: "approval" | "request" | "mention" | "update" | "other";
  unread?: boolean;
  onOpen?: () => void;
  onApprove?: () => void;
  onDecline?: () => void;
};

export function PhoneInbox({
  rows,
  onMarkAllRead,
}: {
  rows: InboxRow[];
  onMarkAllRead?: () => void;
}) {
  const [seg, setSeg] = useState<Seg>("needs");
  useMobileHeader({ title: "Inbox" });

  const filtered = useMemo(() => {
    if (seg === "needs")
      return rows.filter((r) => r.kind === "approval" || r.kind === "request" || r.kind === "other");
    if (seg === "mentions") return rows.filter((r) => r.kind === "mention");
    return rows.filter((r) => r.kind === "update");
  }, [rows, seg]);

  return (
    <div className="m-phone-pad" data-testid="phone-inbox">
      <MSegmented
        onChange={(id) => setSeg(id as Seg)}
        options={[
          { id: "needs", label: "Needs action" },
          { id: "mentions", label: "Mentions" },
          { id: "updates", label: "Updates" },
        ]}
        value={seg}
      />
      <div style={{ marginTop: 8 }}>
        {onMarkAllRead ? (
          <button
            onClick={onMarkAllRead}
            style={{
              border: 0,
              background: "none",
              color: "var(--c-blue)",
              fontWeight: 600,
              marginBottom: 8,
            }}
            type="button"
          >
            Mark all read
          </button>
        ) : null}
        {filtered.map((row) => (
          <div key={row.id}>
            <MListRow
              leading={row.unread ? <span className="m-sem m-sem-r" /> : <span style={{ width: 8 }} />}
              meta={formatDateRelative(row.when as never)}
              onClick={row.onOpen}
              subtitle={row.subtitle}
              title={row.title}
              twoLine
            />
            {row.onApprove ? (
              <div style={{ display: "flex", gap: 8, padding: "0 14px 10px" }}>
                <MButton onClick={row.onApprove} size="sm">
                  Approve
                </MButton>
                {row.onDecline ? (
                  <MButton onClick={row.onDecline} size="sm" variant="secondary">
                    Decline
                  </MButton>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
        {!filtered.length ? (
          <MEmpty
            title={
              seg === "needs"
                ? "Nothing needs your action."
                : seg === "mentions"
                  ? "No mentions yet."
                  : "No updates yet."
            }
          />
        ) : null}
      </div>
    </div>
  );
}
