import { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, doc, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { app, db } from "../../lib/firebase";
import { PORTAL_MEMBERS_COLLECTION, clientPortalRoot } from "../../lib/clientPortal/collections";
import type { ItemView, PortalLocale, ServiceRequestKind } from "../../lib/clientPortal/types";
import { usePortal } from "../PortalContext";

const kindKeys: Record<ServiceRequestKind, string> = {
  request: "requestKindRequest", incident: "requestKindIncident", feedback: "requestKindFeedback",
};

function statusKey(value: string, customerStatus = ""): string {
  const status = value.toLowerCase().replace(/[ _-]/g, "");
  const customer = customerStatus.toLowerCase().replace(/[ _-]/g, "");
  if (["resolved", "done", "completed"].includes(status)) return "requestStatusResolved";
  if (["closed", "cancelled"].includes(status)) return "requestStatusClosed";
  if (["waitingcustomer", "waitingyou", "awaitingcustomer"].includes(status)) return "requestStatusWaitingYou";
  if (["waitingteam", "waitinginternal", "waitingonourside"].includes(status)) return "requestStatusWaitingTeam";
  if (status === "waiting") return customer.includes("you") || customer.includes("requester") ? "requestStatusWaitingYou" : "requestStatusWaitingTeam";
  if (["inprogress", "active", "triaged"].includes(status)) return "requestStatusInProgress";
  return "requestStatusReceived";
}

export function PortalRequestsPage() {
  const { t, clientId, meta, locale, setLocale, user } = usePortal();
  const [requests, setRequests] = useState<ItemView[]>([]);
  const areas = useMemo(() => (meta?.serviceAreas || []).filter((area) => area.enabled), [meta?.serviceAreas]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState("");
  const [requestKind, setRequestKind] = useState<ServiceRequestKind>("request");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reply, setReply] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; body: string; authorName: string; authorRole: string; createdAt: string }>>([]);
  const selectedArea = areas.find((area) => area.id === areaId);
  const selected = requests.find((request) => request.id === selectedId);

  useEffect(() => {
    if (!clientId) { setRequests([]); return; }
    const q = query(collection(db, `${clientPortalRoot(clientId)}/items`), where("kind", "==", "request"), limit(200));
    return onSnapshot(q, (snapshot) => setRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ItemView))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))), () => setRequests([]));
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !selectedId) { setMessages([]); return; }
    const q = query(collection(db, `${clientPortalRoot(clientId)}/request_messages`), where("ticketId", "==", selectedId), limit(100));
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((message) => ({ id: message.id, ...message.data() } as typeof messages[number]))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    }, () => setMessages([]));
  }, [clientId, selectedId]);

  const changeLocale = (next: PortalLocale) => {
    setLocale(next);
    if (user) updateDoc(doc(db, PORTAL_MEMBERS_COLLECTION, user.uid), { locale: next }).catch(() => undefined);
  };

  const create = async () => {
    if (!clientId || !selectedArea || !title.trim() || !description.trim() || !selectedArea.requestKinds.includes(requestKind)) return;
    setBusy(true);
    setNotice("");
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "createPortalRequest");
      await fn({ clientId, serviceAreaId: selectedArea.id, requestKind, title: title.trim(), description: description.trim() });
      setNotice(t("requestCreated"));
      setOpen(false);
      setTitle("");
      setDescription("");
    } catch {
      setNotice(t("requestCreateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!clientId || !selected || !reply.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "replyPortalRequest");
      await fn({ clientId, ticketId: selected.id, body: reply.trim() });
      setReply("");
      setNotice(t("requestReplySent"));
    } catch {
      setNotice(t("requestReplyFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cp-grid">
      <header className="cp-request-header">
        <div><h1>{t("requests")}</h1><p className="cp-muted">{t("requestIntro")}</p></div>
        <div className="cp-request-header-actions">
          <div className="cp-language" aria-label={t("language")}>
            <button aria-pressed={locale.startsWith("es")} onClick={() => changeLocale("es")} type="button">ES</button>
            <button aria-pressed={locale.startsWith("en")} onClick={() => changeLocale("en")} type="button">EN</button>
          </div>
          <button className="cp-btn" disabled={areas.length === 0} onClick={() => { setOpen(true); setSelectedId(null); setAreaId(areas[0]?.id || ""); setRequestKind(areas[0]?.requestKinds[0] || "request"); }} type="button">+ {t("newRequest")}</button>
        </div>
      </header>
      {notice && <p role="status" className="cp-muted">{notice}</p>}
      {!areas.length && <p className="cp-card cp-muted">{t("requestNoAreas")}</p>}

      {open && <form className="cp-card cp-request-form" onSubmit={(event) => { event.preventDefault(); void create(); }}>
        <h2>{t("newRequest")}</h2>
        <div className="cp-choice" role="group" aria-label={t("requestSelectArea")}>
          <span>{t("requestSelectArea")}</span>
          {areas.map((area) => (
            <button
              aria-pressed={areaId === area.id}
              key={area.id}
              onClick={() => { setAreaId(area.id); setRequestKind(area.requestKinds[0] || "request"); }}
              type="button"
            >
              {area.name}
            </button>
          ))}
        </div>
        <div className="cp-choice" role="group" aria-label={t("requestSelectKind")}>
          <span>{t("requestSelectKind")}</span>
          {(selectedArea?.requestKinds || []).map((kind) => (
            <button
              aria-pressed={requestKind === kind}
              key={kind}
              onClick={() => setRequestKind(kind)}
              type="button"
            >
              {t(kindKeys[kind])}
            </button>
          ))}
        </div>
        <label>{t("requestTitle")}
          <input required maxLength={160} value={title} placeholder={t("requestTitlePlaceholder")} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>{t("requestDescription")}
          <textarea required maxLength={8000} rows={5} value={description} placeholder={t("requestDescriptionPlaceholder")} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="cp-request-actions"><button className="cp-btn" disabled={busy || !areaId || !title.trim() || !description.trim()} type="submit">{t("requestSubmit")}</button><button className="cp-btn ghost" onClick={() => setOpen(false)} type="button">{t("requestCancel")}</button></div>
      </form>}

      {selected && !open ? <article className="cp-card cp-request-detail">
        <button className="cp-btn ghost" onClick={() => setSelectedId(null)} type="button">← {t("requestBack")}</button>
        <p className="cp-muted">{selected.requestNumber || t("requestDetail")}</p>
        <h2>{selected.title}</h2>
        <div className="cp-request-badges"><span className="cp-pill">{t(statusKey(selected.ticketStatus || selected.status, selected.status))}</span>{selected.requestKind && <span className="cp-pill">{t(kindKeys[selected.requestKind])}</span>}{selected.serviceAreaId && areas.find((area) => area.id === selected.serviceAreaId) && <span className="cp-pill">{areas.find((area) => area.id === selected.serviceAreaId)?.name}</span>}</div>
        {selected.createdAt && <p className="cp-muted">{t("requestSentOn")}: {new Date(selected.createdAt).toLocaleDateString(locale.startsWith("es") ? "es" : "en")}</p>}
        {selected.description && <p className="cp-request-description">{selected.description}</p>}
        {selected.lastPublicUpdate && <section><h3>{t("requestLatestUpdate")}</h3><p>{selected.lastPublicUpdate}</p></section>}
        <section className="cp-request-conversation"><h3>{t("requestConversation")}</h3>
          {messages.length === 0 ? <p className="cp-muted">{t("requestNoConversation")}</p> : messages.map((message) => <article className={`cp-request-message is-${message.authorRole}`} key={message.id}>
            <strong>{message.authorName || (message.authorRole === "client" ? t("profile") : t("yourProjects"))}</strong>
            <p>{message.body}</p>
          </article>)}
          {selected.ticketStatus !== "closed" && <div className="cp-request-reply"><textarea aria-label={t("requestReply")} maxLength={4000} rows={3} placeholder={t("requestReplyPlaceholder")} value={reply} onChange={(event) => setReply(event.target.value)} /><button className="cp-btn" disabled={busy || !reply.trim()} onClick={() => void sendReply()} type="button">{t("requestReply")}</button></div>}
        </section>
      </article> : !open && <section className="cp-card" aria-label={t("requestMyRequests")}>
        <h2>{t("requestMyRequests")}</h2>
        {requests.length === 0 ? <p className="cp-muted">{t("requestEmpty")}</p> : requests.map((request) => <button className="cp-row cp-request-row" key={request.id} onClick={() => setSelectedId(request.id)} type="button">
          <span><strong>{request.title}</strong><small className="cp-muted">{request.requestNumber || ""}{request.lastPublicUpdate ? ` · ${request.lastPublicUpdate}` : ""}</small></span>
          <span className="cp-pill">{t(statusKey(request.ticketStatus || request.status, request.status))}</span>
        </button>)}
      </section>}
    </div>
  );
}
