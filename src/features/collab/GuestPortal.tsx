import { useCallback, useEffect, useState } from "react";
import { CertoMark } from "../../components/CertoMark";
import { Loader2, Send } from "../../components/ui/Icon";

type GuestMessage = {
  id: string;
  text: string;
  senderName: string;
  senderType: string;
  createdAt: string;
  visibility?: string;
};

type GuestSnapshot = {
  guest: { id: string; name: string; email?: string | null };
  conversation: {
    id: string;
    title: string;
    workspaceId: string;
  };
  workspaceName?: string;
  messages: GuestMessage[];
};

/** Public guest portal for `/c/:token` — no sign-in. */
export function GuestPortal({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<GuestSnapshot | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/collab/guest/${encodeURIComponent(token)}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "This guest link is invalid or has been revoked.");
      }
      const data = (await res.json()) as GuestSnapshot & { ok?: boolean };
      setSnapshot({
        guest: data.guest,
        conversation: data.conversation,
        workspaceName: data.workspaceName,
        messages: Array.isArray(data.messages) ? data.messages : [],
      });
    } catch (reason) {
      setSnapshot(null);
      setError(reason instanceof Error ? reason.message : "This conversation could not be opened.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    const body = reply.trim();
    if (!body || !snapshot) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(
        `/api/collab/guest/${encodeURIComponent(token)}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: body }),
        },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Could not send message.");
      }
      setReply("");
      setNotice("Message sent.");
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <main className="do-signin">
        <section className="do-access-card do-request-portal-card" data-testid="guest-portal-error">
          <span className="do-logo">
            <CertoMark size={18} />
          </span>
          <h2>Conversation unavailable</h2>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="do-loading">
        <span className="do-logo">
          <CertoMark size={18} />
        </span>
        <Loader2 className="spin" size={18} />
        <p>Opening conversation…</p>
      </main>
    );
  }

  return (
    <main className="do-request-portal" data-testid="guest-portal">
      <header className="do-request-portal-bar">
        <span className="do-logo">
          <CertoMark size={16} />
        </span>
        <div>
          <strong>Certo Collab</strong>
          <em>{snapshot.workspaceName || "Guest access"}</em>
        </div>
      </header>

      <section className="do-request-portal-card">
        <p className="do-request-portal-status" data-testid="guest-portal-status">
          Guest
        </p>
        <h1>{snapshot.conversation.title || "Conversation"}</h1>
        <p>
          Signed in as <strong>{snapshot.guest.name}</strong>
          {snapshot.guest.email ? ` (${snapshot.guest.email})` : ""}.
        </p>

        <section className="do-request-portal-thread" data-testid="guest-portal-thread">
          <strong>Messages</strong>
          {snapshot.messages.length === 0 ? (
            <em>No messages yet. Say hello to the team.</em>
          ) : (
            snapshot.messages.map((message) => (
              <article
                className={`is-${message.senderType === "guest" ? "requester" : "team"}`}
                key={message.id}
              >
                <header>
                  <b>{message.senderName || (message.senderType === "guest" ? "You" : "Team")}</b>
                  <small>{message.senderType === "guest" ? "You" : "Team"}</small>
                </header>
                <p>{message.text}</p>
              </article>
            ))
          )}
        </section>

        <section className="do-request-portal-composer">
          <label htmlFor="guest-portal-reply">Add a message</label>
          <textarea
            id="guest-portal-reply"
            aria-label="Reply to the team"
            data-testid="guest-portal-reply"
            onChange={(event) => setReply(event.target.value)}
            placeholder="Write a message…"
            rows={3}
            value={reply}
          />
          <button
            className="do-button do-button-dark"
            data-testid="guest-portal-send"
            disabled={busy || !reply.trim()}
            onClick={() => void send()}
            type="button"
          >
            <Send size={14} /> Send
          </button>
          {notice ? <p className="do-request-portal-notice" role="status">{notice}</p> : null}
        </section>
      </section>
    </main>
  );
}
