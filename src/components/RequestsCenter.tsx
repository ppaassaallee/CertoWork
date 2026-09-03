import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Inbox,
  Link2,
  MessageSquare,
  Plus,
  Send,
  Ticket,
  User,
} from "./ui/Icon";
import {
  TICKET_STATUSES,
  WAITING_REASONS,
  mapTicketStatusToWorkStatus,
  ticketStatusLabel,
  toCustomerStatus,
  type TicketStatus,
} from "../lib/captureRequests";

type Props = {
  section: "inbox" | "mine" | "waiting" | "resolved" | "new";
  tickets: any[];
  allTasks?: any[];
  viewerId?: string;
  viewerName?: string;
  selectedId?: string | null;
  messages?: any[];
  onSelect: (id: string | null) => void;
  onCreateTicket: (input: {
    title: string;
    description: string;
    requesterEmail?: string;
    priority?: string;
  }) => Promise<void> | void;
  onUpdateTicket: (id: string, patch: Record<string, unknown>) => Promise<void> | void;
  onSendMessage: (ticketId: string, body: string, visibility: "public" | "internal") => Promise<void> | void;
  onCreateRelatedWork: (ticketId: string, kind: "pbi" | "bug" | "task" | "issue") => Promise<void> | void;
  onChangeSection: (section: Props["section"]) => void;
  onCopyPortalLink?: (ticket: any) => void;
  onEnsurePortal?: (ticket: any) => Promise<void> | void;
  onOpenRelatedWork?: (id: string) => void;
};

function titleOf(item: any) {
  return String(item?.title || item?.name || "Untitled").trim() || "Untitled";
}

function ticketStatusOf(item: any): TicketStatus {
  const raw = String(item?.ticketStatus || "").toLowerCase();
  if (TICKET_STATUSES.includes(raw as TicketStatus)) return raw as TicketStatus;
  const status = String(item?.status || "").toLowerCase();
  if (status === "done" || status === "completed") return "resolved";
  if (status === "blocked" || status === "waiting") return "waiting";
  if (status === "in_progress" || status === "in_review") return "in_progress";
  return "new";
}

