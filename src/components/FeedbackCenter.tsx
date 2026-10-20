import { useEffect, useMemo, useState } from "react";
import { Bug, Check, Copy, Flag, Folder, Inbox, Lightbulb, Link2, Plus, ShieldCheck, Sparkles } from "./ui/Icon";
import { getLocale, isSpanish } from "../lib/i18n";
import {
  FEEDBACK_SEVERITIES,
  feedbackStatusLabel,
  isOpenFeedback,
  workItemTypeForFeedback,
  type FeedbackKind,
  type FeedbackReport,
  type FeedbackSeverity,
  type FeedbackStatus,
} from "../lib/feedbackReports";

type Props = {
  mode: "submit" | "queue" | "combined";
  canManage: boolean;
  initialKind?: FeedbackKind;
  reports: FeedbackReport[];
  projects: Array<{ id: string; title?: string; name?: string }>;
  submitting?: boolean;
  onSubmit: (input: {
    kind: FeedbackKind;
    title: string;
    description: string;
    projectId: string;
    severity: FeedbackSeverity | "";
  }) => Promise<void> | void;
  onUpdateStatus: (report: FeedbackReport, status: FeedbackStatus, adminNote?: string) => Promise<void> | void;
  onConvert: (report: FeedbackReport, projectId: string) => Promise<void> | void;
  onOpenQueue?: () => void;
  onOpenItem?: (taskId: string) => void;
};

function projectTitle(project: { title?: string; name?: string } | undefined) {
  return project?.title || project?.name || "Untitled project";
}

