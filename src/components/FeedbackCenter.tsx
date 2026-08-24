import { useEffect, useMemo, useState } from "react";
import { Bug, Check, Flag, Folder, Lightbulb, Plus } from "./ui/Icon";
import {
  FEEDBACK_SEVERITIES,
  feedbackKindLabel,
  feedbackStatusLabel,
  isOpenFeedback,
  workItemTypeForFeedback,
  type FeedbackKind,
  type FeedbackReport,
  type FeedbackSeverity,
  type FeedbackStatus,
} from "../lib/feedbackReports";

type Props = {
  mode: "submit" | "queue";
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

  const submit = async () => {
    if (!title.trim()) return;
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
        <span className="do-kicker">{mode === "queue" ? "Admin" : "Workspace"}</span>
        <h1>{mode === "queue" ? "Feedback queue" : "Report a bug or request a feature"}</h1>
        <p>
          {mode === "queue"
            ? "Triage submissions, then convert the ones that should become backlog PBIs."
            : "Tell the workspace what is broken or missing. Admins can convert accepted reports into PBIs."}
        </p>
        {mode === "submit" && canManage && onOpenQueue && (
          <button className="do-button-secondary" onClick={onOpenQueue} type="button">
            Open admin queue · {openCount} open
          </button>
        )}
      </header>

      {mode === "submit" && (
        <section className="do-workspace-admin-card" aria-label="Submit feedback">
          <div className="do-feedback-kind" role="tablist" aria-label="Feedback type">
            <button
              className={kind === "bug" ? "is-active" : ""}
              onClick={() => setKind("bug")}
              role="tab"
              type="button"
            >
              <Bug size={14} /> Bug
            </button>
            <button
              className={kind === "feature" ? "is-active" : ""}
              onClick={() => setKind("feature")}
              role="tab"
              type="button"
            >
              <Lightbulb size={14} /> Feature
            </button>
          </div>
          <label>
            Title
            <input
              aria-label="Feedback title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === "bug" ? "What went wrong?" : "What should exist?"}
              value={title}
            />
          </label>
          <label>
            Details
            <textarea
              aria-label="Feedback details"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                kind === "bug"
                  ? "What you expected, what happened, and how to reproduce it."
                  : "The outcome you need and why it matters now."
              }
              rows={5}
              value={description}
            />
          </label>
          <div className="do-feedback-meta">
            <label>
              Related project
              <select
                aria-label="Related project"
                onChange={(event) => setProjectId(event.target.value)}
                value={projectId}
              >
                <option value="">No project / product-wide</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {projectTitle(project)}
                  </option>
                ))}
              </select>
            </label>
            {kind === "bug" && (
              <label>
                Severity
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
            <Plus size={13} /> {kind === "bug" ? "Submit bug" : "Submit feature request"}
          </button>
        </section>
      )}

      <section className="do-workspace-admin-card" aria-label={mode === "queue" ? "All feedback" : "My reports"}>
        <div className="do-workspace-admin-head">
          <span className="do-kicker">{mode === "queue" ? "Queue" : "My reports"}</span>
          <strong>
            {filtered.length} shown
            {mode === "queue" ? ` · ${openCount} open` : ""}
          </strong>
        </div>
        <label>
          Status
          <select
            aria-label="Feedback status filter"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="open">Open</option>
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="triaged">Triaged</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
            <option value="wontfix">Won't fix</option>
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
                  {feedbackKindLabel(report.kind)}
                </span>
                <div>
                  <strong>{report.title || "Untitled"}</strong>
                  {report.description ? <p>{report.description}</p> : null}
                  <small>
                    {report.reporterEmoji || "🙂"} {report.reporterAlias || "Teammate"}
                    {report.severity ? ` · ${report.severity}` : ""}
                    {report.projectId
                      ? ` · ${projectTitle(projects.find((project) => project.id === report.projectId))}`
                      : ""}
                    {` · ${feedbackStatusLabel(report.status)}`}
                  </small>
                </div>
                {mode === "queue" && canManage && isOpenFeedback(report.status) && (
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
                      <option value="">No project / errand</option>
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
                      <Flag size={12} /> Convert to {itemType === "bug" ? "bug PBI" : "PBI"}
                    </button>
                    {report.status === "submitted" && (
                      <button
                        disabled={busyId === report.id}
                        onClick={() => void run(report.id, () => onUpdateStatus(report, "triaged"))}
                        type="button"
                      >
                        Triage
                      </button>
                    )}
                    <button
                      className="is-danger"
                      disabled={busyId === report.id}
                      onClick={() => void run(report.id, () => onUpdateStatus(report, "wontfix"))}
                      type="button"
                    >
                      Won't fix
                    </button>
                  </div>
                )}
                {report.status === "converted" && report.convertedToId && (
                  <button
                    onClick={() => onOpenItem?.(report.convertedToId as string)}
                    type="button"
                  >
                    <Folder size={12} /> Open PBI
                  </button>
                )}
                {report.status === "converted" && !onOpenItem && (
                  <span className="do-feedback-done">
                    <Check size={12} /> Converted
                  </span>
                )}
              </article>
            );
          })}
          {filtered.length === 0 && (
            <div className="do-panel-empty">
              <Flag size={20} />
              <strong>{mode === "queue" ? "No reports in this filter." : "You have not submitted anything yet."}</strong>
              <span>
                {mode === "queue"
                  ? "Open items from teammates will show here for triage."
                  : "Submit a bug or feature request to start the queue."}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
