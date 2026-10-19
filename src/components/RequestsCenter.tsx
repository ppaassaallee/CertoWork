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
import { RoutineLaunchButton } from "./routines/RoutineHost";
import { getLocale, setLocale } from "../lib/i18n";
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
  projects?: any[];
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
    projectId?: string;
  }) => Promise<void> | void;
  onUpdateTicket: (id: string, patch: Record<string, unknown>) => Promise<void> | void;
  onSendMessage: (ticketId: string, body: string, visibility: "public" | "internal") => Promise<void> | void;
  onCreateRelatedWork: (ticketId: string, kind: "epic" | "feature" | "pbi" | "bug" | "task" | "issue", parentId?: string) => Promise<void> | void;
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
  projects = [],
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
  const [draftProjectId, setDraftProjectId] = useState("");
  const [relatedKind, setRelatedKind] = useState<"epic" | "feature" | "pbi" | "bug" | "task" | "issue">("pbi");
  const [relatedParentId, setRelatedParentId] = useState("");
  const [locale, setRequestLocale] = useState<"en" | "es">(getLocale().startsWith("es") ? "es" : "en");
  const tr = (en: string, es: string) => (locale.startsWith("es") ? es : en);
  const requestKindText = (kind: string) => ({
    request: tr("Request", "Solicitud"), incident: tr("Incident", "Incidente"), feedback: tr("Feedback", "Comentario"),
  } as Record<string, string>)[kind] || kind;
  const statusText = (status: TicketStatus) => locale.startsWith("es")
    ? ({ new: "Nueva", in_progress: "En progreso", waiting: "En espera", resolved: "Resuelta", closed: "Cerrada" } as const)[status]
    : ticketStatusLabel(status);
  const waitText = (reason: string) => locale.startsWith("es") ? ({
    "Waiting for requester": "Esperando al solicitante",
    "Waiting for vendor": "Esperando al proveedor",
    "Waiting for engineering": "Esperando a ingeniería",
    "Waiting for approval": "Esperando aprobación",
    "Waiting for information": "Esperando información",
  } as Record<string, string>)[reason] || reason : reason;
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
        projectId: draftProjectId || undefined,
      });
      setDraftTitle("");
      setDraftBody("");
      setDraftRequester("");
      setDraftProjectId("");
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
          <strong>{tr("Requests", "Solicitudes")}</strong>
          <span>{tr("Capture, triage and follow up on client work.", "Captura, clasifica y da seguimiento al trabajo del cliente.")}</span>
        </div>
        <div className="do-requests-language" aria-label={tr("Language", "Idioma")}>
          {(["en", "es"] as const).map((next) => <button aria-pressed={locale === next} key={next} onClick={() => { setLocale(next); setRequestLocale(next); }} type="button">{next.toUpperCase()}</button>)}
        </div>
        <div className="do-requests-tabs" role="tablist" aria-label="Request views">
          {([
            ["inbox", tr("Inbox", "Bandeja")],
            ["mine", tr("Mine", "Mías")],
            ["waiting", tr("Waiting", "En espera")],
            ["resolved", tr("Resolved", "Resueltas")],
            ["new", tr("New request", "Nueva solicitud")],
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
            {tr("Short title", "Título breve")}
            <input
              aria-label="Ticket title"
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={tr("What needs help?", "¿En qué podemos ayudarte?")}
              value={draftTitle}
            />
          </label>
          <label>
            {tr("Requester email", "Correo del solicitante")}
            <input
              aria-label="Requester email"
              onChange={(event) => setDraftRequester(event.target.value)}
              placeholder="optional@company.com"
              value={draftRequester}
            />
          </label>
          <label>
            {tr("What happened?", "¿Qué sucedió?")}
            <textarea
              aria-label="Ticket description"
              onChange={(event) => setDraftBody(event.target.value)}
              placeholder={tr("Details to help the team take action.", "Detalles para que el equipo pueda actuar.")}
              rows={5}
              value={draftBody}
            />
          </label>
          <div className="do-requests-choice" role="group" aria-label={tr("Project (optional)", "Proyecto (opcional)")}>
            <span>{tr("Project (optional)", "Proyecto (opcional)")}</span>
            <button aria-pressed={draftProjectId === ""} onClick={() => setDraftProjectId("")} type="button">{tr("No project", "Sin proyecto")}</button>
            {projects.map((project) => (
              <button
                aria-pressed={draftProjectId === project.id}
                key={project.id}
                onClick={() => setDraftProjectId(String(project.id))}
                type="button"
              >
                {String(project.title || project.name || project.id)}
              </button>
            ))}
          </div>
          <button className="do-button do-button-dark" disabled={busy || !draftTitle.trim()} onClick={() => void create()} type="button">
            <Plus size={14} /> {tr("Create ticket", "Crear ticket")}
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
                    <em>{item.requesterName || item.requesterEmail || tr("Unknown requester", "Solicitante desconocido")}{item.requestKind ? ` · ${requestKindText(String(item.requestKind))}` : ""}</em>
                  </span>
                  <small className={`is-${status}`}>{statusText(status)}</small>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <div className="do-requests-empty">
                <Inbox size={22} />
                <strong>{tr("No requests here", "No hay solicitudes aquí")}</strong>
                <span>{tr("New email and form tickets land in Inbox.", "Los tickets nuevos llegan a la bandeja.")}</span>
              </div>
            ) : null}
          </div>

          <div className="do-requests-detail" data-testid="requests-detail">
            {!selected ? (
              <div className="do-requests-empty">
                <MessageSquare size={22} />
                <strong>{tr("Select a request", "Selecciona una solicitud")}</strong>
                <span>{tr("Reply to the requester or leave an internal note.", "Responde al solicitante o deja una nota interna.")}</span>
              </div>
            ) : (
              <>
                <header>
                  <div>
                    <small>{selected.key || selected.id}</small>
                    <h2>{titleOf(selected)}</h2>
                    <p>{statusText(ticketStatusOf(selected))}</p>
                  </div>
                  <div className="do-requests-status-fields">
                    <RoutineLaunchButton
                      scope={{
                        entityType: "request",
                        entityId: String(selected.id),
                        entityTitle: titleOf(selected),
                      }}
                      testId="request-routine-button"
                    />
                    <label>
                      {tr("Status", "Estado")}
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
                          <option key={status} value={status}>{statusText(status)}</option>
                        ))}
                      </select>
                    </label>
                    {ticketStatusOf(selected) === "waiting" ? (
                      <label>
                        {tr("Waiting reason", "Motivo de espera")}
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
                          <option key={reason} value={reason}>{waitText(reason)}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </header>

                <div className="do-requests-meta">
                  <span><User size={13} /> {selected.requesterName || selected.requesterEmail || tr("Requester", "Solicitante")}</span>
                  {selected.projectId && <span>{tr("Project", "Proyecto")}: {String(projects.find((project) => project.id === selected.projectId)?.title || projects.find((project) => project.id === selected.projectId)?.name || selected.projectId)}</span>}
                  {selected.serviceAreaName && <span>{tr("Service area", "Área de servicio")}: {String(selected.serviceAreaName)}</span>}
                  <span><Clock size={13} /> {tr("Priority", "Prioridad")} {selected.priority || "2"}</span>
                  <span><AlertCircle size={13} /> {selected.waitingReason || tr("No wait reason", "Sin motivo de espera")}</span>
                  {selected.portalToken && onCopyPortalLink ? (
                    <button
                      className="do-button"
                      data-testid="requests-copy-portal"
                      onClick={() => onCopyPortalLink(selected)}
                      type="button"
                    >
                      <Link2 size={13} /> {tr("Copy requester portal", "Copiar portal del solicitante")}
                    </button>
                  ) : onEnsurePortal ? (
                    <button
                      className="do-button"
                      data-testid="requests-ensure-portal"
                      onClick={() => void onEnsurePortal(selected)}
                      type="button"
                    >
                      <Link2 size={13} /> {tr("Create requester portal", "Crear portal del solicitante")}
                    </button>
                  ) : null}
                </div>

                <article className="do-requests-description">
                  {(selected.description || tr("No description yet.", "Aún no hay descripción.")).split("\n").map((line: string, index: number) => (
                    <p key={`${index}-${line.slice(0, 12)}`}>{line || "\u00A0"}</p>
                  ))}
                </article>

                <section className="do-requests-related">
                  <strong>{tr("Related work", "Trabajo relacionado")}</strong>
                  <div>
                    <div className="do-requests-choice" role="group" aria-label={tr("Create as", "Crear como")}>
                      <span>{tr("Create as", "Crear como")}</span>
                      {(["epic", "feature", "pbi", "task", "bug", "issue"] as const).map((kind) => (
                        <button
                          aria-pressed={relatedKind === kind}
                          key={kind}
                          onClick={() => { setRelatedKind(kind); setRelatedParentId(""); }}
                          type="button"
                        >
                          {kind.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {(relatedKind === "feature" || relatedKind === "task") && (
                      <div className="do-requests-choice" role="group" aria-label={relatedKind === "feature" ? tr("Parent Epic", "Épica principal") : tr("Parent PBI", "PBI principal")}>
                        <span>{relatedKind === "feature" ? tr("Parent Epic", "Épica principal") : tr("Parent PBI", "PBI principal")}</span>
                        {allTasks.filter((item) => String(item.projectId || "") === String(selected.projectId || "") && String(item.workItemType || item.type || "").toLowerCase() === (relatedKind === "feature" ? "epic" : "pbi")).map((item) => (
                          <button
                            aria-pressed={relatedParentId === item.id}
                            key={item.id}
                            onClick={() => setRelatedParentId(String(item.id))}
                            type="button"
                          >
                            {titleOf(item)}
                          </button>
                        ))}
                      </div>
                    )}
                    <button disabled={(relatedKind === "feature" || relatedKind === "task") && !relatedParentId} onClick={() => void onCreateRelatedWork(selected.id, relatedKind, relatedParentId || undefined)} type="button"><Link2 size={13} /> {tr("Create linked item", "Crear item vinculado")}</button>
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
                    <em>{tr("No related engineering work yet.", "Aún no hay trabajo de ingeniería relacionado.")}</em>
                  )}
                </section>

                <section className="do-requests-thread" data-testid="requests-thread">
                  <strong>{tr("Conversation", "Conversación")}</strong>
                  <div className="do-requests-messages">
                    {selectedMessages.map((message) => (
                      <article className={`is-${message.visibility || "public"}`} key={message.id}>
                        <header>
                          <b>{message.authorName || message.authorEmail || "Someone"}</b>
                          <small>{message.visibility === "internal" ? tr("Internal note", "Nota interna") : tr("Reply", "Respuesta")}</small>
                        </header>
                        <p>{message.body}</p>
                      </article>
                    ))}
                    {selectedMessages.length === 0 ? <em>{tr("No conversation yet.", "Aún no hay conversación.")}</em> : null}
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
                        {tr("Reply to requester", "Responder al solicitante")}
                      </button>
                      <button
                        aria-selected={replyMode === "internal"}
                        className={replyMode === "internal" ? "is-active is-internal" : "is-internal"}
                        data-testid="requests-reply-internal"
                        onClick={() => setReplyMode("internal")}
                        type="button"
                      >
                        {tr("Internal note", "Nota interna")}
                      </button>
                    </div>
                    <textarea
                      aria-label={replyMode === "public" ? "Public reply" : "Internal note"}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder={replyMode === "public" ? tr("Visible to the requester…", "Visible para el solicitante…") : tr("Only visible to your team…", "Solo visible para tu equipo…")}
                      rows={3}
                      value={reply}
                    />
                    <button className="do-button do-button-dark" disabled={busy || !reply.trim()} onClick={() => void send()} type="button">
                      <Send size={13} /> {replyMode === "public" ? tr("Send reply", "Enviar respuesta") : tr("Save note", "Guardar nota")}
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
                    <CheckCircle2 size={14} /> {tr("Resolve request", "Resolver solicitud")}
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