export function FeedbackCenter({
  mode,
  canManage,
  initialKind = "bug",
  reports,
  projects,
  submitting = false,
  onSubmit,
  onUpdateStatus,
  onConvert,
  onOpenQueue,
  onOpenItem,
}: Props) {
  const tr = (en: string, es: string) => isSpanish(getLocale()) ? es : en;
  const [kind, setKind] = useState<FeedbackKind>(initialKind);

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [severity, setSeverity] = useState<FeedbackSeverity | "">("medium");
  const [statusFilter, setStatusFilter] = useState("open");
  const [convertProjectById, setConvertProjectById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [copied, setCopied] = useState("");

  const intakeUrl = (routeProjectId = "", routeKind: FeedbackKind | "" = "") => {
    if (typeof window === "undefined") return "";
    const url = new URL("/supportops", window.location.origin);
    if (routeProjectId) url.searchParams.set("project", routeProjectId);
    if (routeKind) url.searchParams.set("kind", routeKind);
    return url.toString();
  };

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedProjectUrl = projectId ? intakeUrl(projectId, kind) : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const routedKind = params.get("kind");
    const routedProjectId = params.get("project") || "";
    if (routedKind === "bug" || routedKind === "feature") setKind(routedKind);
    if (routedProjectId && projects.some((project) => project.id === routedProjectId)) {
      setProjectId(routedProjectId);
    }
  }, [projects]);

  const filtered = useMemo(() => {
    return [...reports]
      .filter((report) => {
        if (statusFilter === "open") return isOpenFeedback(report.status);
        if (statusFilter === "all") return true;
        return String(report.status || "submitted") === statusFilter;
      })
      .sort((left, right) => {
        const leftAt = Number((left.createdAt as { toMillis?: () => number })?.toMillis?.() || 0);
        const rightAt = Number((right.createdAt as { toMillis?: () => number })?.toMillis?.() || 0);
        return rightAt - leftAt;
      });
  }, [reports, statusFilter]);

  const openCount = reports.filter((report) => isOpenFeedback(report.status)).length;
  const triagedCount = reports.filter((report) => report.status === "triaged").length;
  const convertedCount = reports.filter((report) => report.status === "converted").length;
  const routedCount = reports.filter((report) => Boolean(report.projectId)).length;

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await onSubmit({
        kind,
        title: title.trim(),
        description: description.trim(),
        projectId,
        severity: kind === "bug" ? severity || "medium" : "",
      });
      setTitle("");
      setDescription("");
      setProjectId("");
      setSeverity("medium");
    } catch {
      // Keep the draft so a failed request can be retried.
    }
  };

  const copy = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 2200);
  };

  const run = async (id: string, work: () => Promise<void> | void) => {
    setBusyId(id);
    try {
      await work();
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="do-feedback-center" data-testid={mode === "queue" ? "feedback-admin-queue" : "feedback-submit"}>
      <header className="do-feedback-head">
        <div>
          <span className="do-kicker">{mode === "queue" ? tr("Admin console", "Administración") : tr("Support desk", "Mesa de ayuda")}</span>
          <h1>{mode === "queue" ? tr("Past reports", "Reportes anteriores") : tr("Report a bug or idea", "Reportar un error o idea")}</h1>
          <p>
            {mode === "queue"
              ? tr("Triage and convert reports created before the unified Requests inbox.", "Clasifica y convierte los reportes creados antes de unificar Solicitudes.")
              : tr("New reports become trackable requests. Earlier reports remain available below.", "Los reportes nuevos se convierten en solicitudes con seguimiento. Los anteriores siguen disponibles abajo.")}
          </p>
        </div>
        <div className="do-feedback-head-actions">
          {mode === "submit" && canManage && onOpenQueue && (
            <button className="do-button-secondary" onClick={onOpenQueue} type="button">
              <Inbox size={14} /> {tr("Queue", "Bandeja")} · {openCount} {tr("open", "abiertos")}
            </button>
          )}
        </div>
      </header>

      {mode === "queue" && <section className="do-feedback-metrics" aria-label="Earlier reports summary">
        <article>
          <span><Inbox size={16} /></span>
          <small>Open intake</small>
          <strong>{openCount}</strong>
        </article>
        <article>
          <span><Flag size={16} /></span>
          <small>Triaged</small>
          <strong>{triagedCount}</strong>
        </article>
        <article>
          <span><Check size={16} /></span>
          <small>Converted</small>
          <strong>{convertedCount}</strong>
        </article>
        <article>
          <span><Folder size={16} /></span>
          <small>Project routed</small>
          <strong>{routedCount}</strong>
        </article>
      </section>}

      {canManage && (
        <section className="do-feedback-link-hub" aria-label="Support form links">
          <article>
            <span><Inbox size={16} /></span>
            <div>
              <strong>{tr("General intake", "Recepción general")}</strong>
              <p>{tr("Share this when the team should review first and assign a project later.", "Comparte este enlace si el equipo debe revisar primero y asignar un proyecto después.")}</p>
            </div>
            <button onClick={() => void copy(intakeUrl(), "general")} type="button">
              <Copy size={13} /> {copied === "general" ? tr("Copied", "Copiado") : tr("Copy link", "Copiar enlace")}
            </button>
          </article>
          <article>
            <span><Folder size={16} /></span>
            <div>
              <strong>{tr("Project-specific form", "Formulario por proyecto")}</strong>
              <p>{tr("Choose a project below; the link opens this form already routed to it.", "Elige un proyecto abajo; el enlace abrirá el formulario asociado a él.")}</p>
            </div>
            <button disabled={!selectedProjectUrl} onClick={() => void copy(selectedProjectUrl, "project")} type="button">
              <Copy size={13} /> {copied === "project" ? tr("Copied", "Copiado") : tr("Copy link", "Copiar enlace")}
            </button>
          </article>
          <article>
            <span><ShieldCheck size={16} /></span>
            <div>
              <strong>{tr("Who can use these links", "Quién puede usar estos enlaces")}</strong>
              <p>{tr("These links require workspace access; they are not anonymous public forms.", "Estos enlaces requieren acceso al espacio de trabajo; no son formularios públicos anónimos.")}</p>
            </div>
            {onOpenQueue ? (
              <button onClick={onOpenQueue} type="button">
                <Link2 size={13} /> {tr("Earlier reports", "Reportes anteriores")}
              </button>
            ) : null}
          </article>
        </section>
      )}

      {mode !== "queue" && (
        <section className="do-feedback-submit-card" aria-label="Submit SupportOps request">
          <span className="do-feedback-ticket-stamp"><Sparkles size={13} /> {tr("Intake", "Recepción")}</span>
          <div className="do-feedback-submit-hero">
            <div>
              <span className="do-kicker">{selectedProject ? tr("Project support", "Ayuda del proyecto") : tr("General support", "Ayuda general")}</span>
              <h2>{selectedProject ? projectTitle(selectedProject) : tr("Tell us what needs attention", "Cuéntanos qué necesita atención")}</h2>
              <p>
                {selectedProject
                  ? tr("This request will be linked to the project for its team to review.", "Esta solicitud quedará vinculada al proyecto para que su equipo la revise.")
                  : tr("No project selected. The team can classify and route this request later.", "No seleccionaste un proyecto. El equipo puede clasificar y asignar la solicitud después.")}
              </p>
            </div>
            <div className="do-feedback-kind" role="tablist" aria-label="SupportOps type">
              <button
                className={kind === "bug" ? "is-active" : ""}
                onClick={() => setKind("bug")}
                role="tab"
                type="button"
              >
                <Bug size={14} /> {tr("Bug", "Error")}
              </button>
              <button
                className={kind === "feature" ? "is-active" : ""}
                onClick={() => setKind("feature")}
                role="tab"
                type="button"
              >
                <Lightbulb size={14} /> {tr("Idea", "Idea")}
              </button>
            </div>
          </div>
          <label className="do-feedback-field">
            {tr("Title", "Título")}
            <input
              aria-label="SupportOps title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === "bug" ? tr("What went wrong?", "¿Qué salió mal?") : tr("What should exist?", "¿Qué hace falta?")}
              value={title}
            />
          </label>
          <label className="do-feedback-field">
            {tr("Details", "Detalles")}
            <textarea
              aria-label="SupportOps details"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                kind === "bug"
                  ? tr("What you expected, what happened, and how to reproduce it.", "Qué esperabas, qué sucedió y cómo reproducirlo.")
                  : tr("The outcome you need and why it matters now.", "Qué resultado necesitas y por qué importa ahora.")
              }
              rows={5}
              value={description}
            />
          </label>
          <div className="do-feedback-meta">
            <label className="do-feedback-field">
              {tr("Related project", "Proyecto relacionado")}
              <select
                aria-label="Related project"
                onChange={(event) => setProjectId(event.target.value)}
                value={projectId}
              >
                <option value="">{tr("No project / product-wide", "Sin proyecto / general")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {projectTitle(project)}
                  </option>
                ))}
              </select>
            </label>
            {kind === "bug" && (
              <label className="do-feedback-field">
                {tr("Severity", "Gravedad")}
                <select
                  aria-label="Bug severity"
                  onChange={(event) => setSeverity(event.target.value as FeedbackSeverity)}
                  value={severity || "medium"}
                >
                  {FEEDBACK_SEVERITIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button
            className="do-button do-button-dark"
            disabled={!title.trim() || submitting}
            onClick={() => void submit()}
            type="button"
          >
            <Plus size={13} /> {kind === "bug" ? tr("Submit bug", "Enviar error") : tr("Submit idea", "Enviar idea")}
          </button>
        </section>
      )}

      <section className="do-workspace-admin-card" aria-label={mode !== "submit" ? tr("Earlier reports", "Reportes anteriores") : tr("My earlier reports", "Mis reportes anteriores")}>
        <div className="do-workspace-admin-head">
          <span className="do-kicker">{mode !== "submit" ? tr("Earlier reports", "Reportes anteriores") : tr("My earlier reports", "Mis reportes anteriores")}</span>
          <strong>
            {filtered.length} {tr("shown", "visibles")}
            {mode !== "submit" ? ` · ${openCount} ${tr("open", "abiertos")}` : ""}
          </strong>
        </div>
        <p className="do-panel-intro">{tr("New bugs and ideas appear as tickets in the Requests inbox. This list preserves earlier reports.", "Los errores e ideas nuevos aparecen como tickets en Solicitudes. Esta lista conserva los reportes anteriores.")}</p>
        <label>
          {tr("Status", "Estado")}
          <select
            aria-label="SupportOps status filter"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="open">{tr("Open", "Abiertos")}</option>
            <option value="all">{tr("All", "Todos")}</option>
            <option value="submitted">{tr("Submitted", "Enviados")}</option>
            <option value="triaged">{tr("Triaged", "Clasificados")}</option>
            <option value="converted">{tr("Converted", "Convertidos")}</option>
            <option value="closed">{tr("Closed", "Cerrados")}</option>
            <option value="wontfix">{tr("Won't fix", "No se realizará")}</option>
          </select>
        </label>
        <div className="do-feedback-list">
          {filtered.map((report) => {
            const selectedProject =
              convertProjectById[report.id] ?? String(report.projectId || "");
            const itemType = workItemTypeForFeedback(report.kind);
            return (
              <article className="do-feedback-row" key={report.id}>
                <span className={`do-feedback-chip is-${report.kind === "bug" ? "bug" : "feature"}`}>
                  {report.kind === "bug" ? <Bug size={12} /> : <Lightbulb size={12} />}
                  {report.kind === "bug" ? tr("Bug", "Error") : tr("Idea", "Idea")}
                </span>
                <div>
                  <strong>{report.title || tr("Untitled", "Sin título")}</strong>
                  {report.description ? <p>{report.description}</p> : null}
                  <small>
                    {report.reporterEmoji || "🙂"} {report.reporterAlias || tr("Teammate", "Compañero")}
                    {report.severity ? ` · ${report.severity}` : ""}
                    {report.projectId
                      ? ` · ${projectTitle(projects.find((project) => project.id === report.projectId))}`
                      : ""}
                    {` · ${tr(feedbackStatusLabel(report.status), ({ submitted: "Enviado", triaged: "Clasificado", converted: "Convertido", closed: "Cerrado", wontfix: "No se realizará" } as Record<string, string>)[String(report.status || "submitted")] || "Enviado")}`}
                  </small>
                </div>
                {mode !== "submit" && canManage && isOpenFeedback(report.status) && (
                  <div className="do-feedback-actions">
                    <select
                      aria-label={`Project for ${report.title || "report"}`}
                      onChange={(event) =>
                        setConvertProjectById((current) => ({
                          ...current,
                          [report.id]: event.target.value,
                        }))
                      }
                      value={selectedProject}
                    >
                      <option value="">{tr("No project", "Sin proyecto")}</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {projectTitle(project)}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={busyId === report.id}
                      onClick={() =>
                        void run(report.id, () => onConvert(report, selectedProject))
                      }
                      type="button"
                    >
                      <Flag size={12} /> {tr("Convert to", "Convertir a")} {itemType === "bug" ? "bug PBI" : "PBI"}
                    </button>
                    {report.status === "submitted" && (
                      <button
                        disabled={busyId === report.id}
                        onClick={() => void run(report.id, () => onUpdateStatus(report, "triaged"))}
                        type="button"
                      >
                        {tr("Triage", "Clasificar")}
                      </button>
                    )}
                    <button
                      className="is-danger"
                      disabled={busyId === report.id}
                      onClick={() => void run(report.id, () => onUpdateStatus(report, "wontfix"))}
                      type="button"
                    >
                      {tr("Won't fix", "No se realizará")}
                    </button>
                  </div>
                )}
                {report.status === "converted" && report.convertedToId && (
                  <button
                    onClick={() => onOpenItem?.(report.convertedToId as string)}
                    type="button"
                  >
                    <Folder size={12} /> {tr("Open PBI", "Abrir PBI")}
                  </button>
                )}
                {report.status === "converted" && !onOpenItem && (
                  <span className="do-feedback-done">
                    <Check size={12} /> {tr("Converted", "Convertido")}
                  </span>
                )}
              </article>
            );
          })}
          {filtered.length === 0 && (
            <div className="do-panel-empty">
              <Flag size={20} />
              <strong>{mode !== "submit" ? tr("No earlier reports in this filter.", "No hay reportes anteriores con este filtro.") : tr("No earlier reports yet.", "Aún no hay reportes anteriores.")}</strong>
              <span>
                {mode !== "submit"
                  ? tr("New bugs and ideas now appear as tickets in the Requests inbox.", "Los errores e ideas nuevos aparecen como tickets en Solicitudes.")
                  : tr("Your new bugs and ideas now appear as tickets in Requests.", "Tus errores e ideas nuevos aparecen como tickets en Solicitudes.")}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