export function RequestsCenter({
  section,
  tickets,
  allTasks = [],
  viewerId,
  viewerName,
  selectedId,
  messages = [],
  onSelect,
  onCreateTicket,
  onUpdateTicket,
  onSendMessage,
  onCreateRelatedWork,
  onChangeSection,
  onCopyPortalLink,
  onEnsurePortal,
  onOpenRelatedWork,
}: Props) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftRequester, setDraftRequester] = useState("");
  const [reply, setReply] = useState("");
  const [replyMode, setReplyMode] = useState<"public" | "internal">("public");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return tickets.filter((item) => {
      const status = ticketStatusOf(item);
      if (section === "new") return status === "new";
      if (section === "waiting") return status === "waiting";
      if (section === "resolved") return status === "resolved" || status === "closed";
      if (section === "mine") {
        const ids = Array.isArray(item.assigneeIds) ? item.assigneeIds.map(String) : [];
        return Boolean(viewerId && (ids.includes(viewerId) || item.ownerId === viewerId || item.assigneeId === viewerId));
      }
      return status === "new" || status === "in_progress" || status === "waiting";
    });
  }, [section, tickets, viewerId]);

  const selected = filtered.find((item) => item.id === selectedId) || tickets.find((item) => item.id === selectedId) || null;
  const selectedMessages = messages.filter((message) => message.workItemId === selected?.id);

  const create = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      await onCreateTicket({
        title,
        description: draftBody.trim(),
        requesterEmail: draftRequester.trim() || undefined,
        priority: "2",
      });
      setDraftTitle("");
      setDraftBody("");
      setDraftRequester("");
      onChangeSection("inbox");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!selected?.id || !reply.trim()) return;
    setBusy(true);
    try {
      await onSendMessage(selected.id, reply.trim(), replyMode);
      setReply("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="do-requests" data-testid="requests-center">
      <header className="do-requests-head">
        <div>
          <strong>Requests</strong>
          <span>Simple tickets for inbound work — not a separate help desk.</span>
        </div>
        <div className="do-requests-tabs" role="tablist" aria-label="Request views">
          {([
            ["inbox", "Inbox"],
            ["mine", "Mine"],
            ["waiting", "Waiting"],
            ["resolved", "Resolved"],
            ["new", "New request"],
          ] as const).map(([id, label]) => (
            <button
              aria-selected={section === id}
              className={section === id ? "is-active" : ""}
              data-testid={`requests-tab-${id}`}
              key={id}
              onClick={() => onChangeSection(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {section === "new" ? (
        <section className="do-requests-create" data-testid="requests-create">
          <label>
            Short title
            <input
              aria-label="Ticket title"
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="What needs help?"
              value={draftTitle}
            />
          </label>
          <label>
            Requester email
            <input
              aria-label="Requester email"
              onChange={(event) => setDraftRequester(event.target.value)}
              placeholder="optional@company.com"
              value={draftRequester}
            />
          </label>
          <label>
            What happened?
            <textarea
              aria-label="Ticket description"
              onChange={(event) => setDraftBody(event.target.value)}
              placeholder="Enough detail to act — Certo AI can refine later."
              rows={5}
              value={draftBody}
            />
          </label>
          <button className="do-button do-button-dark" disabled={busy || !draftTitle.trim()} onClick={() => void create()} type="button">
            <Plus size={14} /> Create ticket
          </button>
        </section>
      ) : (
        <div className="do-requests-layout">
          <div className="do-requests-list" data-testid="requests-list">
            {filtered.map((item) => {
              const status = ticketStatusOf(item);
              return (
                <button
                  className={`do-requests-row ${selected?.id === item.id ? "is-selected" : ""}`}
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  <Ticket size={14} />
                  <span>
                    <strong>{titleOf(item)}</strong>
                    <em>{item.requesterName || item.requesterEmail || "Unknown requester"}</em>
                  </span>
                  <small className={`is-${status}`}>{ticketStatusLabel(status)}</small>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <div className="do-requests-empty">
                <Inbox size={22} />
                <strong>No requests here</strong>
                <span>New email and form tickets land in Inbox.</span>
              </div>
            ) : null}
          </div>

          <div className="do-requests-detail" data-testid="requests-detail">
            {!selected ? (
              <div className="do-requests-empty">
                <MessageSquare size={22} />
                <strong>Select a request</strong>
                <span>Reply to the requester or leave an internal note.</span>
              </div>
            ) : (
              <>
                <header>
                  <div>
                    <small>{selected.key || selected.id}</small>
                    <h2>{titleOf(selected)}</h2>
                    <p>{toCustomerStatus(selected)}</p>
                  </div>
                  <div className="do-requests-status-fields">
                    <label>
                      Status
                      <select
                        aria-label="Ticket status"
                        onChange={(event) => {
                          const ticketStatus = event.target.value as TicketStatus;
                          void onUpdateTicket(selected.id, {
                            ticketStatus,
                            status: mapTicketStatusToWorkStatus(ticketStatus),
                            waitingReason:
                              ticketStatus === "waiting"
                                ? selected.waitingReason || WAITING_REASONS[0]
                                : null,
                            customerStatus: toCustomerStatus({
                              ...selected,
                              ticketStatus,
                              waitingReason:
                                ticketStatus === "waiting"
                                  ? selected.waitingReason || WAITING_REASONS[0]
                                  : null,
                            }),
                          });
                        }}
                        value={ticketStatusOf(selected)}
                      >
                        {TICKET_STATUSES.map((status) => (
                          <option key={status} value={status}>{ticketStatusLabel(status)}</option>
                        ))}
                      </select>
                    </label>
                    {ticketStatusOf(selected) === "waiting" ? (
                      <label>
                        Waiting reason
                        <select
                          aria-label="Waiting reason"
                          data-testid="requests-waiting-reason"
                          onChange={(event) => {
                            const waitingReason = event.target.value;
                            void onUpdateTicket(selected.id, {
                              waitingReason,
                              ticketStatus: "waiting",
                              status: "blocked",
                              customerStatus: toCustomerStatus({
                                ...selected,
                                ticketStatus: "waiting",
                                waitingReason,
                              }),
                            });
                          }}
                          value={selected.waitingReason || WAITING_REASONS[0]}
                        >
                          {WAITING_REASONS.map((reason) => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </header>

                <div className="do-requests-meta">
                  <span><User size={13} /> {selected.requesterName || selected.requesterEmail || "Requester"}</span>
                  <span><Clock size={13} /> Priority {selected.priority || "2"}</span>
                  <span><AlertCircle size={13} /> {selected.waitingReason || "No wait reason"}</span>
                  {selected.portalToken && onCopyPortalLink ? (
                    <button
                      className="do-button"
                      data-testid="requests-copy-portal"
                      onClick={() => onCopyPortalLink(selected)}
                      type="button"
                    >
                      <Link2 size={13} /> Copy requester portal
                    </button>
                  ) : onEnsurePortal ? (
                    <button
                      className="do-button"
                      data-testid="requests-ensure-portal"
                      onClick={() => void onEnsurePortal(selected)}
                      type="button"
                    >
                      <Link2 size={13} /> Create requester portal
                    </button>
                  ) : null}
                </div>

                <article className="do-requests-description">
                  {(selected.description || "No description yet.").split("\n").map((line: string, index: number) => (
                    <p key={`${index}-${line.slice(0, 12)}`}>{line || "\u00A0"}</p>
                  ))}
                </article>

                <section className="do-requests-related">
                  <strong>Related work</strong>
                  <div>
                    {(["bug", "pbi", "task", "issue"] as const).map((kind) => (
                      <button
                        key={kind}
                        onClick={() => void onCreateRelatedWork(selected.id, kind)}
                        type="button"
                      >
                        <Link2 size={13} /> Create {kind.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {(Array.isArray(selected.relatedWorkIds) ? selected.relatedWorkIds : []).length ? (
                    <ul>
                      {(selected.relatedWorkIds as string[]).map((id) => {
                        const related = allTasks.find((item) => item.id === id);
                        return (
                          <li key={id}>
                            {onOpenRelatedWork ? (
                              <button
                                className="do-requests-related-link"
                                onClick={() => onOpenRelatedWork(id)}
                                type="button"
                              >
                                {related
                                  ? `${String(related.workItemType || related.type || "item").toUpperCase()} · ${titleOf(related)}`
                                  : id}
                              </button>
                            ) : (
                              related
                                ? `${String(related.workItemType || related.type || "item").toUpperCase()} · ${titleOf(related)}`
                                : id
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <em>No related engineering work yet.</em>
                  )}
                </section>

                <section className="do-requests-thread" data-testid="requests-thread">
                  <strong>Conversation</strong>
                  <div className="do-requests-messages">
                    {selectedMessages.map((message) => (
                      <article className={`is-${message.visibility || "public"}`} key={message.id}>
                        <header>
                          <b>{message.authorName || message.authorEmail || "Someone"}</b>
                          <small>{message.visibility === "internal" ? "Internal note" : "Reply"}</small>
                        </header>
                        <p>{message.body}</p>
                      </article>
                    ))}
                    {selectedMessages.length === 0 ? <em>No conversation yet.</em> : null}
                  </div>
                  <div className="do-requests-composer">
                    <div className="do-requests-composer-modes" role="tablist" aria-label="Reply mode">
                      <button
                        aria-selected={replyMode === "public"}
                        className={replyMode === "public" ? "is-active" : ""}
                        data-testid="requests-reply-public"
                        onClick={() => setReplyMode("public")}
                        type="button"
                      >
                        Reply to requester
                      </button>
                      <button
                        aria-selected={replyMode === "internal"}
                        className={replyMode === "internal" ? "is-active is-internal" : "is-internal"}
                        data-testid="requests-reply-internal"
                        onClick={() => setReplyMode("internal")}
                        type="button"
                      >
                        Internal note
                      </button>
                    </div>
                    <textarea
                      aria-label={replyMode === "public" ? "Public reply" : "Internal note"}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder={replyMode === "public" ? "Visible to the requester…" : "Only visible to your team…"}
                      rows={3}
                      value={reply}
                    />
                    <button className="do-button do-button-dark" disabled={busy || !reply.trim()} onClick={() => void send()} type="button">
                      <Send size={13} /> {replyMode === "public" ? "Send reply" : "Save note"}
                    </button>
                  </div>
                </section>

                {(ticketStatusOf(selected) === "resolved" || ticketStatusOf(selected) === "closed") ? null : (
                  <button
                    className="do-button"
                    data-testid="requests-resolve"
                    onClick={() => void onUpdateTicket(selected.id, {
                      ticketStatus: "resolved",
                      status: "done",
                      customerStatus: "Resolved",
                      lastPublicUpdate: `Resolved by ${viewerName || "team"}`,
                    })}
                    type="button"
                  >
                    <CheckCircle2 size={14} /> Resolve request
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
