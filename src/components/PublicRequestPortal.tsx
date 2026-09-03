import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { CertoMark } from "./CertoMark";
import { Loader2, Send } from "./ui/Icon";
import {
  REQUEST_PORTAL_COLLECTION,
  type RequestPortalSnapshot,
} from "../lib/captureRequests";

/** Public portal for the ticket requester (creator) — no sign-in. */
export function PublicRequestPortal({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<RequestPortalSnapshot | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const reload = async () => {
    const snap = await getDoc(doc(db, REQUEST_PORTAL_COLLECTION, token));
    const data = snap.exists() ? snap.data() : null;
    if (!data || data.revoked === true || data.token !== token || !data.snapshot) {
      throw new Error("This request link is invalid or has been revoked.");
    }
    setWorkspaceId(String(data.workspaceId || ""));
    setTicketId(String(data.ticketId || ""));
    setSnapshot(data.snapshot as RequestPortalSnapshot);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await reload();
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "This request could not be opened.");
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const send = async () => {
    const body = reply.trim();
    if (!body || !snapshot || !workspaceId || !ticketId) return;
    setBusy(true);
    setNotice("");
    try {
      const messageId = `portal_${Date.now().toString(36)}`;
      await addDoc(collection(db, "work_item_messages"), {
        workspaceId,
        workItemId: ticketId,
        visibility: "public",
        channel: "portal",
        authorRole: "requester",
        portalToken: token,
        body,
        authorId: null,
        authorName: String(snapshot.ticket.requesterName || "You"),
        authorEmail: snapshot.ticket.requesterEmail
          ? String(snapshot.ticket.requesterEmail)
          : null,
        createdAt: serverTimestamp(),
      });
      const nextMessages: RequestPortalSnapshot["messages"] = [
        ...snapshot.messages,
        {
          id: messageId,
          body,
          authorName: String(snapshot.ticket.requesterName || "You"),
          authorRole: "requester",
          createdAt: new Date().toISOString(),
        },
      ];
      const nextSnapshot: RequestPortalSnapshot = {
        ...snapshot,
        messages: nextMessages,
        ticket: {
          ...snapshot.ticket,
          lastPublicUpdate: body.slice(0, 240),
          customerStatus: "Waiting on our side",
        },
        updatedAt: Date.now(),
      };
      await updateDoc(doc(db, REQUEST_PORTAL_COLLECTION, token), {
        snapshot: nextSnapshot,
        updatedAt: serverTimestamp(),
      });
      setSnapshot(nextSnapshot);
      setReply("");
      setNotice("Message sent. The team will see it in Requests.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <main className="do-signin">
        <section className="do-access-card do-request-portal-card" data-testid="request-portal-error">
          <span className="do-logo">
            <CertoMark size={18} />
          </span>
          <h2>Request unavailable</h2>
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
        <p>Opening your request…</p>
      </main>
    );
  }

  const ticket = snapshot.ticket;

  return (
    <main className="do-request-portal" data-testid="request-portal">
      <header className="do-request-portal-bar">
        <span className="do-logo">
          <CertoMark size={16} />
        </span>
        <div>
          <strong>Certo Requests</strong>
          <em>{snapshot.workspaceName}</em>
        </div>
      </header>

      <section className="do-request-portal-card">
        <p className="do-request-portal-status" data-testid="request-portal-status">
          {String(ticket.customerStatus || "Received")}
        </p>
        <small>{String(ticket.key || "Request")}</small>
        <h1>{String(ticket.title || "Your request")}</h1>
        {ticket.description ? (
          <article className="do-request-portal-description">
            {String(ticket.description)
              .split("\n")
              .map((line, index) => (
                <p key={`${index}-${line.slice(0, 8)}`}>{line || "\u00A0"}</p>
              ))}
          </article>
        ) : null}

        <section className="do-request-portal-thread" data-testid="request-portal-thread">
          <strong>Conversation</strong>
          {snapshot.messages.length === 0 ? (
            <em>No updates yet. You’ll see replies from the team here.</em>
          ) : (
            snapshot.messages.map((message) => (
              <article
                className={`is-${message.authorRole}`}
                key={message.id || message.body.slice(0, 12)}
              >
                <header>
                  <b>
                    {message.authorRole === "requester"
                      ? message.authorName || "You"
                      : message.authorName || "Team"}
                  </b>
                  <small>{message.authorRole === "requester" ? "You" : "Team"}</small>
                </header>
                <p>{message.body}</p>
              </article>
            ))
          )}
        </section>

        <section className="do-request-portal-composer">
          <label htmlFor="request-portal-reply">Add an update</label>
          <textarea
            id="request-portal-reply"
            aria-label="Reply to the team"
            data-testid="request-portal-reply"
            onChange={(event) => setReply(event.target.value)}
            placeholder="Reply to the team…"
            rows={3}
            value={reply}
          />
          <button
            className="do-button do-button-dark"
            data-testid="request-portal-send"
            disabled={busy || !reply.trim()}
            onClick={() => void send()}
            type="button"
          >
            <Send size={14} /> Send update
          </button>
          {notice ? <p className="do-request-portal-notice" role="status">{notice}</p> : null}
        </section>
      </section>
    </main>
  );
}
