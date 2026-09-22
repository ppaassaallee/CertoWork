import { useMemo, useState } from "react";
import { useMobileHeader } from "../MobileChromeContext";
import { MButton, MEmpty, MListRow, MSegmented } from "../ui";
import { formatDateRelative } from "../../shared/formatDate";

type Seg = "messages" | "needs" | "mentions" | "updates";

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

export type InboxConversation = {
  id: string;
  title: string;
  preview?: string;
  unread?: boolean;
  onOpen?: () => void;
};

export function PhoneInbox({
  rows,
  conversations,
  onMarkAllRead,
}: {
  rows: InboxRow[];
  /** Optional Collab conversations for the Messages segment. */
  conversations?: InboxConversation[];
  onMarkAllRead?: () => void;
}) {
  const hasMessages = Array.isArray(conversations);
  const [seg, setSeg] = useState<Seg>(hasMessages ? "messages" : "needs");
  useMobileHeader({ title: "Inbox" });

  const filtered = useMemo(() => {
    if (seg === "messages") return [];
    if (seg === "needs")
      return rows.filter((r) => r.kind === "approval" || r.kind === "request" || r.kind === "other");
    if (seg === "mentions") return rows.filter((r) => r.kind === "mention");
    return rows.filter((r) => r.kind === "update");
  }, [rows, seg]);

  const messageRows = conversations || [];

  const options = [
    ...(hasMessages ? [{ id: "messages" as const, label: "Messages" }] : []),
    { id: "needs" as const, label: "Needs action" },
    { id: "mentions" as const, label: "Mentions" },
    { id: "updates" as const, label: "Updates" },
  ];

  return (
    <div className="m-phone-pad" data-testid="phone-inbox">
      <MSegmented
        onChange={(id) => setSeg(id as Seg)}
        options={options}
        value={seg === "messages" && !hasMessages ? "needs" : seg}
      />
      <div style={{ marginTop: 8 }}>
        {onMarkAllRead && seg !== "messages" ? (
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
        {seg === "messages" ? (
          <>
            {messageRows.map((row) => (
              <MListRow
                key={row.id}
                leading={row.unread ? <span className="m-sem m-sem-r" /> : <span style={{ width: 8 }} />}
                onClick={row.onOpen}
                subtitle={row.preview}
                title={row.title}
                twoLine
              />
            ))}
            {!messageRows.length ? <MEmpty title="No messages yet." /> : null}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
