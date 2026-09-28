import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { usePortal, usePortalCollection } from "../PortalContext";
import type { ApprovalView, ThreadView } from "../../lib/clientPortal/types";
import { portalApprovalPath } from "../../lib/clientPortal/collections";

export function PortalMessagesPage() {
  const { t, user } = usePortal();
  const threads = usePortalCollection<ThreadView>("threads", "lastMessageAt");
  const uid = user?.uid || "";

  return (
    <div className="cp-grid">
      <h1 style={{ margin: 0 }}>{t("messages")}</h1>
      <div className="cp-card">
        {threads.map((thread) => (
          <div className="cp-row" key={thread.id}>
            <div>
              <strong>{thread.subject}</strong>
              <div className="cp-muted">{thread.lastMessageAt?.slice(0, 16) || "—"}</div>
            </div>
            <span className="cp-pill">{thread.unread?.[uid] || 0} unread</span>
          </div>
        ))}
        {threads.length === 0 ? <p className="cp-muted">No conversations yet.</p> : null}
      </div>
    </div>
  );
}

export function PortalApprovalsPage() {
  const { t, clientId, user } = usePortal();
  const approvals = usePortalCollection<ApprovalView>("approvals", "requestedAt");
  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending");

  const decide = async (id: string, status: "accepted" | "rejected") => {
    if (!clientId || !user) return;
    await updateDoc(doc(db, portalApprovalPath(clientId, id)), {
      status,
      decidedBy: user.uid,
      decidedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="cp-grid">
      <h1 style={{ margin: 0 }}>{t("approvals")}</h1>
      <section className="cp-card">
        <h2 style={{ marginTop: 0, fontSize: 15 }}>{t("needsAction")}</h2>
        {pending.map((a) => (
          <div className="cp-row" key={a.id}>
            <div>
              <strong>{a.title}</strong>
              <div className="cp-muted">{a.kind} · {a.description || ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cp-btn" onClick={() => decide(a.id, "accepted")} type="button">
                {t("accept")}
              </button>
              <button className="cp-btn ghost" onClick={() => decide(a.id, "rejected")} type="button">
                {t("reject")}
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 ? <p className="cp-muted">Nothing waiting on you.</p> : null}
      </section>
      <section className="cp-card">
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Decided</h2>
        {decided.map((a) => (
          <div className="cp-row" key={a.id}>
            <strong>{a.title}</strong>
            <span className="cp-pill">{a.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
