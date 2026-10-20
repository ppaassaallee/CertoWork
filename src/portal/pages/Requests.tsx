import { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, doc, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { app, db } from "../../lib/firebase";
import { isSpanish } from "../../lib/i18n";
import { NativeSelect } from "../../components/ui/NativeSelect";
import { PORTAL_MEMBERS_COLLECTION, clientPortalRoot } from "../../lib/clientPortal/collections";
import type { ItemView, PortalLocale, ServiceRequestKind } from "../../lib/clientPortal/types";
import { usePortal } from "../PortalContext";
import { AlertTriangle, ArrowRight, BookOpen, Inbox, MessageSquare, Sparkles, Ticket } from "../../components/ui/Icon";

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

export function PortalRequestsPage({ preview = false }: { preview?: boolean } = {}) {
  const { t, clientId, meta, locale, setLocale, user } = usePortal();
  const [requests, setRequests] = useState<ItemView[]>([]);
  const areas = useMemo(() => (meta?.serviceAreas || []).filter((area) => area.enabled), [meta?.serviceAreas]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"home" | "mine" | "guides">("home");
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
  const serviceName = areas.length === 1 ? areas[0].name : (meta?.brand?.name || t("requests"));
  const startRequest = (kind: ServiceRequestKind) => {
    const area = areas.find((entry) => entry.requestKinds.includes(kind));
    if (!area) return;
    setAreaId(area.id);
    setRequestKind(kind);
    setSelectedId(null);
    setOpen(true);
    setView("home");
  };

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
    if (preview) return;
    if (!clientId || !selectedArea || !title.trim() || !description.trim() || !selectedArea.requestKinds.includes(requestKind)) return;
    setBusy(true);
    setNotice("");
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "createPortalRequest");
      await fn({ clientId, serviceAreaId: selectedArea.id, requestKind, title: title.trim(), description: description.trim() });
      setNotice(t("requestCreated"));
      setOpen(false);
      setView("mine");
      setTitle("");
      setDescription("");
    } catch {
      setNotice(t("requestCreateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (preview) return;
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
    <div className="cp-service-desk" data-testid="client-service-desk">
      <aside className="cp-service-sidebar" aria-label={t("serviceNavigation")}>
        <div className="cp-service-identity"><span className="cp-service-mark">{serviceName.slice(0, 1).toUpperCase()}</span><div><strong>{serviceName}</strong><small>{t("helpCenter")} · Certo Work</small></div></div>
        <nav>
          <button className={view === "home" && !open && !selected ? "is-active" : ""} onClick={() => { setView("home"); setOpen(false); setSelectedId(null); }} type="button">{t("home")}</button>
          <button className={view === "mine" && !open && !selected ? "is-active" : ""} onClick={() => { setView("mine"); setOpen(false); setSelectedId(null); }} type="button">{t("requestMyRequests")}</button>
          <button className={view === "guides" && !open ? "is-active" : ""} onClick={() => { setView("guides"); setOpen(false); setSelectedId(null); }} type="button">{t("guides")}</button>
        </nav>
        <small className="cp-service-secure">{t("secureAccess")} {serviceName}</small>
      </aside>
      <div className="cp-service-content">
      <header className="cp-request-header">
        <div className="cp-service-breadcrumb">{t("services")} / {serviceName}</div>
        <div className="cp-request-header-actions">
          <div className="cp-language" aria-label={t("language")}>
            <button aria-pressed={isSpanish(locale)} onClick={() => changeLocale("es")} type="button">ES</button>
            <button aria-pressed={!isSpanish(locale)} onClick={() => changeLocale("en")} type="button">EN</button>
          </div>
          {view !== "home" || selected ? <button className="cp-btn" disabled={areas.length === 0} onClick={() => startRequest(areas[0]?.requestKinds[0] || "request")} type="button">+ {t("newRequest")}</button> : null}
        </div>
      </header>
      <main className="cp-service-main">
      {preview && <p className="cp-service-preview" role="status">{t("previewMode")}</p>}
      {notice && <p role="status" className="cp-muted">{notice}</p>}
      {!areas.length && <p className="cp-card cp-muted">{t("requestNoAreas")}</p>}

      {!open && !selected && view === "home" && <>
        <div className="cp-service-intro"><span>{t("hereToHelp")}</span><h1>{t("howCanWeHelp")}</h1><p>{t("chooseService")}</p></div>
        <div className="cp-service-actions">
          {([
            { kind: "request", icon: Sparkles, title: "requestKindRequest", description: "requestCardDescription", action: "requestCreateAction" },
            { kind: "incident", icon: AlertTriangle, title: "requestKindIncident", description: "incidentCardDescription", action: "incidentCreateAction" },
            { kind: "feedback", icon: MessageSquare, title: "requestKindFeedback", description: "feedbackCardDescription", action: "feedbackCreateAction" },
          ] as const).map(({ kind, icon: Icon, title, description, action }) => <button className="cp-service-action" disabled={!areas.some((area) => area.requestKinds.includes(kind))} key={kind} onClick={() => startRequest(kind)} type="button"><Icon size={22} /><strong>{t(title)}</strong><span>{t(description)}</span><em>{t(action)} <ArrowRight size={16} /></em></button>)}
        </div>
        <div className="cp-service-bottom"><section className="cp-service-recent"><div className="cp-service-section-head"><h2>{t("recentRequests")}</h2><button onClick={() => setView("mine")} type="button">{t("viewAll")} <ArrowRight size={16} /></button></div>{requests.length === 0 ? <p className="cp-muted">{t("requestEmpty")}</p> : requests.slice(0, 3).map((request) => <button className="cp-service-request" key={request.id} onClick={() => setSelectedId(request.id)} type="button"><Ticket size={18} /><span><strong>{request.requestNumber ? `${request.requestNumber} · ` : ""}{request.title}</strong><small>{request.lastPublicUpdate || t("requestIntro")}</small></span><em>{t(statusKey(request.ticketStatus || request.status, request.status))}</em></button>)}</section><button className="cp-service-guide-card" onClick={() => setView("guides")} type="button"><BookOpen size={22} /><strong>{t("solveItNow")}</strong><span>{t("guideIntro")}</span><em>{t("viewGuides")} <ArrowRight size={16} /></em></button></div>
      </>}

      {!open && !selected && view === "guides" && <section className="cp-service-guides"><span className="cp-service-eyebrow">{t("helpCenter")}</span><h1>{t("guides")}</h1><p>{t("guideIntro")}</p><article><Inbox size={20} /><div><h2>{t("guideBeforeTitle")}</h2><p>{t("guideBeforeBody")}</p></div></article><article><Ticket size={20} /><div><h2>{t("guideTrackTitle")}</h2><p>{t("guideTrackBody")}</p></div></article><article><MessageSquare size={20} /><div><h2>{t("guideReplyTitle")}</h2><p>{t("guideReplyBody")}</p></div></article></section>}

      {open && <form className="cp-card cp-request-form" onSubmit={(event) => { event.preventDefault(); void create(); }}>
        <h2>{t("newRequest")}</h2>
        <label>{t("requestSelectArea")}
          <NativeSelect required value={areaId} onChange={(event) => { const next = areas.find((area) => area.id === event.target.value); setAreaId(event.target.value); setRequestKind(next?.requestKinds[0] || "request"); }}>
            {areas.map((area) => <option value={area.id} key={area.id}>{area.name}</option>)}
          </NativeSelect>
        </label>
        <label>{t("requestSelectKind")}
          <NativeSelect value={requestKind} onChange={(event) => setRequestKind(event.target.value as ServiceRequestKind)}>
            {(selectedArea?.requestKinds || []).map((kind) => <option key={kind} value={kind}>{t(kindKeys[kind])}</option>)}
          </NativeSelect>
        </label>
        <label>{t("requestTitle")}
          <input required maxLength={160} value={title} placeholder={t("requestTitlePlaceholder")} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>{t("requestDescription")}
          <textarea required maxLength={8000} rows={5} value={description} placeholder={t("requestDescriptionPlaceholder")} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="cp-request-actions"><button className="cp-btn" disabled={preview || busy || !areaId || !title.trim() || !description.trim()} type="submit">{t("requestSubmit")}</button><button className="cp-btn ghost" onClick={() => setOpen(false)} type="button">{t("requestCancel")}</button></div>
      </form>}

      {selected && !open ? <article className="cp-card cp-request-detail">
        <button className="cp-btn ghost" onClick={() => setSelectedId(null)} type="button">← {t("requestBack")}</button>
        <p className="cp-muted">{selected.requestNumber || t("requestDetail")}</p>
        <h2>{selected.title}</h2>
        <div className="cp-request-badges"><span className="cp-pill">{t(statusKey(selected.ticketStatus || selected.status, selected.status))}</span>{selected.requestKind && <span className="cp-pill">{t(kindKeys[selected.requestKind])}</span>}{selected.serviceAreaId && areas.find((area) => area.id === selected.serviceAreaId) && <span className="cp-pill">{areas.find((area) => area.id === selected.serviceAreaId)?.name}</span>}</div>
        {selected.createdAt && <p className="cp-muted">{t("requestSentOn")}: {new Date(selected.createdAt).toLocaleDateString(isSpanish(locale) ? "es" : "en")}</p>}
        {selected.description && <p className="cp-request-description">{selected.description}</p>}
        {selected.lastPublicUpdate && <section><h3>{t("requestLatestUpdate")}</h3><p>{selected.lastPublicUpdate}</p></section>}
        <section className="cp-request-conversation"><h3>{t("requestConversation")}</h3>
          {messages.length === 0 ? <p className="cp-muted">{t("requestNoConversation")}</p> : messages.map((message) => <article className={`cp-request-message is-${message.authorRole}`} key={message.id}>
            <strong>{message.authorName || (message.authorRole === "client" ? t("profile") : t("yourProjects"))}</strong>
            <p>{message.body}</p>
          </article>)}
          {selected.ticketStatus !== "closed" && <div className="cp-request-reply"><textarea aria-label={t("requestReply")} maxLength={4000} rows={3} placeholder={t("requestReplyPlaceholder")} value={reply} onChange={(event) => setReply(event.target.value)} /><button className="cp-btn" disabled={preview || busy || !reply.trim()} onClick={() => void sendReply()} type="button">{t("requestReply")}</button></div>}
        </section>
      </article> : !open && view === "mine" && <section className="cp-card" aria-label={t("requestMyRequests")}>
        <h2>{t("requestMyRequests")}</h2>
        {requests.length === 0 ? <p className="cp-muted">{t("requestEmpty")}</p> : requests.map((request) => <button className="cp-row cp-request-row" key={request.id} onClick={() => setSelectedId(request.id)} type="button">
          <span><strong>{request.title}</strong><small className="cp-muted">{request.requestNumber || ""}{request.lastPublicUpdate ? ` · ${request.lastPublicUpdate}` : ""}</small></span>
          <span className="cp-pill">{t(statusKey(request.ticketStatus || request.status, request.status))}</span>
        </button>)}
      </section>}
      </main>
      </div>
    </div>
  );
}
