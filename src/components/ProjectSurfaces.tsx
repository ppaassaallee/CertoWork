import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Circle,
  Copy,
  FileText,
  Flag,
  FolderKanban,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Users,
  X,
} from "lucide-react";
import {
  PROJECT_HEALTH,
  PROJECT_STATUSES,
  isProjectFavorite,
  projectHealth,
  projectHealthLabel,
  projectStatusLabel,
  sortProjectsByRecency,
  taskWorkLane,
  type WorkLane,
} from "../lib/projectPortfolio";
import {
  financeAmount,
  financeCapacityAllocations,
  financeId,
  financeSummary,
  normalizedFinancePeriods,
  projectFinancialRollup,
  stripUndefinedValues,
  type FinanceDirection,
  type FinanceEntry,
  type FinancePeriod,
  type FinancePeriodKind,
} from "../lib/projectFinance";
import {
  DELIVERY_PHASES_BY_STAGE,
  DELIVERY_STAGES,
  deliveryPhase,
  deliveryPhaseLabel,
  deliveryPhaseLabels,
  deliveryStageLabels,
  normalizeDeliveryStage,
  phasesForStage,
  type DeliveryPhase,
  type DeliveryStage,
} from "../lib/projectDelivery";
import { CodexBridgePanel } from "./CodexBridgePanel";
import { InfoTip, MultiAssigneePicker, memberName } from "./ProjectControls";
import { looksLikeEmail } from "../lib/workspaceCollaboration";
import { AiRewriteButton, type RewriteFieldKind } from "./AiRewriteButton";
import {
  ProjectTemplatesPanel,
  type TemplateApplication,
} from "./ProjectTemplatesPanel";
import { matchesTag, tagIds, tagLabels, toggleTagId, type TagLike } from "../lib/tagging";
import { controlledOptionNames } from "../lib/controlledLists";
import { PRODUCT_PHASES, WORK_CATEGORIES, productPhase, workCategory } from "../lib/workClassification";
import { ControlledSelect } from "./ControlledSelect";

type ProjectPatch = Record<string, unknown>;
type AssignmentMember = {
  id: string;
  userId?: string;
  alias?: string;
  emoji?: string;
  displayName?: string;
  email?: string;
  emailLower?: string;
  status?: string;
};

type PortfolioColumnKey =
  | "project"
  | "delivery_entity"
  | "client_entity"
  | "tags"
  | "work_category"
  | "product_phase"
  | "stage"
  | "phase"
  | "status"
  | "health"
  | "progress"
  | "due"
  | "solution_architect"
  | "project_manager"
  | "economics"
  | "actions";

const portfolioColumnLabels: Record<PortfolioColumnKey, string> = {
  project: "Project",
  delivery_entity: "Delivery Entity",
  client_entity: "Client Entity",
  tags: "Tags",
  work_category: "Work Category",
  product_phase: "Product Phase",
  stage: "Stage",
  phase: "Phase",
  status: "Status",
  health: "Health",
  progress: "Progress",
  due: "Due",
  solution_architect: "Solution Architect",
  project_manager: "Project Manager",
  economics: "Economics",
  actions: "",
};

const defaultPortfolioColumns: PortfolioColumnKey[] = [
  "project",
  "delivery_entity",
  "client_entity",
  "tags",
  "work_category",
  "product_phase",
  "stage",
  "phase",
  "status",
  "health",
  "progress",
  "due",
  "solution_architect",
  "project_manager",
  "economics",
  "actions",
];

const portfolioColumnWidths: Record<PortfolioColumnKey, string> = {
  project: "minmax(230px, 1.45fr)",
  delivery_entity: "minmax(150px, .9fr)",
  client_entity: "minmax(150px, .9fr)",
  tags: "minmax(150px, .9fr)",
  work_category: "minmax(160px, .9fr)",
  product_phase: "125px",
  stage: "105px",
  phase: "120px",
  status: "105px",
  health: "120px",
  progress: "100px",
  due: "130px",
  solution_architect: "155px",
  project_manager: "155px",
  economics: "120px",
  actions: "135px",
};

function columnsStorageKey(scope: string) {
  return `certo-${scope}-view-config`;
}

function columnWidthsStorageKey(scope: string) {
  return `certo-${scope}-column-widths`;
}

function widthFromTemplate(value: string) {
  const match = value.match(/(\d+)px/);
  return match ? Number(match[1]) : 120;
}

function defaultColumnPixels<T extends string>(widths: Record<T, string>) {
  return Object.fromEntries(
    Object.entries(widths).map(([key, value]) => [
      key,
      widthFromTemplate(String(value)),
    ]),
  ) as Record<T, number>;
}

const defaultPortfolioColumnPixels =
  defaultColumnPixels(portfolioColumnWidths);

function clampColumnWidth(value: number) {
  return Math.max(72, Math.min(420, Math.round(value)));
}

function selectedColumns<T extends string>(value: T[] | null, fallback: T[]) {
  const current = value?.length ? [...value] : [...fallback];
  (["work_category", "product_phase"] as T[]).forEach((column) => {
    if (fallback.includes(column) && !current.includes(column)) current.push(column);
  });
  return fallback.filter((column) => current.includes(column));
}

function TagPicker({
  record,
  tags,
  onChange,
  onCreateTag,
  label = "Tags",
}: {
  record: any;
  tags: TagLike[];
  onChange: (patch: Record<string, unknown>) => void;
  onCreateTag?: (name: string) => Promise<string | void> | string | void;
  label?: string;
}) {
  const ids = tagIds(record);
  return (
    <div className="do-tag-picker">
      <div>
        {tagLabels(record, tags).slice(0, 3).map((name) => (
          <span key={name}>{name}</span>
        ))}
        {ids.length === 0 && <small>No tags</small>}
      </div>
      <select
        aria-label={label}
        onChange={(event) => {
          if (!event.target.value) return;
          if (event.target.value === "__create_tag__") {
            const name = window.prompt("Create tag");
            const cleaned = String(name || "").trim();
            event.target.value = "";
            if (!cleaned) return;
            Promise.resolve(onCreateTag?.(cleaned)).then((createdId) => {
              const id = String(createdId || cleaned).trim();
              if (id) onChange(toggleTagId(record, id));
            });
            return;
          }
          onChange(toggleTagId(record, event.target.value));
          event.target.value = "";
        }}
        value=""
      >
        <option value="">+ Tag</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {ids.includes(tag.id) ? "Remove " : "Add "}
            {tag.name || tag.id}
          </option>
        ))}
        {onCreateTag && <option value="__create_tag__">+ Create tag…</option>}
      </select>
    </div>
  );
}

type SharedProjectActions = {
  onUpdateProject: (
    projectId: string,
    patch: ProjectPatch,
  ) => Promise<void> | void;
  onArchiveProject: (project: any) => Promise<void> | void;
  onOpenProject: (project: any) => void;
  onDeleteProject?: (project: any) => Promise<void> | void;
  onRestoreProject?: (project: any) => Promise<void> | void;
};

function projectTitle(project: any) {
  return project?.title || project?.name || "Untitled project";
}

function healthClass(value: string) {
  return value === "blocked"
    ? "is-blocked"
    : value === "at_risk"
      ? "is-risk"
      : "is-track";
}

function EditableField({
  label,
  value,
  placeholder,
  multiline = false,
  onCommit,
  aiKind,
  aiContext,
}: {
  label: string;
  value?: string;
  placeholder: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
  aiKind?: RewriteFieldKind;
  aiContext?: Record<string, unknown>;
}) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  const commit = () => {
    const next = draft.trim();
    if (next !== String(value || "").trim()) onCommit(next);
  };
  return (
    <label className={`do-project-field ${multiline ? "is-multiline" : ""}`}>
      <span className="do-field-label"><span>{label}</span>{aiKind && <AiRewriteButton context={aiContext} fieldKind={aiKind} onRewrite={(next) => { setDraft(next); onCommit(next); }} text={draft} />}</span>
      {multiline ? (
        <textarea
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          rows={3}
          value={draft}
        />
      ) : (
        <input
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          value={draft}
        />
      )}
    </label>
  );
}

function ProjectStatusSelect({
  project,
  onUpdate,
}: {
  project: any;
  onUpdate: (patch: ProjectPatch) => void;
}) {
  const value = PROJECT_STATUSES.includes(
    String(project.status || "planning") as any,
  )
    ? String(project.status || "planning")
    : "active";
  return (
    <select
      aria-label={`Status for ${projectTitle(project)}`}
      className="do-project-select"
      onChange={(event) => onUpdate({ status: event.target.value })}
      value={value}
    >
      {PROJECT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {projectStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="do-project-empty">
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

type WorkItemKind =
  | "epic"
  | "feature"
  | "pbi"
  | "story"
  | "task"
  | "bug"
  | "subtask";

function workItemKind(item: any): WorkItemKind {
  const value = String(
    item?.workItemType ||
      item?.itemType ||
      item?.taskType ||
      item?.issueType ||
      item?.kind ||
      "",
  ).toLowerCase();
  if (value.includes("epic")) return "epic";
  if (value.includes("feature")) return "feature";
  if (value.includes("subtask") || value.includes("sub_task")) return "subtask";
  if (value.includes("story")) return "story";
  if (value.includes("bug")) return "bug";
  if (value === "task" || value.includes("project_task")) return "task";
  return "pbi";
}

function workItemLabel(kind: WorkItemKind) {
  return kind === "pbi" ? "PBI" : kind.charAt(0).toUpperCase() + kind.slice(1);
}

function workItemParentId(item: any) {
  return String(item?.parentId || item?.featureId || item?.epicId || "");
}

function itemOrder(item: any, fallback = 0) {
  const value = Number(item?.order ?? item?.rank ?? item?.position);
  return Number.isFinite(value) ? value : fallback;
}

function sortWorkItems(items: any[]) {
  return [...items].sort(
    (left, right) =>
      itemOrder(left) - itemOrder(right) ||
      String(
        priorityValue(left.priority) === "N/A"
          ? "9"
          : priorityValue(left.priority),
      ).localeCompare(
        String(
          priorityValue(right.priority) === "N/A"
            ? "9"
            : priorityValue(right.priority),
        ),
      ) ||
      projectTitle(left).localeCompare(projectTitle(right)),
  );
}

function dateInputValue(value: any) {
  if (!value) return "";
  if (typeof value === "string")
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  if (value?.seconds)
    return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  return "";
}

function priorityValue(value: any) {
  const normalized = String(value || "").toUpperCase();
  if (["1", "P1", "HIGH", "URGENT", "CRITICAL"].includes(normalized))
    return "1";
  if (["2", "P2", "MEDIUM"].includes(normalized)) return "2";
  if (["3", "P3", "LOW"].includes(normalized)) return "3";
  return "N/A";
}

function canonicalWorkStatus(item: any) {
  const status = String(item?.status || "").toLowerCase();
  if (
    [
      "backlog",
      "ready",
      "todo",
      "in_progress",
      "in_review",
      "blocked",
      "done",
      "cancelled",
    ].includes(status)
  )
    return status;
  return taskWorkLane(item);
}

function InlineEdit({
  ariaLabel,
  value,
  placeholder,
  onCommit,
}: {
  ariaLabel: string;
  value?: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  return (
    <input
      aria-label={ariaLabel}
      onBlur={() =>
        draft.trim() !== String(value || "").trim() && onCommit(draft.trim())
      }
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      placeholder={placeholder}
      value={draft}
    />
  );
}

export function ProjectRecordModal({
  project,
  tasks,
  milestones,
  risks,
  documents,
  onClose,
  onAsk,
  onUpdateProject,
  onArchiveProject,
  onAddTask,
  onUpdateTask,
  onAddMilestone,
  onAddRisk,
}: {
  project: any;
  tasks: any[];
  milestones: any[];
  risks: any[];
  documents: any[];
  onClose: () => void;
  onAsk: (prompt: string) => void;
  onUpdateProject: SharedProjectActions["onUpdateProject"];
  onArchiveProject: SharedProjectActions["onArchiveProject"];
  onAddTask: (
    title: string,
    status: WorkLane,
    patch?: ProjectPatch,
  ) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: ProjectPatch) => Promise<void> | void;
  onAddMilestone: (title: string) => Promise<void> | void;
  onAddRisk: (title: string) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<
    "overview" | "plan" | "work" | "risks" | "docs" | "team"
  >("overview");
  const [taskTitle, setTaskTitle] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const methodology = String(project.methodology || "scrum").toLowerCase();
  const currentHealth = projectHealth(project, tasks, risks);
  const openTasks = tasks.filter((task) => taskWorkLane(task) !== "done");
  const lanes = useMemo(
    () => ({
      backlog: tasks.filter((task) => taskWorkLane(task) === "backlog"),
      in_progress: tasks.filter((task) => taskWorkLane(task) === "in_progress"),
      blocked: tasks.filter((task) => taskWorkLane(task) === "blocked"),
      done: tasks.filter((task) => taskWorkLane(task) === "done"),
    }),
    [tasks],
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const update = (patch: ProjectPatch) => onUpdateProject(project.id, patch);
  const submitTask = async () => {
    if (!taskTitle.trim()) return;
    await onAddTask(taskTitle.trim(), "backlog");
    setTaskTitle("");
  };

  return (
    <div
      aria-label={`${projectTitle(project)} project record`}
      aria-modal="true"
      className="do-project-layer"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
    >
      <section className="do-project-record" data-testid="project-record">
        <header className="do-project-record-head">
          <div className="do-project-record-title">
            <span className="do-project-record-icon">
              <FolderKanban size={20} />
            </span>
            <div>
              <span>PROJECT RECORD</span>
              <h1>{projectTitle(project)}</h1>
            </div>
          </div>
          <div className="do-project-record-actions">
            <button
              aria-label={
                isProjectFavorite(project)
                  ? "Remove from favorites"
                  : "Add to favorites"
              }
              className={isProjectFavorite(project) ? "is-favorite" : ""}
              onClick={() => update({ favorite: !isProjectFavorite(project) })}
              type="button"
            >
              <Star
                fill={isProjectFavorite(project) ? "currentColor" : "none"}
                size={16}
              />
            </button>
            <ProjectStatusSelect onUpdate={update} project={project} />
            <button aria-label="Close project" onClick={onClose} type="button">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="do-project-record-summary">
          <div>
            <Target size={15} />
            <span>
              <strong>
                {project.outcome ||
                  project.objective ||
                  "Outcome needs definition"}
              </strong>
              <small>Target outcome</small>
            </span>
          </div>
          <div>
            <ListChecks size={15} />
            <span>
              <strong>{openTasks.length}</strong>
              <small>Open work items</small>
            </span>
          </div>
          <div>
            <Flag size={15} />
            <span>
              <strong>
                {
                  milestones.filter(
                    (item) =>
                      String(item.status || "").toLowerCase() !== "completed",
                  ).length
                }
              </strong>
              <small>Open milestones</small>
            </span>
          </div>
          <div className={healthClass(currentHealth)}>
            <AlertTriangle size={15} />
            <span>
              <strong>{projectHealthLabel(currentHealth)}</strong>
              <small>Current health</small>
            </span>
          </div>
        </div>

        <nav className="do-project-tabs" aria-label="Project sections">
          {(
            [
              ["overview", "Overview"],
              ["plan", "Plan"],
              ["work", "Work"],
              ["risks", "Risks"],
              ["docs", "Docs"],
              ["team", "Team"],
            ] as const
          ).map(([value, label]) => (
            <button
              className={tab === value ? "is-active" : ""}
              key={value}
              onClick={() => setTab(value)}
              type="button"
            >
              {label}
              {value === "risks" && risks.length > 0 ? (
                <small>{risks.length}</small>
              ) : value === "docs" && documents.length > 0 ? (
                <small>{documents.length}</small>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="do-project-record-body">
          {tab === "overview" && (
            <div className="do-project-overview">
              <section className="do-project-card do-project-card-large">
                <span className="do-project-card-kicker">DIRECTION</span>
                <EditableField
                  aiContext={{ project: projectTitle(project), description: project.description || "" }}
                  aiKind="project_outcome"
                  label="Outcome"
                  multiline
                  onCommit={(outcome) => update({ outcome })}
                  placeholder="What will be observably different when this is done?"
                  value={project.outcome || project.objective}
                />
                <EditableField
                  aiContext={{ project: projectTitle(project), outcome: project.outcome || project.objective || "" }}
                  aiKind="project_description"
                  label="Why it matters"
                  multiline
                  onCommit={(description) => update({ description })}
                  placeholder="Give the team enough context to make good decisions."
                  value={project.description}
                />
              </section>
              <section className="do-project-card">
                <span className="do-project-card-kicker">CLASSIFICATION</span>
                <label className="do-project-field">
                  <span>Method</span>
                  <select
                    onChange={(event) =>
                      update({ methodology: event.target.value })
                    }
                    value={methodology}
                  >
                    <option value="scrum">Scrum</option>
                    <option value="pmi">PMI</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </label>
                <EditableField
                  label="Type"
                  onCommit={(projectType) => update({ projectType })}
                  placeholder="Product, client, operations…"
                  value={project.projectType || project.category}
                />
                <label className="do-project-field">
                  <span>Work Category</span>
                  <select
                    onChange={(event) =>
                      update({
                        workCategory: event.target.value,
                        portfolioCategory: event.target.value,
                        projectType:
                          event.target.value === "Product Development"
                            ? "product"
                            : project.projectType,
                      })
                    }
                    value={workCategory(project)}
                  >
                    {WORK_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="do-project-field">
                  <span>Product Phase</span>
                  <select
                    onChange={(event) =>
                      update({
                        productPhase: event.target.value,
                        roadmapPhase: event.target.value,
                      })
                    }
                    value={productPhase(project)}
                  >
                    {PRODUCT_PHASES.map((phase) => (
                      <option key={phase} value={phase}>
                        {phase}
                      </option>
                    ))}
                  </select>
                </label>
                <EditableField
                  label="Priority"
                  onCommit={(priority) => update({ priority })}
                  placeholder="High, medium, low"
                  value={project.priority}
                />
              </section>
              <section className="do-project-card">
                <span className="do-project-card-kicker">
                  OWNERSHIP & DATES
                </span>
                <EditableField
                  label="Project manager"
                  onCommit={(projectManager) => update({ projectManager })}
                  placeholder="Name or email"
                  value={project.projectManager || project.owner}
                />
                <EditableField
                  label="Target date"
                  onCommit={(targetDate) => update({ targetDate })}
                  placeholder="YYYY-MM-DD"
                  value={project.targetDate || project.dueDate}
                />
                <label className="do-project-field">
                  <span>Health</span>
                  <select
                    onChange={(event) => update({ health: event.target.value })}
                    value={currentHealth}
                  >
                    {PROJECT_HEALTH.map((health) => (
                      <option key={health} value={health}>
                        {projectHealthLabel(health)}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
              <section className="do-project-card do-project-ai-card">
                <Sparkles size={17} />
                <div>
                  <strong>Plan this with Certo Work</strong>
                  <p>
                    Use the conversation to challenge assumptions or turn this
                    record into a credible plan.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onAsk(
                      `Review ${projectTitle(project)} and tell me the most important decision, risk, and next action.`,
                    );
                  }}
                  type="button"
                >
                  Ask <ArrowRight size={13} />
                </button>
              </section>
            </div>
          )}

          {tab === "plan" && (
            <div className="do-project-plan">
              <section className="do-project-card do-plan-hero">
                <div>
                  <span className="do-project-card-kicker">
                    DELIVERY METHOD
                  </span>
                  <h2>
                    {methodology === "pmi"
                      ? "PMI delivery plan"
                      : methodology === "hybrid"
                        ? "Hybrid delivery plan"
                        : "Scrum delivery plan"}
                  </h2>
                  <p>
                    {methodology === "pmi"
                      ? "Manage scope, milestones, governance, delivery and closeout."
                      : "Keep one prioritized backlog, a clear sprint goal, and visible blockers."}
                  </p>
                </div>
                <select
                  onChange={(event) =>
                    update({ methodology: event.target.value })
                  }
                  value={methodology}
                >
                  <option value="scrum">Scrum</option>
                  <option value="pmi">PMI</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </section>
              {methodology === "pmi" ? (
                <div className="do-pmi-phases">
                  {[
                    "Initiating",
                    "Planning",
                    "Executing",
                    "Monitoring",
                    "Closing",
                  ].map((phase, index) => (
                    <div
                      className={
                        index ===
                        Math.min(
                          4,
                          PROJECT_STATUSES.indexOf(
                            String(project.status) as any,
                          ),
                        )
                          ? "is-current"
                          : ""
                      }
                      key={phase}
                    >
                      <span>{index + 1}</span>
                      <strong>{phase}</strong>
                      <small>
                        {index === 0
                          ? "Charter & stakeholders"
                          : index === 1
                            ? "Scope & schedule"
                            : index === 2
                              ? "Delivery"
                              : index === 3
                                ? "Control & risks"
                                : "Handover"}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <section className="do-project-card">
                  <EditableField
                    label="Sprint goal"
                    multiline
                    onCommit={(sprintGoal) => update({ sprintGoal })}
                    placeholder="What should the team prove or deliver in the current sprint?"
                    value={project.sprintGoal}
                  />
                  <div className="do-scrum-metrics">
                    <span>
                      <strong>{lanes.backlog.length}</strong> Backlog
                    </span>
                    <span>
                      <strong>{lanes.in_progress.length}</strong> In sprint
                    </span>
                    <span>
                      <strong>{lanes.blocked.length}</strong> Blocked
                    </span>
                    <span>
                      <strong>{lanes.done.length}</strong> Done
                    </span>
                  </div>
                </section>
              )}
              <section className="do-project-card">
                <div className="do-project-card-head">
                  <div>
                    <span className="do-project-card-kicker">MILESTONES</span>
                    <h2>Key delivery points</h2>
                  </div>
                  <Flag size={16} />
                </div>
                <div className="do-milestone-list">
                  {milestones.map((milestone) => (
                    <div key={milestone.id}>
                      <span
                        className={
                          String(milestone.status).toLowerCase() === "completed"
                            ? "is-done"
                            : ""
                        }
                      >
                        <Flag size={12} />
                      </span>
                      <strong>{milestone.title || milestone.name}</strong>
                      <small>
                        {milestone.dueDate || milestone.targetDate || "No date"}
                      </small>
                    </div>
                  ))}
                  {milestones.length === 0 && (
                    <EmptyState
                      icon={<Flag size={18} />}
                      title="No milestones yet"
                      text="Add the first meaningful delivery point."
                    />
                  )}
                </div>
                <div className="do-project-inline-add">
                  <input
                    onChange={(event) => setMilestoneTitle(event.target.value)}
                    onKeyDown={async (event) => {
                      if (event.key === "Enter" && milestoneTitle.trim()) {
                        await onAddMilestone(milestoneTitle.trim());
                        setMilestoneTitle("");
                      }
                    }}
                    placeholder="Add a milestone…"
                    value={milestoneTitle}
                  />
                  <button
                    disabled={!milestoneTitle.trim()}
                    onClick={async () => {
                      await onAddMilestone(milestoneTitle.trim());
                      setMilestoneTitle("");
                    }}
                    type="button"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </section>
            </div>
          )}

          {tab === "work" && (
            <div className="do-project-work">
              <div className="do-work-toolbar">
                <div>
                  <span className="do-project-card-kicker">TEAM EXECUTION</span>
                  <h2>
                    {methodology === "scrum"
                      ? "Backlog & current flow"
                      : "Work breakdown & delivery flow"}
                  </h2>
                </div>
                <div className="do-project-inline-add">
                  <input
                    onChange={(event) => setTaskTitle(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && submitTask()}
                    placeholder="Add a work item…"
                    value={taskTitle}
                  />
                  <button
                    disabled={!taskTitle.trim()}
                    onClick={submitTask}
                    type="button"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
              <div className="do-work-board">
                {(
                  [
                    ["backlog", "Backlog"],
                    ["in_progress", "In progress"],
                    ["blocked", "Blocked"],
                    ["done", "Done"],
                  ] as const
                ).map(([lane, label]) => (
                  <section className={`do-work-lane is-${lane}`} key={lane}>
                    <header>
                      <span>{label}</span>
                      <small>{lanes[lane].length}</small>
                    </header>
                    <div>
                      {lanes[lane].map((task) => (
                        <article key={task.id}>
                          <strong>{task.title || task.name}</strong>
                          {task.assignee && <small>{task.assignee}</small>}
                          <select
                            aria-label={`Move ${task.title || "task"}`}
                            onChange={(event) =>
                              onUpdateTask(task.id, {
                                status: event.target.value,
                              })
                            }
                            value={lane}
                          >
                            <option value="backlog">Backlog</option>
                            <option value="in_progress">In progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        </article>
                      ))}
                      {lanes[lane].length === 0 && (
                        <span className="do-lane-empty">No work here</span>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {tab === "risks" && (
            <div className="do-project-risks">
              <section
                className={`do-risk-banner ${healthClass(currentHealth)}`}
              >
                <AlertTriangle size={20} />
                <div>
                  <strong>{projectHealthLabel(currentHealth)}</strong>
                  <p>
                    {currentHealth === "on_track"
                      ? "No active project-level risk is currently forcing a change."
                      : "This project needs a visible owner and response for the issues below."}
                  </p>
                </div>
                <select
                  aria-label="Project health"
                  onChange={(event) => update({ health: event.target.value })}
                  value={currentHealth}
                >
                  {PROJECT_HEALTH.map((health) => (
                    <option key={health} value={health}>
                      {projectHealthLabel(health)}
                    </option>
                  ))}
                </select>
              </section>
              <section className="do-project-card">
                <div className="do-project-card-head">
                  <div>
                    <span className="do-project-card-kicker">
                      RISK REGISTER
                    </span>
                    <h2>Threats, assumptions and blockers</h2>
                  </div>
                  <AlertTriangle size={16} />
                </div>
                <div className="do-risk-list">
                  {risks.map((risk) => (
                    <div key={risk.id}>
                      <span className="is-risk">
                        <AlertTriangle size={12} />
                      </span>
                      <div>
                        <strong>{risk.title || risk.description}</strong>
                        <small>
                          {risk.response ||
                            risk.mitigation ||
                            "Response needs definition"}
                        </small>
                      </div>
                      <em>{risk.owner || "Unassigned"}</em>
                    </div>
                  ))}
                  {lanes.blocked.map((task) => (
                    <div key={`task-${task.id}`}>
                      <span className="is-blocked">
                        <Circle size={12} />
                      </span>
                      <div>
                        <strong>{task.title}</strong>
                        <small>Blocked work item</small>
                      </div>
                      <em>{task.assignee || "Unassigned"}</em>
                    </div>
                  ))}
                  {risks.length === 0 && lanes.blocked.length === 0 && (
                    <EmptyState
                      icon={<CheckCircle2 size={19} />}
                      title="No open risks"
                      text="Keep this honest: add a risk as soon as it can affect scope, time or outcome."
                    />
                  )}
                </div>
                <div className="do-project-inline-add">
                  <input
                    onChange={(event) => setRiskTitle(event.target.value)}
                    onKeyDown={async (event) => {
                      if (event.key === "Enter" && riskTitle.trim()) {
                        await onAddRisk(riskTitle.trim());
                        setRiskTitle("");
                      }
                    }}
                    placeholder="Describe a risk or assumption…"
                    value={riskTitle}
                  />
                  <button
                    disabled={!riskTitle.trim()}
                    onClick={async () => {
                      await onAddRisk(riskTitle.trim());
                      setRiskTitle("");
                    }}
                    type="button"
                  >
                    <Plus size={13} /> Add risk
                  </button>
                </div>
              </section>
            </div>
          )}

          {tab === "docs" && (
            <div className="do-project-documents">
              <section className="do-project-card">
                <div className="do-project-card-head">
                  <div>
                    <span className="do-project-card-kicker">
                      PROJECT KNOWLEDGE
                    </span>
                    <h2>Requirements and working documents</h2>
                  </div>
                  <FileText size={17} />
                </div>
                <p className="do-project-card-copy">
                  Documents saved here stay attached to this project and can
                  ground future project conversations.
                </p>
                <div className="do-project-document-list">
                  {documents.map((document) => {
                    const content = String(
                      document.content ||
                        document.body ||
                        document.description ||
                        "",
                    );
                    return (
                      <article key={document.id}>
                        <span>
                          <FileText size={15} />
                        </span>
                        <div>
                          <small>
                            {document.docType || document.type || "Document"}
                          </small>
                          <strong>
                            {document.title ||
                              document.name ||
                              "Untitled document"}
                          </strong>
                          <p>
                            {document.summary ||
                              content.slice(0, 260) ||
                              "No summary recorded."}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            onClose();
                            onAsk(
                              `Using ${document.title || "this project document"}, help me move ${projectTitle(project)} forward.`,
                            );
                          }}
                          type="button"
                        >
                          Ask about it <ArrowRight size={12} />
                        </button>
                      </article>
                    );
                  })}
                  {documents.length === 0 && (
                    <EmptyState
                      icon={<FileText size={19} />}
                      title="No project documents yet"
                      text="Paste a PRD or specification in the project conversation and ask Certo Work to add it here."
                    />
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === "team" && (
            <div className="do-project-team">
              <section className="do-project-card do-project-card-large">
                <div className="do-project-card-head">
                  <div>
                    <span className="do-project-card-kicker">TEAM CHARTER</span>
                    <h2>Ownership and ways of working</h2>
                  </div>
                  <Users size={17} />
                </div>
                <div className="do-project-field-grid">
                  <EditableField
                    label="Project manager / Scrum Master"
                    onCommit={(projectManager) => update({ projectManager })}
                    placeholder="Name or email"
                    value={project.projectManager || project.scrumMaster}
                  />
                  <EditableField
                    label="Sponsor / Product Owner"
                    onCommit={(sponsor) => update({ sponsor })}
                    placeholder="Name or email"
                    value={project.sponsor || project.productOwner}
                  />
                </div>
                <EditableField
                  label="Team members"
                  multiline
                  onCommit={(teamMembers) => update({ teamMembers })}
                  placeholder="Names or emails, separated by commas"
                  value={
                    Array.isArray(project.teamMembers)
                      ? project.teamMembers.join(", ")
                      : project.teamMembers
                  }
                />
                <EditableField
                  label="Definition of done"
                  multiline
                  onCommit={(definitionOfDone) => update({ definitionOfDone })}
                  placeholder="What must be true before work is considered complete?"
                  value={project.definitionOfDone}
                />
              </section>
              <section className="do-project-card do-team-guidance">
                <Users size={18} />
                <h2>Ready for team planning</h2>
                <p>
                  This record now holds the outcome, method, work, milestones,
                  risks, and ownership in one place. Use the Work tab for
                  Jira-like execution and the Plan tab for Scrum or PMI
                  governance.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onAsk(
                      `Create a complete ${methodology.toUpperCase()} planning agenda for ${projectTitle(project)} with roles, milestones, risks, dependencies, and next actions.`,
                    );
                  }}
                  type="button"
                >
                  <MessageSquare size={14} /> Plan with the team
                </button>
              </section>
              <section className="do-project-card do-project-danger">
                <div>
                  <Archive size={16} />
                  <span>
                    <strong>Archive project</strong>
                    <small>
                      Removes it from active lists without deleting its history.
                    </small>
                  </span>
                </div>
                {archiveConfirm ? (
                  <div>
                    <button
                      onClick={() => setArchiveConfirm(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => onArchiveProject(project)}
                      type="button"
                    >
                      Confirm archive
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setArchiveConfirm(true)} type="button">
                    Archive
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function ProjectConsolePanel({
  project,
  tasks,
  milestones,
  risks,
  documents,
  workspaceMembers = [],
  costTemplates = [],
  conversationId,
  onAsk,
  onUpdateProject,
  onArchiveProject,
  onDeleteProject,
  onRestoreProject,
  onAddTask,
  onUpdateTask,
  onAddRisk,
  onCreateCostTemplate,
  onUpdateCostTemplate,
}: {
  project: any;
  tasks: any[];
  milestones: any[];
  risks: any[];
  documents: any[];
  workspaceMembers?: AssignmentMember[];
  costTemplates?: any[];
  conversationId?: string | null;
  onAsk: (prompt: string) => void;
  onUpdateProject: SharedProjectActions["onUpdateProject"];
  onArchiveProject: SharedProjectActions["onArchiveProject"];
  onDeleteProject?: SharedProjectActions["onDeleteProject"];
  onRestoreProject?: SharedProjectActions["onRestoreProject"];
  onAddTask: (
    title: string,
    status: WorkLane,
    patch?: ProjectPatch,
  ) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: ProjectPatch) => Promise<void> | void;
  onAddRisk: (title: string, patch?: ProjectPatch) => Promise<void> | void;
  onCreateCostTemplate?: (template: any) => Promise<void> | void;
  onUpdateCostTemplate?: (
    templateId: string,
    patch: Record<string, unknown>,
  ) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<
    | "brief"
    | "backlog"
    | "plan"
    | "work"
    | "risks"
    | "team"
    | "costs"
    | "docs"
    | "codex"
  >("brief");
  const [taskTitle, setTaskTitle] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [workType, setWorkType] = useState<WorkItemKind>("pbi");
  const [workParentId, setWorkParentId] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [riskSeverity, setRiskSeverity] = useState("medium");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const assignmentOptions = useMemo(
    () =>
      [
        ...new Set([
          ...workspaceMembers
            .filter((member) => String(member.status || "active") !== "removed")
            .map((member) => memberName(member))
            .filter((name) => name && name !== "Needs alias" && !looksLikeEmail(name)),
          ...tasks
            .map((item) => String(item.owner || item.assignee || "").trim())
            .filter((name) => name && !looksLikeEmail(name)),
        ]),
      ].sort(),
    [tasks, workspaceMembers],
  );
  const methodology = String(project.methodology || "scrum").toLowerCase();
  const currentHealth = projectHealth(project, tasks, risks);
  const openTasks = tasks.filter((task) => taskWorkLane(task) !== "done");
  const openMilestones = milestones.filter(
    (item) => String(item.status || "").toLowerCase() !== "completed",
  );
  const blockedTasks = tasks.filter((task) => taskWorkLane(task) === "blocked");
  const lanes = useMemo(
    () => ({
      backlog: tasks.filter((task) => taskWorkLane(task) === "backlog"),
      in_progress: tasks.filter((task) => taskWorkLane(task) === "in_progress"),
      blocked: blockedTasks,
      done: tasks.filter((task) => taskWorkLane(task) === "done"),
    }),
    [blockedTasks, tasks],
  );
  const hierarchy = useMemo(() => {
    const epics = sortWorkItems(
      tasks.filter((task) => workItemKind(task) === "epic"),
    );
    const features = sortWorkItems(
      tasks.filter((task) => workItemKind(task) === "feature"),
    );
    const pbis = sortWorkItems(
      tasks.filter((task) =>
        ["pbi", "story", "task", "bug"].includes(workItemKind(task)),
      ),
    );
    const subtasks = sortWorkItems(
      tasks.filter((task) => workItemKind(task) === "subtask"),
    );
    return { epics, features, pbis, subtasks };
  }, [tasks]);
  const activeMembers = workspaceMembers.filter(
    (member) => String(member.status || "active") !== "removed",
  );
  const roleOptions = activeMembers.map((member) => ({
    id: member.id,
    name: memberName(member),
  }));

  useEffect(() => {
    setTab("brief");
    setArchiveConfirm(false);
    setDeleteConfirm(false);
  }, [project.id]);

  const update = (patch: ProjectPatch) => onUpdateProject(project.id, patch);
  const submitTask = async () => {
    if (!taskTitle.trim()) return;
    await onAddTask(taskTitle.trim(), "backlog");
    setTaskTitle("");
  };
  const submitWorkItem = async () => {
    if (!workTitle.trim()) return;
    const parent = tasks.find((item) => item.id === workParentId);
    const parentKind = parent ? workItemKind(parent) : null;
    const patch: ProjectPatch = {
      workItemType: workType,
      itemType: workType,
      taskType: workType,
      parentId: workParentId || null,
      epicId: parentKind === "epic" ? workParentId : parent?.epicId || null,
      featureId:
        parentKind === "feature" ? workParentId : parent?.featureId || null,
      priority: null,
      order: tasks.length,
      rank: tasks.length,
    };
    await onAddTask(workTitle.trim(), "backlog", patch);
    setWorkTitle("");
  };
  const moveWorkItem = async (items: any[], item: any, direction: -1 | 1) => {
    const ordered = sortWorkItems(items);
    const index = ordered.findIndex((candidate) => candidate.id === item.id);
    const other = ordered[index + direction];
    if (!other) return;
    const currentOrder = itemOrder(item, index);
    const otherOrder = itemOrder(other, index + direction);
    await onUpdateTask(item.id, { order: otherOrder, rank: otherOrder });
    await onUpdateTask(other.id, { order: currentOrder, rank: currentOrder });
  };
  const datedEpics = hierarchy.epics
    .filter((epic) => taskWorkLane(epic) !== "done")
    .sort((left, right) =>
      String(left.dueDate || left.targetDate || "9999-12-31").localeCompare(
        String(right.dueDate || right.targetDate || "9999-12-31"),
      ),
    );
  const nextMilestone =
    datedEpics[0] ||
    openMilestones[0] ||
    openTasks
      .filter((item) => item.dueDate || item.targetDate)
      .sort((left, right) =>
        String(left.dueDate || left.targetDate).localeCompare(
          String(right.dueDate || right.targetDate),
        ),
      )[0];
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const nextRisk =
    [...risks]
      .filter(
        (risk) =>
          !["closed", "resolved", "accepted"].includes(
            String(risk.status || "open").toLowerCase(),
          ),
      )
      .sort(
        (left, right) =>
          (severityOrder[String(left.severity || "medium").toLowerCase()] ??
            2) -
          (severityOrder[String(right.severity || "medium").toLowerCase()] ??
            2),
      )[0] || blockedTasks[0];
  const parentOptions =
    workType === "epic"
      ? []
      : workType === "feature"
        ? hierarchy.epics
        : workType === "subtask"
          ? hierarchy.pbis
          : [...hierarchy.features, ...hierarchy.epics];
  const tabHelp: Partial<Record<typeof tab, string>> = {
    backlog: "Hierarchy and prioritization: Epic → Feature → PBI → Subtask.",
    work: "Execution board. Use it to move active items through Backlog, Doing, Blocked and Done.",
    team: "Project governance roles and the people allowed to own delivery work.",
    costs:
      "Planned and actual hours, initial investment, recurring costs and unit-based cost drivers.",
    risks:
      "Risk register, severity and the signals used to calculate project health.",
  };
  const renderWorkItemRow = (item: any, peers: any[]) => {
    const kind = workItemKind(item);
    return (
      <article className={`do-backlog-row is-${kind}`} key={item.id}>
        <div className="do-backlog-rank">
          <button
            aria-label={`Move ${projectTitle(item)} up`}
            onClick={() => moveWorkItem(peers, item, -1)}
            type="button"
          >
            <ArrowUp size={12} />
          </button>
          <button
            aria-label={`Move ${projectTitle(item)} down`}
            onClick={() => moveWorkItem(peers, item, 1)}
            type="button"
          >
            <ArrowDown size={12} />
          </button>
        </div>
        <div className="do-backlog-title">
          <span>
            {item.key
              ? `${workItemLabel(kind)} · ${item.key}`
              : workItemLabel(kind)}
          </span>
          <InlineEdit
            ariaLabel={`Title for ${projectTitle(item)}`}
            onCommit={(title) => title && onUpdateTask(item.id, { title })}
            placeholder="Untitled work item"
            value={item.title || item.name}
          />
        </div>
        <select
          aria-label={`Status for ${projectTitle(item)}`}
          onChange={(event) =>
            onUpdateTask(item.id, { status: event.target.value })
          }
          value={canonicalWorkStatus(item)}
        >
          <option value="backlog">Backlog</option>
          <option value="ready">Ready</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="in_review">In review</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          aria-label={`Priority for ${projectTitle(item)}`}
          onChange={(event) =>
            onUpdateTask(item.id, {
              priority:
                event.target.value === "N/A" ? null : event.target.value,
            })
          }
          value={priorityValue(item.priority)}
        >
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="N/A">N/A</option>
        </select>
        <MultiAssigneePicker
          members={workspaceMembers}
          onChange={(assigneeIds, assignees) =>
            onUpdateTask(item.id, {
              assigneeIds,
              assignees,
              owner: assignees[0] || "",
              assignee: assignees[0] || "",
            })
          }
          selectedIds={Array.isArray(item.assigneeIds) ? item.assigneeIds : []}
          selectedNames={
            Array.isArray(item.assignees)
              ? item.assignees
              : [item.owner || item.assignee].filter(Boolean)
          }
        />
        <input
          aria-label={`Due date for ${projectTitle(item)}`}
          defaultValue={dateInputValue(item.dueDate || item.targetDate)}
          onBlur={(event) =>
            onUpdateTask(item.id, { dueDate: event.target.value || null })
          }
          type="date"
        />
      </article>
    );
  };
  const renderExecutableWithSubtasks = (item: any, peers: any[]) => {
    const children = hierarchy.subtasks.filter(
      (subtask) => workItemParentId(subtask) === item.id,
    );
    return (
      <div className="do-backlog-executable" key={item.id}>
        {renderWorkItemRow(item, peers)}
        {children.length > 0 && (
          <div className="do-backlog-subtasks">
            {children.map((subtask) => renderWorkItemRow(subtask, children))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="do-project-console" data-testid="project-console">
      <datalist id="do-project-member-options">
        {assignmentOptions.map((owner) => (
          <option key={owner} value={owner} />
        ))}
      </datalist>
      <div className="do-console-hero">
        <div>
          <span className="do-project-card-kicker">PROJECT CONSOLE</span>
          <InlineEdit
            ariaLabel="Project name"
            onCommit={(title) => title && update({ title, name: title })}
            placeholder="Project name"
            value={projectTitle(project)}
          />
          <p>
            {project.outcome ||
              project.objective ||
              project.description ||
              "Define the outcome so every conversation and work item points to the same finish line."}
          </p>
        </div>
        <button
          aria-label={
            isProjectFavorite(project)
              ? "Remove from favorites"
              : "Add to favorites"
          }
          className={isProjectFavorite(project) ? "is-favorite" : ""}
          onClick={() => update({ favorite: !isProjectFavorite(project) })}
          type="button"
        >
          <Star
            fill={isProjectFavorite(project) ? "currentColor" : "none"}
            size={15}
          />
        </button>
      </div>

      <div className="do-console-metrics">
        <div>
          <strong>{openTasks.length}</strong>
          <span>
            Open{" "}
            <InfoTip
              label="Open work"
              text="All PBIs, tasks, bugs and subtasks that are not completed or cancelled."
            />
          </span>
        </div>
        <div>
          <strong>
            {
              hierarchy.epics.filter((epic) => taskWorkLane(epic) !== "done")
                .length
            }
          </strong>
          <span>
            Open Epics{" "}
            <InfoTip
              label="Epics"
              text="The major outcomes that automatically act as delivery checkpoints."
            />
          </span>
        </div>
        <div className={blockedTasks.length || risks.length ? "is-risk" : ""}>
          <strong>{blockedTasks.length + risks.length}</strong>
          <span>
            Signals{" "}
            <InfoTip
              label="Risk signals"
              text="Open risks plus blocked work items. Severity determines their effect on project health."
            />
          </span>
        </div>
        <div className={healthClass(currentHealth)}>
          <strong>{projectHealthLabel(currentHealth)}</strong>
          <span>
            Health{" "}
            <InfoTip
              label="Project health"
              text="Calculated from blocked work, risk severity, overdue delivery dates and any manual override."
            />
          </span>
        </div>
      </div>

      <div className="do-console-controls">
        <ProjectStatusSelect onUpdate={update} project={project} />
        <label className="do-inline-control">
          <span>
            Stage{" "}
            <InfoTip
              label="Delivery stage"
              text="Define clarifies the project; Onboarding aligns client and team; Build creates it; Deploy releases it; Operations runs and supports it."
            />
          </span>
          <select
            aria-label="Project delivery stage"
            onChange={(event) => update({ deliveryStage: event.target.value })}
            value={deliveryStage(project)}
          >
            {DELIVERY_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {deliveryStageLabels[stage]}
              </option>
            ))}
          </select>
        </label>
        <select
          aria-label="Project method"
          onChange={(event) => update({ methodology: event.target.value })}
          value={methodology}
        >
          <option value="scrum">Scrum</option>
          <option value="pmi">PMI</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <button
          onClick={() =>
            onAsk(
              `Give me the cleanest project update for ${projectTitle(project)}: decision, progress, risk, next action.`,
            )
          }
          type="button"
        >
          <MessageSquare size={13} /> Ask
        </button>
      </div>

      <nav className="do-console-tabs" aria-label="Project console sections">
        {(
          [
            ["brief", "Brief"],
            ["backlog", "Backlog"],
            ["plan", "Plan"],
            ["work", "Board"],
            ["team", "Team"],
            ["costs", "Costs"],
            ["risks", "Risks"],
            ["docs", "Docs"],
            ["codex", "Codex"],
          ] as const
        ).map(([value, label]) => (
          <button
            className={tab === value ? "is-active" : ""}
            key={value}
            onClick={() => setTab(value)}
            type="button"
          >
            <span>{label}</span>
            {tabHelp[value] && (
              <InfoTip label={label} text={tabHelp[value] || ""} />
            )}
          </button>
        ))}
      </nav>

      {tab === "brief" && (
        <div className="do-console-section">
          <EditableField
            aiContext={{ project: projectTitle(project), description: project.description || "" }}
            aiKind="project_outcome"
            label="Outcome"
            multiline
            onCommit={(outcome) => update({ outcome })}
            placeholder="What will be observably true when this project is done?"
            value={project.outcome || project.objective}
          />
          <EditableField
            aiContext={{ project: projectTitle(project), outcome: project.outcome || project.objective || "" }}
            aiKind="project_description"
            label="Project description"
            multiline
            onCommit={(description) => update({ description })}
            placeholder="Purpose, scope, stakeholders and delivery boundary."
            value={project.description}
          />
          <div className="do-console-insights">
            <article>
              <span>
                Next delivery point{" "}
                <InfoTip
                  label="Next delivery point"
                  text="Automatically uses the nearest open Epic due date, then falls back to a legacy milestone or dated item."
                />
              </span>
              <strong>
                {nextMilestone?.title ||
                  nextMilestone?.name ||
                  "No dated Epic yet"}
              </strong>
              <small>
                {nextMilestone?.dueDate ||
                  nextMilestone?.targetDate ||
                  "Add a due date to the next Epic in Backlog."}
              </small>
              <button onClick={() => setTab("backlog")} type="button">
                {nextMilestone ? "Open backlog" : "Create or date an Epic"}
              </button>
            </article>
            <article>
              <span>
                Main risk{" "}
                <InfoTip
                  label="Main risk"
                  text="Automatically selects the highest-severity open risk; blocked work is used when no risk is recorded."
                />
              </span>
              <strong>
                {nextRisk?.title ||
                  nextRisk?.description ||
                  "No active risk recorded"}
              </strong>
              <small>
                {nextRisk
                  ? `${String(nextRisk.severity || "medium").toUpperCase()} · ${nextRisk.mitigation || nextRisk.response || nextRisk.assignee || "Response needs definition"}`
                  : "Add a risk with severity and response."}
              </small>
              <button onClick={() => setTab("risks")} type="button">
                {nextRisk ? "Open risk register" : "Add a risk"}
              </button>
            </article>
          </div>
          <div className="do-console-ask-grid">
            <button
              onClick={() =>
                onAsk(
                  `Create the next coherent implementation batch for ${projectTitle(project)} with owners, dependencies, acceptance evidence, and requirement IDs.`,
                )
              }
              type="button"
            >
              <Sparkles size={13} /> Build next batch
            </button>
            <button
              onClick={() =>
                onAsk(
                  `Prepare a team planning agenda for ${projectTitle(project)} using ${methodology.toUpperCase()} with decisions, roles, milestones, risks, and next actions.`,
                )
              }
              type="button"
            >
              <Users size={13} /> Team planning
            </button>
          </div>
        </div>
      )}

      {tab === "backlog" && (
        <div className="do-console-section">
          <section className="do-planning-session">
            <div>
              <span className="do-project-card-kicker">PLANNING SESSION</span>
              <h4>
                {methodology === "pmi" ? "Scope planning" : "Sprint planning"}
              </h4>
            </div>
            <InlineEdit
              ariaLabel="Planning session name"
              onCommit={(planningSessionName) =>
                update({ planningSessionName })
              }
              placeholder="Session name"
              value={
                project.planningSessionName || project.currentSprintName || ""
              }
            />
            <input
              aria-label="Planning start date"
              defaultValue={dateInputValue(
                project.sprintStartDate || project.planningStartDate,
              )}
              onBlur={(event) =>
                update({ sprintStartDate: event.target.value || null })
              }
              type="date"
            />
            <input
              aria-label="Planning end date"
              defaultValue={dateInputValue(
                project.sprintEndDate || project.planningEndDate,
              )}
              onBlur={(event) =>
                update({ sprintEndDate: event.target.value || null })
              }
              type="date"
            />
            <button
              onClick={() =>
                onAsk(
                  `Run a planning session for ${projectTitle(project)}. Use the current epics, features, PBIs, priorities, owners, risks, and dates. Help me decide the sprint or phase commitment.`,
                )
              }
              type="button"
            >
              <Sparkles size={13} /> Plan session
            </button>
          </section>

          <section className="do-backlog-add">
            <select
              aria-label="Work item type"
              onChange={(event) => {
                setWorkType(event.target.value as WorkItemKind);
                setWorkParentId("");
              }}
              value={workType}
            >
              <option value="epic">Epic</option>
              <option value="feature">Feature</option>
              <option value="pbi">PBI</option>
              <option value="story">Story</option>
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="subtask">Subtask</option>
            </select>
            <select
              aria-label="Parent work item"
              disabled={parentOptions.length === 0}
              onChange={(event) => setWorkParentId(event.target.value)}
              value={workParentId}
            >
              <option value="">
                {workType === "epic"
                  ? "No parent"
                  : workType === "feature"
                    ? "Choose epic"
                    : workType === "subtask"
                      ? "Choose executable parent"
                      : "Choose feature or epic"}
              </option>
              {parentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {workItemLabel(workItemKind(item))} · {projectTitle(item)}
                </option>
              ))}
            </select>
            <input
              onChange={(event) => setWorkTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitWorkItem()}
              placeholder={`Add ${workItemLabel(workType)}...`}
              value={workTitle}
            />
            <button
              disabled={!workTitle.trim()}
              onClick={submitWorkItem}
              type="button"
            >
              <Plus size={13} /> Add
            </button>
          </section>

          <div className="do-backlog-summary">
            <span>
              <strong>{hierarchy.epics.length}</strong> Epics
            </span>
            <span>
              <strong>{hierarchy.features.length}</strong> Features
            </span>
            <span>
              <strong>{hierarchy.pbis.length}</strong> Executable
            </span>
            <span>
              <strong>{hierarchy.subtasks.length}</strong> Subtasks
            </span>
          </div>

          <div className="do-backlog-tree">
            {hierarchy.epics.map((epic) => {
              const epicFeatures = hierarchy.features.filter(
                (feature) =>
                  workItemParentId(feature) === epic.id ||
                  feature.epicId === epic.id,
              );
              const epicPbis = hierarchy.pbis.filter(
                (pbi) =>
                  (pbi.parentId === epic.id || pbi.epicId === epic.id) &&
                  !pbi.featureId,
              );
              return (
                <section className="do-backlog-epic" key={epic.id}>
                  {renderWorkItemRow(epic, hierarchy.epics)}
                  <div className="do-backlog-children">
                    {epicFeatures.map((feature) => {
                      const featurePbis = hierarchy.pbis.filter(
                        (pbi) =>
                          pbi.parentId === feature.id ||
                          pbi.featureId === feature.id,
                      );
                      return (
                        <div className="do-backlog-feature" key={feature.id}>
                          {renderWorkItemRow(feature, epicFeatures)}
                          <div className="do-backlog-children is-pbis">
                            {featurePbis.map((pbi) =>
                              renderExecutableWithSubtasks(pbi, featurePbis),
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {epicPbis.map((pbi) =>
                      renderExecutableWithSubtasks(pbi, epicPbis),
                    )}
                  </div>
                </section>
              );
            })}

            {hierarchy.features
              .filter((feature) => !workItemParentId(feature))
              .map((feature) => {
                const featurePbis = hierarchy.pbis.filter(
                  (pbi) =>
                    pbi.parentId === feature.id || pbi.featureId === feature.id,
                );
                return (
                  <section
                    className="do-backlog-epic is-unassigned"
                    key={feature.id}
                  >
                    {renderWorkItemRow(
                      feature,
                      hierarchy.features.filter(
                        (item) => !workItemParentId(item),
                      ),
                    )}
                    <div className="do-backlog-children is-pbis">
                      {featurePbis.map((pbi) =>
                        renderExecutableWithSubtasks(pbi, featurePbis),
                      )}
                    </div>
                  </section>
                );
              })}

            {hierarchy.pbis.filter((pbi) => !workItemParentId(pbi)).length >
              0 && (
              <section className="do-backlog-epic is-unassigned">
                <header>
                  <strong>Unassigned PBIs</strong>
                  <span>
                    {
                      hierarchy.pbis.filter((pbi) => !workItemParentId(pbi))
                        .length
                    }
                  </span>
                </header>
                {hierarchy.pbis
                  .filter((pbi) => !workItemParentId(pbi))
                  .map((pbi) =>
                    renderExecutableWithSubtasks(
                      pbi,
                      hierarchy.pbis.filter((item) => !workItemParentId(item)),
                    ),
                  )}
              </section>
            )}

            {hierarchy.subtasks.filter(
              (subtask) =>
                !hierarchy.pbis.some(
                  (item) => item.id === workItemParentId(subtask),
                ),
            ).length > 0 && (
              <section className="do-backlog-epic is-unassigned">
                <header>
                  <strong>Unassigned subtasks</strong>
                  <span>
                    {
                      hierarchy.subtasks.filter(
                        (subtask) =>
                          !hierarchy.pbis.some(
                            (item) => item.id === workItemParentId(subtask),
                          ),
                      ).length
                    }
                  </span>
                </header>
                {hierarchy.subtasks
                  .filter(
                    (subtask) =>
                      !hierarchy.pbis.some(
                        (item) => item.id === workItemParentId(subtask),
                      ),
                  )
                  .map((subtask) =>
                    renderWorkItemRow(subtask, hierarchy.subtasks),
                  )}
              </section>
            )}

            {tasks.length === 0 && (
              <EmptyState
                icon={<ListChecks size={18} />}
                title="No backlog yet"
                text="Create epics, features, and PBIs here, or ask Certo Work to extract them from the PRD."
              />
            )}
          </div>
        </div>
      )}

      {tab === "plan" && (
        <div className="do-console-section">
          <EditableField
            label={
              methodology === "pmi" ? "Delivery governance" : "Sprint goal"
            }
            multiline
            onCommit={(sprintGoal) => update({ sprintGoal })}
            placeholder={
              methodology === "pmi"
                ? "Scope, approvals, controls, and closeout criteria."
                : "What should this sprint prove or deliver?"
            }
            value={project.sprintGoal || project.deliveryGovernance}
          />
          <div className="do-section-title">
            <div>
              <span className="do-project-card-kicker">
                AUTO-GENERATED CHECKPOINTS
              </span>
              <h4>Epic delivery plan</h4>
            </div>
            <InfoTip
              label="Epic checkpoints"
              text="Every open Epic becomes a delivery checkpoint. Add its owner and due date in Backlog; the Brief updates automatically."
            />
          </div>
          <div className="do-console-list">
            {hierarchy.epics.map((epic) => (
              <article key={epic.id}>
                <Flag size={13} />
                <span>
                  <strong>{epic.title || epic.name}</strong>
                  <small>
                    {epic.dueDate || epic.targetDate || "No due date"} ·{" "}
                    {canonicalWorkStatus(epic)}
                  </small>
                </span>
                <button onClick={() => setTab("backlog")} type="button">
                  Edit
                </button>
              </article>
            ))}
            {hierarchy.epics.length === 0 && (
              <EmptyState
                icon={<Flag size={18} />}
                title="No Epics yet"
                text="Create the first Epic in Backlog; it will automatically appear here as a delivery checkpoint."
              />
            )}
          </div>
          {milestones.length > 0 && (
            <details className="do-legacy-milestones">
              <summary>
                {milestones.length} legacy milestone
                {milestones.length === 1 ? "" : "s"}
              </summary>
              <div>
                {milestones.map((milestone) => (
                  <span key={milestone.id}>
                    {milestone.title || milestone.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === "work" && (
        <div className="do-console-section">
          <div className="do-project-inline-add do-console-add">
            <input
              onChange={(event) => setTaskTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitTask()}
              placeholder="Add work item..."
              value={taskTitle}
            />
            <button
              disabled={!taskTitle.trim()}
              onClick={submitTask}
              type="button"
            >
              <Plus size={13} /> Add
            </button>
          </div>
          <div className="do-console-board">
            {(
              [
                ["backlog", "Backlog"],
                ["in_progress", "Doing"],
                ["blocked", "Blocked"],
                ["done", "Done"],
              ] as const
            ).map(([lane, label]) => (
              <section key={lane}>
                <header>
                  <span>{label}</span>
                  <small>{lanes[lane].length}</small>
                </header>
                {lanes[lane].slice(0, 8).map((task) => (
                  <article key={task.id}>
                    <strong>{task.title || task.name}</strong>
                    <select
                      aria-label={`Move ${task.title || "task"}`}
                      onChange={(event) =>
                        onUpdateTask(task.id, { status: event.target.value })
                      }
                      value={lane}
                    >
                      <option value="backlog">Backlog</option>
                      <option value="in_progress">Doing</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  </article>
                ))}
                {lanes[lane].length === 0 && <p>No work here</p>}
              </section>
            ))}
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="do-console-section">
          <div className="do-section-title">
            <div>
              <span className="do-project-card-kicker">PROJECT GOVERNANCE</span>
              <h4>Accountability and delivery team</h4>
            </div>
            <InfoTip
              label="Project roles"
              text="The Project Manager owns delivery, the Product Owner owns value and backlog decisions, and Sponsors provide authority, funding and escalation support."
            />
          </div>
          <div className="do-project-role-grid">
            <label>
              <span>
                Project Manager{" "}
                <InfoTip
                  label="Project Manager"
                  text="Owns delivery plan, coordination, dependencies, status and escalation."
                />
              </span>
              <select
                onChange={(event) =>
                  update({
                    projectManagerId: event.target.value || null,
                    projectManager:
                      roleOptions.find(
                        (option) => option.id === event.target.value,
                      )?.name || "",
                  })
                }
                value={project.projectManagerId || ""}
              >
                <option value="">Unassigned</option>
                {roleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Product Owner{" "}
                <InfoTip
                  label="Product Owner"
                  text="Owns desired outcomes, backlog priority and acceptance decisions."
                />
              </span>
              <select
                onChange={(event) =>
                  update({
                    productOwnerId: event.target.value || null,
                    productOwner:
                      roleOptions.find(
                        (option) => option.id === event.target.value,
                      )?.name || "",
                  })
                }
                value={project.productOwnerId || ""}
              >
                <option value="">Unassigned</option>
                {roleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Solution Architect{" "}
                <InfoTip
                  label="Solution Architect"
                  text="Owns the solution design, technical coherence, non-functional requirements and architecture decisions."
                />
              </span>
              <select
                onChange={(event) =>
                  update({
                    solutionArchitectId: event.target.value || null,
                    solutionArchitect:
                      roleOptions.find(
                        (option) => option.id === event.target.value,
                      )?.name || "",
                  })
                }
                value={project.solutionArchitectId || ""}
              >
                <option value="">Unassigned</option>
                {roleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Delivery / Tech Lead{" "}
                <InfoTip
                  label="Delivery lead"
                  text="Owns technical execution, engineering quality and implementation readiness."
                />
              </span>
              <select
                onChange={(event) =>
                  update({
                    deliveryLeadId: event.target.value || null,
                    deliveryLead:
                      roleOptions.find(
                        (option) => option.id === event.target.value,
                      )?.name || "",
                  })
                }
                value={project.deliveryLeadId || ""}
              >
                <option value="">Unassigned</option>
                {roleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Client Lead{" "}
                <InfoTip
                  label="Client lead"
                  text="Primary client-side owner for decisions, access and acceptance."
                />
              </span>
              <select
                onChange={(event) =>
                  update({
                    clientLeadId: event.target.value || null,
                    clientLead:
                      roleOptions.find(
                        (option) => option.id === event.target.value,
                      )?.name || "",
                  })
                }
                value={project.clientLeadId || ""}
              >
                <option value="">Unassigned</option>
                {roleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="do-project-team-pickers">
            <section>
              <span>
                Sponsors{" "}
                <InfoTip
                  label="Sponsors"
                  text="One or more executives who provide mandate, funding and escalation decisions."
                />
              </span>
              <MultiAssigneePicker
                label="Sponsors"
                members={workspaceMembers}
                onChange={(sponsorIds, sponsors) =>
                  update({ sponsorIds, sponsors, sponsor: sponsors[0] || "" })
                }
                selectedIds={
                  Array.isArray(project.sponsorIds) ? project.sponsorIds : []
                }
                selectedNames={
                  Array.isArray(project.sponsors)
                    ? project.sponsors
                    : [project.sponsor].filter(Boolean)
                }
              />
            </section>
            <section>
              <span>
                Project team{" "}
                <InfoTip
                  label="Project team"
                  text="People who may be assigned to Epics, Features, PBIs, tasks, bugs or subtasks."
                />
              </span>
              <MultiAssigneePicker
                label="Project team"
                members={workspaceMembers}
                onChange={(teamMemberIds, teamMembers) =>
                  update({ teamMemberIds, teamMembers })
                }
                selectedIds={
                  Array.isArray(project.teamMemberIds)
                    ? project.teamMemberIds
                    : []
                }
                selectedNames={
                  Array.isArray(project.teamMembers) ? project.teamMembers : []
                }
              />
            </section>
          </div>
        </div>
      )}

      {tab === "costs" && (
        <div className="do-console-section">
          <div className="do-section-title">
            <div>
              <span className="do-project-card-kicker">
                PROJECT FINANCIAL LEDGER
              </span>
              <h4>Builds, monthly operations, revenue and collections</h4>
            </div>
            <InfoTip
              label="Project finances"
              text="Create a separate period for each build or change request and for each operating month. Record costs and revenue in the same period, while invoices and collections retain independent status."
            />
          </div>
          <ProjectFinanceLedger
            project={project}
            templates={costTemplates}
            onCreateCostTemplate={onCreateCostTemplate}
            onUpdateCostTemplate={onUpdateCostTemplate}
            onUpdateProject={onUpdateProject}
          />
        </div>
      )}

      {tab === "risks" && (
        <div className="do-console-section">
          <div className="do-health-explainer">
            <div>
              <span className="do-project-card-kicker">PROJECT HEALTH</span>
              <h4>{projectHealthLabel(currentHealth)}</h4>
              <p>
                Auto health checks blocked items, open risk severity and overdue
                project dates. Use a manual override only when the delivery lead
                has evidence the automatic signal is wrong.
              </p>
            </div>
            <label>
              <span>
                Mode{" "}
                <InfoTip
                  label="Health mode"
                  text="Auto is recommended. A manual override stays in effect until you return this field to Auto."
                />
              </span>
              <select
                aria-label="Project health mode"
                onChange={(event) =>
                  update({
                    healthOverride:
                      event.target.value === "auto" ? null : event.target.value,
                  })
                }
                value={project.healthOverride || "auto"}
              >
                <option value="auto">
                  Auto · {projectHealthLabel(currentHealth)}
                </option>
                {PROJECT_HEALTH.map((health) => (
                  <option key={health} value={health}>
                    Override · {projectHealthLabel(health)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="do-console-list">
            {risks.map((risk) => (
              <article key={risk.id}>
                <AlertTriangle size={13} />
                <span>
                  <strong>{risk.title || risk.description}</strong>
                  <small>
                    {String(risk.severity || "medium").toUpperCase()} ·{" "}
                    {risk.response ||
                      risk.mitigation ||
                      risk.owner ||
                      "Response needs definition"}
                  </small>
                </span>
              </article>
            ))}
            {blockedTasks.map((task) => (
              <article key={`task-${task.id}`}>
                <Circle size={13} />
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    Blocked work item · {task.assignee || "Unassigned"}
                  </small>
                </span>
              </article>
            ))}
            {risks.length === 0 && blockedTasks.length === 0 && (
              <EmptyState
                icon={<CheckCircle2 size={18} />}
                title="No open risks"
                text="Add risks early, while they are still manageable."
              />
            )}
          </div>
          <div className="do-project-inline-add do-risk-add">
            <select
              aria-label="New risk severity"
              onChange={(event) => setRiskSeverity(event.target.value)}
              value={riskSeverity}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input
              onChange={(event) => setRiskTitle(event.target.value)}
              onKeyDown={async (event) => {
                if (event.key === "Enter" && riskTitle.trim()) {
                  await onAddRisk(riskTitle.trim(), { severity: riskSeverity });
                  setRiskTitle("");
                }
              }}
              placeholder="Add risk or assumption..."
              value={riskTitle}
            />
            <button
              disabled={!riskTitle.trim()}
              onClick={async () => {
                await onAddRisk(riskTitle.trim(), { severity: riskSeverity });
                setRiskTitle("");
              }}
              type="button"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      )}

      {tab === "docs" && (
        <div className="do-console-section">
          <div className="do-console-list">
            {documents.map((document) => {
              const content = String(
                document.content || document.body || document.description || "",
              );
              return (
                <article key={document.id}>
                  <FileText size={13} />
                  <span>
                    <strong>
                      {document.title || document.name || "Untitled document"}
                    </strong>
                    <small>
                      {document.summary ||
                        content.slice(0, 120) ||
                        "No summary recorded."}
                    </small>
                  </span>
                  <button
                    onClick={() =>
                      onAsk(
                        `Using ${document.title || "this project document"}, tell me what ${projectTitle(project)} should do next.`,
                      )
                    }
                    type="button"
                  >
                    <ArrowRight size={12} />
                  </button>
                </article>
              );
            })}
            {documents.length === 0 && (
              <EmptyState
                icon={<FileText size={18} />}
                title="No docs yet"
                text="Paste a PRD in this project conversation and ask Certo Work to save it here."
              />
            )}
          </div>
        </div>
      )}

      {tab === "codex" && (
        <CodexBridgePanel
          conversationId={conversationId}
          documents={documents}
          project={project}
          tasks={tasks}
        />
      )}

      <div className="do-console-danger">
        {String(project.status || "").toLowerCase() === "deleted" &&
        onRestoreProject ? (
          <button onClick={() => onRestoreProject(project)} type="button">
            Restore project
          </button>
        ) : (
          <>
            {archiveConfirm ? (
              <>
                <button onClick={() => setArchiveConfirm(false)} type="button">
                  Cancel
                </button>
                <button onClick={() => onArchiveProject(project)} type="button">
                  Confirm archive
                </button>
              </>
            ) : (
              <button onClick={() => setArchiveConfirm(true)} type="button">
                <Archive size={13} /> Archive
              </button>
            )}
            {onDeleteProject &&
              (deleteConfirm ? (
                <>
                  <button onClick={() => setDeleteConfirm(false)} type="button">
                    Cancel
                  </button>
                  <button
                    onClick={() => onDeleteProject(project)}
                    type="button"
                  >
                    Move to deleted
                  </button>
                </>
              ) : (
                <button onClick={() => setDeleteConfirm(true)} type="button">
                  <X size={13} /> Delete · restore for 30 days
                </button>
              ))}
          </>
        )}
      </div>
    </section>
  );
}

type PortfolioView = "dashboard" | "overview" | "economics";
type ProjectSortKey =
  | "project"
  | "delivery_entity"
  | "client_entity"
  | "work_category"
  | "product_phase"
  | "stage"
  | "phase"
  | "status"
  | "health"
  | "progress"
  | "due"
  | "solution_architect"
  | "project_manager"
  | "next_step"
  | "hours"
  | "economics";
type PortfolioDimension =
  | "bpo"
  | "client"
  | "work_category"
  | "product_phase"
  | "stage"
  | "status"
  | "health"
  | "service"
  | "owner";
type PortfolioViewFilters = {
  filter: string;
  stageFilter: "all" | DeliveryStage;
  phaseFilter: string;
  healthFilter: string;
  tagFilter: string;
  workCategoryFilter: string;
  productPhaseFilter: string;
  taxonomyDimension: PortfolioDimension;
  taxonomyValue: string | null;
  search: string;
  view: PortfolioView;
  primarySort: ProjectSortKey;
  secondarySort: ProjectSortKey;
};
type PortfolioSavedView = {
  name: string;
  columns: PortfolioColumnKey[];
  widths?: Partial<Record<PortfolioColumnKey, number>>;
  filters?: Partial<PortfolioViewFilters>;
};

const projectSortOptions: Array<{ value: ProjectSortKey; label: string }> = [
  { value: "project", label: "Project / taxonomy" },
  { value: "delivery_entity", label: "Delivery Entity" },
  { value: "client_entity", label: "Client Entity" },
  { value: "work_category", label: "Work Category" },
  { value: "product_phase", label: "Product Phase" },
  { value: "stage", label: "Stage" },
  { value: "phase", label: "Phase" },
  { value: "status", label: "Status" },
  { value: "health", label: "Health" },
  { value: "progress", label: "Progress" },
  { value: "due", label: "Due" },
  { value: "solution_architect", label: "Solution Architect" },
  { value: "project_manager", label: "Project Manager" },
  { value: "next_step", label: "Next step" },
  { value: "hours", label: "Hours" },
  { value: "economics", label: "Economics" },
];

const portfolioDimensionOptions: Array<{
  value: PortfolioDimension;
  label: string;
}> = [
  { value: "bpo", label: "Delivery Entity" },
  { value: "client", label: "Client Entity" },
  { value: "work_category", label: "Work Category" },
  { value: "product_phase", label: "Product Phase" },
  { value: "stage", label: "Delivery stage" },
  { value: "status", label: "Status" },
  { value: "health", label: "Health" },
  { value: "service", label: "Service" },
  { value: "owner", label: "Accountable owner" },
];

const COST_UNITS = [
  "hour",
  "ai_minute",
  "transaction",
  "hit",
  "mb",
  "fee",
  "license",
  "other",
] as const;
const costUnitLabels: Record<string, string> = {
  hour: "Hour",
  ai_minute: "AI voice minute",
  transaction: "Transaction",
  hit: "Hit / request",
  mb: "MB",
  fee: "Fee",
  license: "License",
  other: "Other",
};

const COST_TYPES = [
  "Direct Cost",
  "Direct Allocation Cost",
  "Recurring Cost",
  "Pass-through Cost",
  "Internal Cost",
  "Revenue",
] as const;

const ALLOCATION_STAGES = [
  "Define",
  "Onboarding",
  "Build",
  "Deploy",
  "Operations",
  "Change Request",
  "Support",
] as const;

const COST_TEMPLATES = [
  {
    id: "cost-allocation-example",
    name: "Cost allocation model",
    description:
      "Direct costs, allocated team hours, vendor usage and build consumption.",
    rows: [
      {
        dimension: "External Developers Solution Architecture",
        costType: "Direct Cost",
        allocationStage: "Build",
        serviceSolution: "Agentic Project",
        unit: "hour",
        plannedQty: 150,
        actualQty: 0,
        rate: 45,
        vendor: "Vendor A",
      },
      {
        dimension: "External Developers",
        costType: "Direct Cost",
        allocationStage: "Build",
        serviceSolution: "Agentic Project",
        unit: "hour",
        plannedQty: 150,
        actualQty: 0,
        rate: 45,
        vendor: "Vendor B",
      },
      {
        dimension: "Internal allocation hours",
        costType: "Direct Allocation Cost",
        allocationStage: "Build",
        serviceSolution: "Agentic Project",
        unit: "hour",
        plannedQty: 100,
        actualQty: 0,
        rate: 23,
        assignee: "Unassigned",
      },
      {
        dimension: "AI consumption for build phase",
        costType: "Direct Cost",
        allocationStage: "Build",
        serviceSolution: "Agentic Project",
        unit: "ai_minute",
        plannedQty: 2300,
        actualQty: 0,
        rate: 0.43,
        vendor: "Retell AI",
      },
    ],
  },
  {
    id: "ai-voice-retell",
    name: "AI voice + delivery",
    description:
      "Development, implementation, support and voice minutes from a provider such as Retell.",
    rows: [
      {
        dimension: "Development",
        unit: "hour",
        plannedQty: 120,
        actualQty: 0,
        rate: 95,
      },
      {
        dimension: "Implementation",
        unit: "hour",
        plannedQty: 48,
        actualQty: 0,
        rate: 85,
      },
      {
        dimension: "Support",
        unit: "hour",
        plannedQty: 24,
        actualQty: 0,
        rate: 75,
      },
      {
        dimension: "Retell voice",
        unit: "ai_minute",
        plannedQty: 4000,
        actualQty: 0,
        rate: 0.07,
      },
      {
        dimension: "Platform fee",
        unit: "fee",
        plannedQty: 1,
        actualQty: 0,
        rate: 250,
      },
    ],
  },
  {
    id: "usage-based-platform",
    name: "Usage-based platform",
    description: "Mix of hours, transactions, hits and data transfer.",
    rows: [
      {
        dimension: "Development",
        unit: "hour",
        plannedQty: 80,
        actualQty: 0,
        rate: 95,
      },
      {
        dimension: "Transactions",
        unit: "transaction",
        plannedQty: 10000,
        actualQty: 0,
        rate: 0.03,
      },
      {
        dimension: "API calls",
        unit: "hit",
        plannedQty: 250000,
        actualQty: 0,
        rate: 0.002,
      },
      {
        dimension: "Data transfer",
        unit: "mb",
        plannedQty: 50000,
        actualQty: 0,
        rate: 0.01,
      },
      {
        dimension: "Support",
        unit: "hour",
        plannedQty: 18,
        actualQty: 0,
        rate: 75,
      },
    ],
  },
  {
    id: "managed-operations",
    name: "Managed operations",
    description: "Recurring support with implementation and fixed fees.",
    rows: [
      {
        dimension: "Implementation",
        unit: "hour",
        plannedQty: 36,
        actualQty: 0,
        rate: 85,
      },
      {
        dimension: "Support",
        unit: "hour",
        plannedQty: 60,
        actualQty: 0,
        rate: 75,
      },
      {
        dimension: "Monitoring fee",
        unit: "fee",
        plannedQty: 1,
        actualQty: 0,
        rate: 600,
      },
      {
        dimension: "License",
        unit: "license",
        plannedQty: 1,
        actualQty: 0,
        rate: 300,
      },
    ],
  },
];

function deliveryStage(project: any): DeliveryStage {
  return normalizeDeliveryStage(project);
}

function moneyValue(value: any) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function inferredCostCategory(row: any) {
  const value = String(row?.dimension || "").toLowerCase();
  if (value.includes("support")) return "support";
  if (value.includes("implement")) return "implementation";
  if (value.includes("develop")) return "development";
  if (value.includes("license")) return "license";
  if (
    ["ai_minute", "transaction", "hit", "mb"].includes(String(row?.unit || ""))
  )
    return "vendor";
  return "other";
}

function inferredCostCadence(row: any) {
  const value = String(row?.dimension || "").toLowerCase();
  if (
    ["ai_minute", "transaction", "hit", "mb"].includes(String(row?.unit || ""))
  )
    return "usage";
  if (
    value.includes("support") ||
    value.includes("license") ||
    value.includes("monitor")
  )
    return "recurring";
  return "initial";
}

function costRows(project: any) {
  const rows = Array.isArray(project?.costBreakdown)
    ? project.costBreakdown
    : [];
  if (rows.length)
    return rows.map((row: any) => ({
      ...row,
      category: row.category || inferredCostCategory(row),
      cadence: row.cadence || inferredCostCadence(row),
      unit: row.unit || "hour",
      plannedQty: Number(row.plannedQty ?? row.plannedHours ?? 0),
      actualQty: Number(row.actualQty ?? row.actualHours ?? 0),
      rate: Number(row.rate || row.unitRate || 0),
    }));
  return [
    {
      dimension: "Development",
      category: "development",
      cadence: "initial",
      unit: "hour",
      plannedQty: Number(project?.developmentHoursPlanned || 0),
      actualQty: Number(project?.developmentHoursSpent || 0),
      rate: Number(project?.developmentHourlyRate || 0),
    },
    {
      dimension: "Implementation",
      category: "implementation",
      cadence: "initial",
      unit: "hour",
      plannedQty: Number(project?.implementationHoursPlanned || 0),
      actualQty: Number(project?.implementationHoursSpent || 0),
      rate: Number(project?.implementationHourlyRate || 0),
    },
    {
      dimension: "Support",
      category: "support",
      cadence: "recurring",
      unit: "hour",
      plannedQty: Number(project?.supportHoursPlanned || 0),
      actualQty: Number(project?.supportHoursSpent || 0),
      rate: Number(project?.supportHourlyRate || 0),
    },
  ];
}

function rowCost(row: any, actual = false) {
  return (
    Number(
      actual
        ? (row?.actualQty ?? row?.actualHours ?? 0)
        : (row?.plannedQty ?? row?.plannedHours ?? 0),
    ) * Number(row?.rate || 0)
  );
}

function rowHours(row: any, actual = false) {
  if (String(row?.unit || "hour") !== "hour") return 0;
  return Number(
    actual
      ? (row?.actualQty ?? row?.actualHours ?? 0)
      : (row?.plannedQty ?? row?.plannedHours ?? 0),
  );
}

function ProjectFinanceLedger({
  project,
  templates = [],
  onUpdateProject,
  onCreateCostTemplate,
  onUpdateCostTemplate,
  compact = false,
}: {
  project: any;
  templates?: any[];
  onUpdateProject: SharedProjectActions["onUpdateProject"];
  onCreateCostTemplate?: (template: any) => Promise<void> | void;
  onUpdateCostTemplate?: (
    templateId: string,
    patch: Record<string, unknown>,
  ) => Promise<void> | void;
  compact?: boolean;
}) {
  const periods = normalizedFinancePeriods(project);
  const summary = financeSummary(periods);
  const capacityAllocations = financeCapacityAllocations(periods);
  const [newKind, setNewKind] = useState<FinancePeriodKind>("build");
  const [newBuildLabel, setNewBuildLabel] = useState("V1");
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [templateId, setTemplateId] = useState("none");
  const today = new Date().toISOString().slice(0, 10);
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Date(2026, index, 1).toLocaleDateString(undefined, {
      month: "long",
    }),
  }));
  const yearOptions = Array.from(
    { length: 9 },
    (_, index) => new Date().getFullYear() - 2 + index,
  );
  const accountingMonthOptions = yearOptions.flatMap((year) =>
    monthOptions.map((month) => ({
      value: `${year}-${String(month.value).padStart(2, "0")}`,
      label: `${month.label} ${year}`,
    })),
  );
  const availableTemplates = [
    ...COST_TEMPLATES,
    ...templates.filter(
      (template) =>
        !COST_TEMPLATES.some((builtin) => builtin.id === template.id),
    ),
  ];
  const updatePeriods = (next: FinancePeriod[]) =>
    onUpdateProject(project.id, {
      financePeriods: stripUndefinedValues(next),
    });
  const updatePeriod = (periodId: string, patch: Partial<FinancePeriod>) =>
    updatePeriods(
      periods.map((period) =>
        period.id === periodId ? { ...period, ...patch } : period,
      ),
    );
  const updateEntry = (
    periodId: string,
    entryId: string,
    patch: Partial<FinanceEntry>,
  ) =>
    updatePeriods(
      periods.map((period) =>
        period.id === periodId
          ? {
              ...period,
              entries: period.entries.map((entry) =>
                entry.id === entryId ? { ...entry, ...patch } : entry,
              ),
            }
          : period,
      ),
    );
  const removeEntry = (periodId: string, entryId: string) =>
    updatePeriods(
      periods.map((period) =>
        period.id === periodId
          ? {
              ...period,
              entries: period.entries.filter((entry) => entry.id !== entryId),
            }
          : period,
      ),
    );
  const addEntry = (periodId: string, direction: FinanceDirection) =>
    updatePeriods(
      periods.map((period) =>
        period.id === periodId
          ? {
              ...period,
              entries: [
                ...period.entries,
                {
                  id: financeId("entry"),
                  direction,
                  description:
                    direction === "cost" ? "New cost" : "New invoice",
                  category: direction === "cost" ? "development" : "revenue",
                  costType: direction === "cost" ? "Direct Cost" : "Revenue",
                  allocationStage:
                    period.kind === "monthly"
                      ? "Operations"
                      : deliveryStageLabels[deliveryStage(project)],
                  serviceSolution:
                    project.serviceLine || project.technology || "Delivery",
                  unit: "fee",
                  plannedQty: 1,
                  actualQty: 1,
                  plannedRate: 0,
                  rate: 0,
                  vendor: "",
                  assignee: "",
                  accountingMonth:
                    period.year && period.month
                      ? `${period.year}-${String(period.month).padStart(2, "0")}`
                      : "",
                  transactionDate: today,
                  financialStatus: "not_billed",
                  referenceNumber: "",
                  issueDate: "",
                  dueDate: "",
                  invoiceStatus:
                    direction === "revenue" ? "not_billed" : undefined,
                  costStatus: direction === "cost" ? "planned" : undefined,
                  paymentStatus: direction === "revenue" ? "unpaid" : "planned",
                  settledAmount: 0,
                  settledDate: "",
                },
              ],
            }
          : period,
      ),
    );
  const addPeriod = () => {
    const year = newYear;
    const month = newMonth;
    const selectedTemplate = availableTemplates.find(
      (template) => template.id === templateId,
    );
    const entries =
      newKind === "build" && selectedTemplate
        ? selectedTemplate.rows.map((row: any) => ({
            id: financeId("entry"),
            direction: "cost" as const,
            description: row.dimension || "Cost item",
            category: row.category || inferredCostCategory(row),
            costType: row.costType || "Direct Cost",
            allocationStage: row.allocationStage || deliveryStageLabels[deliveryStage(project)],
            serviceSolution:
              row.serviceSolution ||
              project.serviceLine ||
              project.technology ||
              "Delivery",
            unit: row.unit || "hour",
            plannedQty: Number(row.plannedQty || 0),
            actualQty: Number(row.actualQty || 0),
            plannedRate: Number(row.rate || 0),
            rate: Number(row.rate || 0),
            vendor: row.vendor || "",
            assignee: row.assignee || "",
            accountingMonth: `${year}-${String(month).padStart(2, "0")}`,
            transactionDate: today,
            financialStatus: "not_billed",
            costStatus: "planned",
            paymentStatus: "planned",
            settledAmount: 0,
          }))
        : [];
    const label =
      newKind === "monthly"
        ? new Date(year, Math.max(0, month - 1), 1).toLocaleDateString(
            undefined,
            { month: "long", year: "numeric" },
          )
        : `Build ${newBuildLabel.trim() || `V${periods.filter((period) => period.kind === "build").length + 1}`}`;
    updatePeriods([
      ...periods,
      {
        id: financeId("period"),
        kind: newKind,
        label,
        month,
        year,
        status: "planned",
        currency: project.currency || "USD",
        billingStatus: "not_billed",
        collectionStatus: "unpaid",
        sourceTemplateId:
          selectedTemplate &&
          !COST_TEMPLATES.some(
            (template) => template.id === selectedTemplate.id,
          )
            ? selectedTemplate.id
            : undefined,
        entries,
      },
    ]);
  };
  const migrateLegacy = () => {
    const entries = costRows(project)
      .filter((row: any) => row.plannedQty || row.actualQty || row.rate)
      .map((row: any) => ({
        id: financeId("entry"),
        direction: "cost" as const,
        description: row.dimension,
        category: row.category,
        costType: row.costType || "Direct Cost",
        allocationStage:
          row.allocationStage || deliveryStageLabels[deliveryStage(project)],
        serviceSolution:
          row.serviceSolution ||
          project.serviceLine ||
          project.technology ||
          "Delivery",
        unit: row.unit,
        plannedQty: row.plannedQty,
        actualQty: row.actualQty,
        plannedRate: row.rate,
        rate: row.rate,
        vendor: row.vendor || "",
        assignee: row.assignee || "",
        accountingMonth: `${newYear}-${String(newMonth).padStart(2, "0")}`,
        transactionDate: today,
        financialStatus: "not_billed",
        costStatus: "planned",
        paymentStatus: "planned",
        settledAmount: 0,
      }));
    if (!entries.length) return;
    updatePeriods([
      {
        id: financeId("period"),
        kind: "build",
        label: "Build V1 · legacy baseline",
        month: newMonth,
        year: newYear,
        status: "active",
        currency: project.currency || "USD",
        billingStatus: "not_billed",
        collectionStatus: "unpaid",
        entries,
      },
    ]);
  };
  const savePeriodTemplate = async (period: FinancePeriod) => {
    if (!onCreateCostTemplate) return;
    const name = window
      .prompt("Template name", `${projectTitle(project)} · ${period.label}`)
      ?.trim();
    if (!name) return;
    await onCreateCostTemplate({
      name,
      description: `Financial cost template from ${projectTitle(project)} · ${period.label}.`,
      rows: period.entries
        .filter((entry) => entry.direction === "cost")
        .map((entry) => ({
          dimension: entry.description,
          category: entry.category,
          costType: entry.costType || "Direct Cost",
          allocationStage: entry.allocationStage || "Build",
          serviceSolution: entry.serviceSolution || "Delivery",
          unit: entry.unit,
          plannedQty: entry.plannedQty,
          actualQty: 0,
          rate: entry.rate,
          vendor: entry.vendor || "",
          assignee: entry.assignee || "",
        })),
    });
  };
  const updatePeriodTemplate = async (period: FinancePeriod) => {
    if (!period.sourceTemplateId || !onUpdateCostTemplate) return;
    await onUpdateCostTemplate(period.sourceTemplateId, {
      rows: period.entries
        .filter((entry) => entry.direction === "cost")
        .map((entry) => ({
          dimension: entry.description,
          category: entry.category,
          costType: entry.costType || "Direct Cost",
          allocationStage: entry.allocationStage || "Build",
          serviceSolution: entry.serviceSolution || "Delivery",
          unit: entry.unit,
          plannedQty: entry.plannedQty,
          actualQty: 0,
          rate: entry.rate,
          vendor: entry.vendor || "",
          assignee: entry.assignee || "",
        })),
    });
  };

  return (
    <section className={`do-finance-ledger ${compact ? "is-compact" : ""}`}>
      <div className="do-finance-summary">
        <div>
          <span>Actual cost</span>
          <strong>${summary.actualCost.toLocaleString()}</strong>
          <small>${summary.plannedCost.toLocaleString()} planned</small>
        </div>
        <div>
          <span>Revenue</span>
          <strong>${summary.actualRevenue.toLocaleString()}</strong>
          <small>${summary.plannedRevenue.toLocaleString()} planned</small>
        </div>
        <div>
          <span>Invoiced</span>
          <strong>${summary.invoiced.toLocaleString()}</strong>
          <small>Issued receivables</small>
        </div>
        <div>
          <span>Collected</span>
          <strong>${summary.collected.toLocaleString()}</strong>
          <small>${summary.outstanding.toLocaleString()} outstanding</small>
        </div>
        <div className={summary.margin < 0 ? "is-negative" : ""}>
          <span>Margin</span>
          <strong>${summary.margin.toLocaleString()}</strong>
          <small>Revenue − actual cost</small>
        </div>
      </div>

      <div className="do-finance-capacity">
        <div>
          <span>Capacity by assignee</span>
          {capacityAllocations.byAssignee.length ? (
            capacityAllocations.byAssignee.slice(0, 4).map((row) => (
              <strong key={row.name}>
                {row.name}: {row.actualHours}h / {row.plannedHours}h
              </strong>
            ))
          ) : (
            <strong>No assigned hours yet</strong>
          )}
        </div>
        <div>
          <span>Capacity by stage</span>
          {capacityAllocations.byStage.length ? (
            capacityAllocations.byStage.slice(0, 4).map((row) => (
              <strong key={row.name}>
                {row.name}: {row.actualHours}h / {row.plannedHours}h
              </strong>
            ))
          ) : (
            <strong>No staged hours yet</strong>
          )}
        </div>
      </div>

      <div className="do-finance-add-period">
        <label>
          <span>New period</span>
          <select
            onChange={(event) =>
              setNewKind(event.target.value as FinancePeriodKind)
            }
            value={newKind}
          >
            <option value="build">Build / change request</option>
            <option value="monthly">Monthly operations</option>
          </select>
        </label>
        {newKind === "build" && (
          <label>
            <span>Version or CR</span>
            <input
              onChange={(event) => setNewBuildLabel(event.target.value)}
              placeholder="V1, V2, CR1…"
              value={newBuildLabel}
            />
          </label>
        )}
        <div className="do-finance-month-picker">
          <label>
            <span>Period month</span>
            <select
              onChange={(event) => setNewMonth(Number(event.target.value))}
              value={newMonth}
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Period year</span>
            <select
              onChange={(event) => setNewYear(Number(event.target.value))}
              value={newYear}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
        {newKind === "build" && (
          <label>
            <span>Cost template</span>
            <select
              onChange={(event) => setTemplateId(event.target.value)}
              value={templateId}
            >
              <option value="none">Start empty</option>
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button onClick={addPeriod} type="button">
          <Plus size={13} /> Add period
        </button>
        {periods.length === 0 &&
          costRows(project).some(
            (row: any) => row.plannedQty || row.actualQty || row.rate,
          ) && (
            <button
              className="is-secondary"
              onClick={migrateLegacy}
              type="button"
            >
              Convert current baseline to Build V1
            </button>
          )}
      </div>

      <div className="do-finance-periods">
        {periods.map((period, periodIndex) => {
          const periodSummary = financeSummary([period]);
          const costEntries = period.entries.filter(
            (entry) => entry.direction === "cost",
          );
          const revenueEntries = period.entries.filter(
            (entry) => entry.direction === "revenue",
          );
          return (
            <details key={period.id} open={!compact && periodIndex === 0}>
              <summary>
                <span className={`do-finance-kind is-${period.kind}`}>
                  {period.kind === "build" ? "BUILD" : "MONTH"}
                </span>
                <span>
                  <strong>{period.label}</strong>
                  <small>
                    {monthOptions.find((month) => month.value === period.month)
                      ?.label || "No month"}{" "}
                    {period.year || ""} ·{" "}
                    {costEntries.length} cost line
                    {costEntries.length === 1 ? "" : "s"} ·{" "}
                    {revenueEntries.length} invoice line
                    {revenueEntries.length === 1 ? "" : "s"}
                    {" · "}
                    {period.collectionStatus === "paid"
                      ? "paid"
                      : String(period.billingStatus || "not_billed").replace(
                          /_/g,
                          " ",
                        )}
                  </small>
                </span>
                <span>
                  <strong>${periodSummary.plannedCost.toLocaleString()}</strong>
                  <small>Budget</small>
                </span>
                <span>
                  <strong>${periodSummary.actualCost.toLocaleString()}</strong>
                  <small>Actual cost</small>
                </span>
                <span>
                  <strong>${periodSummary.invoiced.toLocaleString()}</strong>
                  <small>
                    Billed · ${periodSummary.collected.toLocaleString()} paid
                  </small>
                </span>
              </summary>
              <div className="do-finance-period-body">
                <div className="do-finance-period-controls">
                  {period.kind === "build" && (
                    <label>
                      <span>Build / CR</span>
                      <input
                        defaultValue={period.label.replace(/^Build\s+/i, "")}
                        onBlur={(event) =>
                          updatePeriod(period.id, {
                            label: `Build ${event.target.value.trim() || "V1"}`,
                          })
                        }
                      />
                    </label>
                  )}
                  <div className="do-finance-month-picker">
                    <label>
                      <span>Period month</span>
                      <select
                        onChange={(event) => {
                          const month = Number(event.target.value);
                          updatePeriod(period.id, {
                            month,
                            ...(period.kind === "monthly"
                              ? {
                                  label: new Date(
                                    period.year || new Date().getFullYear(),
                                    month - 1,
                                    1,
                                  ).toLocaleDateString(undefined, {
                                    month: "long",
                                    year: "numeric",
                                  }),
                                }
                              : {}),
                          });
                        }}
                        value={period.month || new Date().getMonth() + 1}
                      >
                        {monthOptions.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Period year</span>
                      <select
                        onChange={(event) => {
                          const year = Number(event.target.value);
                          updatePeriod(period.id, {
                            year,
                            ...(period.kind === "monthly"
                              ? {
                                  label: new Date(
                                    year,
                                    (period.month || 1) - 1,
                                    1,
                                  ).toLocaleDateString(undefined, {
                                    month: "long",
                                    year: "numeric",
                                  }),
                                }
                              : {}),
                          });
                        }}
                        value={period.year || new Date().getFullYear()}
                      >
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    <span>Status</span>
                    <select
                      onChange={(event) =>
                        updatePeriod(period.id, { status: event.target.value })
                      }
                      value={period.status}
                    >
                      <option value="planned">Planned</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label>
                    <span>Currency</span>
                    <select
                      onChange={(event) =>
                        updatePeriod(period.id, {
                          currency: event.target.value,
                        })
                      }
                      value={period.currency}
                    >
                      <option value="USD">USD</option>
                      <option value="GTQ">GTQ</option>
                      <option value="PEN">PEN</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                  <label>
                    <span>Financial status</span>
                    <select
                      onChange={(event) => {
                        const financialStatus = event.target.value;
                        updatePeriod(period.id, {
                          billingStatus: financialStatus,
                          collectionStatus:
                            financialStatus === "paid" ? "paid" : "unpaid",
                        });
                      }}
                      value={
                        period.collectionStatus === "paid"
                          ? "paid"
                          : period.billingStatus === "disputed"
                            ? "disputed"
                            : ["billed", "partially_billed", "draft"].includes(
                                  String(period.billingStatus),
                                )
                              ? "billed"
                              : "not_billed"
                      }
                    >
                      <option value="not_billed">Not billed</option>
                      <option value="billed">Billed</option>
                      <option value="paid">Paid</option>
                      <option value="disputed">Disputed</option>
                    </select>
                  </label>
                  {period.kind === "build" && onCreateCostTemplate && (
                    <button
                      className="is-secondary"
                      onClick={() => savePeriodTemplate(period)}
                      type="button"
                    >
                      Save as template
                    </button>
                  )}
                  {period.kind === "build" &&
                    period.sourceTemplateId &&
                    onUpdateCostTemplate && (
                      <button
                        className="is-secondary"
                        onClick={() => updatePeriodTemplate(period)}
                        type="button"
                      >
                        Update template
                      </button>
                    )}
                  <button
                    className="is-danger"
                    onClick={() =>
                      window.confirm(
                        `Delete ${period.label} and all its financial movements?`,
                      ) &&
                      updatePeriods(
                        periods.filter(
                          (candidate) => candidate.id !== period.id,
                        ),
                      )
                    }
                    type="button"
                  >
                    Delete period
                  </button>
                </div>
                <section className="do-finance-subledger">
                  <header>
                    <div>
                      <strong>Costs</strong>
                      <small>
                        Budget versus actual by hours, minutes, transactions,
                        hits, MB, licenses or fixed fees.
                      </small>
                    </div>
                    <button
                      onClick={() => addEntry(period.id, "cost")}
                      type="button"
                    >
                      <Plus size={12} /> Add cost
                    </button>
                  </header>
                  <div className="do-finance-entry-table is-costs">
                    <div className="do-finance-cost-head">
                      <span>Cost item</span>
                      <span>Type</span>
                      <span>Stage</span>
                      <span>Service</span>
                      <span>Vendor</span>
                      <span>Assignee</span>
                      <span>Date</span>
                      <span>Period</span>
                      <span>Category</span>
                      <span>Driver</span>
                      <span>Budget qty</span>
                      <span>Actual qty</span>
                      <span>Budget rate</span>
                      <span>Actual rate</span>
                      <span>Budget</span>
                      <span>Actual</span>
                      <span>Status</span>
                      <span>Paid</span>
                      <span />
                    </div>
                    {costEntries.map((entry) => (
                      <div className="do-finance-cost-row" key={entry.id}>
                        <input
                          defaultValue={entry.description}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              description:
                                event.target.value.trim() || "Cost item",
                            })
                          }
                        />
                        <select
                          onChange={(event) =>
                            updateEntry(period.id, entry.id, {
                              costType: event.target.value,
                            })
                          }
                          value={entry.costType || "Direct Cost"}
                        >
                          {COST_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <select
                          onChange={(event) =>
                            updateEntry(period.id, entry.id, {
                              allocationStage: event.target.value,
                            })
                          }
                          value={entry.allocationStage || "Build"}
                        >
                          {ALLOCATION_STAGES.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </select>
                        <input
                          defaultValue={entry.serviceSolution || ""}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              serviceSolution: event.target.value.trim(),
                            })
                          }
                          placeholder="Service / solution"
                        />
                        <input
                          defaultValue={entry.vendor || ""}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              vendor: event.target.value.trim(),
                            })
                          }
                          placeholder="Vendor"
                        />
                        <input
                          defaultValue={entry.assignee || ""}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              assignee: event.target.value.trim(),
                            })
                          }
                          placeholder="Assignee"
                        />
                        <input
                          aria-label={`Date for ${entry.description}`}
                          onChange={(event) =>
                            updateEntry(period.id, entry.id, {
                              transactionDate: event.target.value,
                            })
                          }
                          type="date"
                          value={entry.transactionDate || ""}
                        />
                        <select
                          onChange={(event) =>
                            updateEntry(period.id, entry.id, {
                              accountingMonth: event.target.value,
                            })
                          }
                          value={entry.accountingMonth || ""}
                        >
                          {accountingMonthOptions.map((month) => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                        <select
                          onChange={(event) =>
                            updateEntry(period.id, entry.id, {
                              category: event.target.value,
                            })
                          }
                          value={entry.category}
                        >
                          <option value="development">Development</option>
                          <option value="implementation">Implementation</option>
                          <option value="support">Support</option>
                          <option value="vendor">Vendor</option>
                          <option value="license">License</option>
                          <option value="infrastructure">Infrastructure</option>
                          <option value="other">Other</option>
                        </select>
                        <select
                          onChange={(event) =>
                            updateEntry(period.id, entry.id, {
                              unit: event.target.value,
                            })
                          }
                          value={entry.unit}
                        >
                          {COST_UNITS.map((unit) => (
                            <option key={unit} value={unit}>
                              {costUnitLabels[unit]}
                            </option>
                          ))}
                        </select>
                        <input
                          defaultValue={entry.plannedQty}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              plannedQty: Number(event.target.value || 0),
                            })
                          }
                          type="number"
                        />
                        <input
                          defaultValue={entry.actualQty}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              actualQty: Number(event.target.value || 0),
                            })
                          }
                          type="number"
                        />
                        <input
                          defaultValue={entry.plannedRate ?? entry.rate}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              plannedRate: Number(event.target.value || 0),
                            })
                          }
                          type="number"
                        />
                        <input
                          defaultValue={entry.rate}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              rate: Number(event.target.value || 0),
                            })
                          }
                          type="number"
                        />
                        <strong>
                          ${financeAmount(entry, false).toLocaleString()}
                        </strong>
                        <strong>
                          ${financeAmount(entry).toLocaleString()}
                        </strong>
                        <select
                          onChange={(event) => {
                            const financialStatus = event.target.value;
                            updateEntry(period.id, entry.id, {
                              financialStatus,
                              costStatus:
                                financialStatus === "paid"
                                  ? "paid"
                                  : financialStatus === "billed"
                                    ? "incurred"
                                    : financialStatus === "disputed"
                                      ? "disputed"
                                      : "planned",
                            });
                          }}
                          value={entry.financialStatus || "not_billed"}
                        >
                          <option value="not_billed">Not billed</option>
                          <option value="billed">Billed</option>
                          <option value="paid">Paid</option>
                          <option value="disputed">Disputed</option>
                        </select>
                        <input
                          defaultValue={entry.settledAmount || 0}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              settledAmount: Number(event.target.value || 0),
                            })
                          }
                          type="number"
                        />
                        <button
                          aria-label={`Remove ${entry.description}`}
                          onClick={() =>
                            window.confirm(`Remove ${entry.description}?`) &&
                            removeEntry(period.id, entry.id)
                          }
                          type="button"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {costEntries.length === 0 && (
                      <div className="do-finance-empty">
                        No cost lines. Add budgeted or actual cost for this
                        period.
                      </div>
                    )}
                  </div>
                </section>
                <section className="do-finance-subledger">
                  <header>
                    <div>
                      <strong>Billing & collections</strong>
                      <small>
                        One Build may have several invoice installments in
                        different calendar months.
                      </small>
                    </div>
                    <button
                      onClick={() => addEntry(period.id, "revenue")}
                      type="button"
                    >
                      <Plus size={12} /> Add invoice
                    </button>
                  </header>
                  <div className="do-finance-entry-table is-billing">
                    <div className="do-finance-billing-head">
                      <span>Invoice item</span>
                      <span>Date</span>
                      <span>Period</span>
                      <span>Budget revenue</span>
                      <span>Invoice amount</span>
                      <span>Invoice #</span>
                      <span>Due</span>
                      <span>Status</span>
                      <span>Collected</span>
                      <span>Paid date</span>
                      <span />
                    </div>
                    {revenueEntries.map((entry) => (
                      <div className="do-finance-billing-row" key={entry.id}>
                        <input
                          defaultValue={entry.description}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              description:
                                event.target.value.trim() || "Invoice",
                            })
                          }
                        />
                        <input
                          aria-label={`Date for ${entry.description}`}
                          onChange={(event) =>
                            updateEntry(period.id, entry.id, {
                              transactionDate: event.target.value,
                              issueDate: event.target.value,
                            })
                          }
                          type="date"
                          value={entry.transactionDate || entry.issueDate || ""}
                        />
                        <select
                          onChange={(event) =>
                            updateEntry(period.id, entry.id, {
                              accountingMonth: event.target.value,
                            })
                          }
                          value={entry.accountingMonth || ""}
                        >
                          {accountingMonthOptions.map((month) => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label="Budget revenue"
                          defaultValue={financeAmount(entry, false)}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              plannedQty: 1,
                              plannedRate: Number(event.target.value || 0),
                            })
                          }
                          type="number"
                        />
                        <input
                          aria-label="Invoice amount"
                          defaultValue={financeAmount(entry)}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              actualQty: 1,
                              rate: Number(event.target.value || 0),
                            })
                          }
                          type="number"
                        />
                        <input
                          defaultValue={entry.referenceNumber}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              referenceNumber: event.target.value.trim(),
                            })
                          }
                          placeholder="INV-001"
                        />
                        <input
                          defaultValue={entry.dueDate}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              dueDate: event.target.value,
                            })
                          }
                          type="date"
                        />
                        <select
                          onChange={(event) => {
                            const financialStatus = event.target.value;
                            updateEntry(period.id, entry.id, {
                              financialStatus,
                              invoiceStatus:
                                financialStatus === "not_billed"
                                  ? "not_billed"
                                  : financialStatus === "disputed"
                                    ? "disputed"
                                    : "invoiced",
                              paymentStatus:
                                financialStatus === "paid"
                                  ? "paid"
                                  : "unpaid",
                            });
                          }}
                          value={entry.financialStatus || "not_billed"}
                        >
                          <option value="not_billed">Not billed</option>
                          <option value="billed">Billed</option>
                          <option value="paid">Paid</option>
                          <option value="disputed">Disputed</option>
                        </select>
                        <input
                          defaultValue={entry.settledAmount || 0}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              settledAmount: Number(event.target.value || 0),
                            })
                          }
                          type="number"
                        />
                        <input
                          defaultValue={entry.settledDate}
                          onBlur={(event) =>
                            updateEntry(period.id, entry.id, {
                              settledDate: event.target.value,
                            })
                          }
                          type="date"
                        />
                        <button
                          aria-label={`Remove ${entry.description}`}
                          onClick={() =>
                            window.confirm(`Remove ${entry.description}?`) &&
                            removeEntry(period.id, entry.id)
                          }
                          type="button"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {revenueEntries.length === 0 && (
                      <div className="do-finance-empty">
                        No invoices yet. Add the Build invoice or the ongoing
                        monthly fee.
                      </div>
                    )}
                  </div>
                </section>
                <div className="do-finance-entry-actions">
                  <span>
                    Budget, actual cost, invoicing and cash collection are
                    separate. This preserves a clear audit trail and prevents a
                    payment from being counted twice as revenue.
                  </span>
                </div>
              </div>
            </details>
          );
        })}
        {periods.length === 0 && (
          <EmptyState
            icon={<FileText size={18} />}
            title="No financial periods yet"
            text="Create Build V1, a change request, or the first operating month."
          />
        )}
      </div>
    </section>
  );
}

function projectProgress(project: any, projectTasks: any[]) {
  if (
    project?.progress !== null &&
    project?.progress !== undefined &&
    project?.progress !== "" &&
    Number.isFinite(Number(project.progress))
  )
    return Number(project.progress);
  const executable = projectTasks.filter(
    (task) => !["epic", "feature"].includes(workItemKind(task)),
  );
  const done = executable.filter(
    (task) => taskWorkLane(task) === "done",
  ).length;
  return executable.length ? Math.round((done / executable.length) * 100) : 0;
}

function projectSummary(project: any, projectTasks: any[]) {
  const financial = projectFinancialRollup(project);
  if (financial.periods.length) {
    return {
      plannedHours: financial.plannedHours,
      actualHours: financial.actualHours,
      plannedLabor: financial.plannedCost,
      actualLabor: financial.actualCost,
      initial: financial.buildCost,
      recurring: financial.latestMonthlyCost,
      openItems: Number.isFinite(Number(project.openItems))
        ? Number(project.openItems)
        : projectTasks.filter((task) => taskWorkLane(task) !== "done").length,
      progress: projectProgress(project, projectTasks),
    };
  }
  const rows = costRows(project);
  const plannedHours = rows.reduce(
    (sum: number, row: any) => sum + rowHours(row),
    0,
  );
  const actualHours = rows.reduce(
    (sum: number, row: any) => sum + rowHours(row, true),
    0,
  );
  const plannedLabor = rows.reduce(
    (sum: number, row: any) => sum + rowCost(row),
    0,
  );
  const actualLabor = rows.reduce(
    (sum: number, row: any) => sum + rowCost(row, true),
    0,
  );
  const rowInitial = rows
    .filter((row: any) => String(row.cadence || "initial") === "initial")
    .reduce((sum: number, row: any) => sum + rowCost(row), 0);
  const rowRecurring = rows
    .filter((row: any) =>
      ["recurring", "usage"].includes(String(row.cadence || "")),
    )
    .reduce((sum: number, row: any) => sum + rowCost(row), 0);
  const explicitInitial = moneyValue(
    project.initialCost || project.costInitial || project.setupCost,
  );
  const explicitRecurring = moneyValue(
    project.recurringMonthlyCost ||
      project.monthlyRecurringCost ||
      project.recurringCost,
  );
  return {
    plannedHours,
    actualHours,
    plannedLabor,
    actualLabor,
    initial: explicitInitial || rowInitial,
    recurring: explicitRecurring || rowRecurring,
    openItems: Number.isFinite(Number(project.openItems))
      ? Number(project.openItems)
      : projectTasks.filter((task) => taskWorkLane(task) !== "done").length,
    progress: projectProgress(project, projectTasks),
  };
}

function projectDueDate(project: any) {
  return (
    String(
      project?.revisedDueDate ||
        project?.dueDate ||
        project?.targetDate ||
        project?.originalDueDate ||
        "",
    ).slice(0, 10) || "No date"
  );
}

function projectSortValue(
  project: any,
  key: ProjectSortKey,
  tasks: any[],
  risks: any[],
) {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const summary = projectSummary(project, projectTasks);
  if (key === "delivery_entity")
    return String(project.deliveryEntity || project.bpo || "").toLowerCase();
  if (key === "client_entity")
    return String(project.clientEntity || project.client || "").toLowerCase();
  if (key === "work_category") return workCategory(project).toLowerCase();
  if (key === "product_phase") return productPhase(project).toLowerCase();
  if (key === "stage")
    return String(DELIVERY_STAGES.indexOf(deliveryStage(project))).padStart(
      2,
      "0",
    );
  if (key === "phase") return deliveryPhaseLabel(project).toLowerCase();
  if (key === "status")
    return String(project.sourceStatus || project.status || "").toLowerCase();
  if (key === "health")
    return String(
      { blocked: 0, at_risk: 1, on_track: 2 }[
        projectHealth(
          project,
          projectTasks,
          risks.filter((risk) => risk.projectId === project.id),
        )
      ] ?? 3,
    );
  if (key === "progress")
    return String(1000 - summary.progress).padStart(4, "0");
  if (key === "due")
    return projectDueDate(project) === "No date"
      ? "9999-12-31"
      : projectDueDate(project);
  if (key === "solution_architect")
    return String(project.solutionArchitect || "zzzz").toLowerCase();
  if (key === "project_manager")
    return String(
      project.projectManager || project.owner || "zzzz",
    ).toLowerCase();
  if (key === "next_step")
    return String(project.nextAction || "zzzz").toLowerCase();
  if (key === "hours")
    return String(1_000_000 - summary.plannedHours).padStart(8, "0");
  if (key === "economics")
    return String(
      1_000_000_000 - summary.initial - summary.recurring * 12,
    ).padStart(12, "0");
  return `${projectTitle(project)}|${project.projectKey || ""}`.toLowerCase();
}

function portfolioDimensionValue(
  project: any,
  dimension: PortfolioDimension,
  tasks: any[],
  risks: any[],
) {
  if (dimension === "bpo")
    return String(project.deliveryEntity || project.bpo || "Internal").trim() || "Internal";
  if (dimension === "client")
    return String(project.clientEntity || project.client || "Internal").trim() || "Internal";
  if (dimension === "work_category") return workCategory(project);
  if (dimension === "product_phase") return productPhase(project);
  if (dimension === "stage") return deliveryStageLabels[deliveryStage(project)];
  if (dimension === "status")
    return projectStatusLabel(String(project.status || "planning"));
  if (dimension === "health")
    return projectHealthLabel(
      projectHealth(
        project,
        tasks.filter((task) => task.projectId === project.id),
        risks.filter((risk) => risk.projectId === project.id),
      ),
    );
  if (dimension === "service")
    return (
      String(
        project.serviceLine ||
          project.technology ||
          project.projectType ||
          project.category ||
          "Unclassified",
      ).trim() || "Unclassified"
    );
  return (
    String(
      project.projectManager ||
        project.owner ||
        project.productOwner ||
        "Unassigned",
    ).trim() || "Unassigned"
  );
}

function escapeHtml(value: any) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] || character,
  );
}

export function ProjectCommandCenter({
  projects,
  tasks,
  risks,
  workspaceMembers = [],
  tags = [],
  costTemplates = [],
  projectTemplates = [],
  onClose,
  onAsk,
  onUpdateProject,
  onArchiveProject,
  onDeleteProject,
  onRestoreProject,
  onOpenProject,
  onCreateCostTemplate,
  onUpdateCostTemplate,
  onCreateProjectTemplate,
  onDeleteProjectTemplate,
  onApplyProjectTemplate,
  onCreateControlledOption,
}: {
  projects: any[];
  tasks: any[];
  risks: any[];
  workspaceMembers?: AssignmentMember[];
  tags?: TagLike[];
  costTemplates?: any[];
  projectTemplates?: any[];
  onClose: () => void;
  onAsk?: (prompt: string) => void;
  onCreateCostTemplate?: (template: any) => Promise<void> | void;
  onUpdateCostTemplate?: (
    templateId: string,
    patch: Record<string, unknown>,
  ) => Promise<void> | void;
  onCreateProjectTemplate?: (
    sourceProjectId: string,
    name: string,
    description: string,
  ) => Promise<void> | void;
  onDeleteProjectTemplate?: (templateId: string) => Promise<void> | void;
  onApplyProjectTemplate?: (
    template: any,
    application: TemplateApplication,
  ) => Promise<void> | void;
  onCreateControlledOption?: (
    group: "delivery_entity" | "client_entity" | "tag",
    name: string,
  ) => Promise<string | void> | string | void;
} & SharedProjectActions) {
  const [filter, setFilter] = useState("active");
  const [stageFilter, setStageFilter] = useState<"all" | DeliveryStage>("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("all");
  const [productPhaseFilter, setProductPhaseFilter] = useState("all");
  const [taxonomyDimension, setTaxonomyDimension] =
    useState<PortfolioDimension>("bpo");
  const [taxonomyValue, setTaxonomyValue] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<PortfolioView>("dashboard");
  const [primarySort, setPrimarySort] = useState<ProjectSortKey>("stage");
  const [secondarySort, setSecondarySort] = useState<ProjectSortKey>("due");
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [savedViews, setSavedViews] = useState<PortfolioSavedView[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(
        window.localStorage.getItem(columnsStorageKey("portfolio")) || "[]",
      );
    } catch {
      return [];
    }
  });
  const [visibleColumns, setVisibleColumns] = useState<PortfolioColumnKey[]>(
    () => {
      if (typeof window === "undefined") return defaultPortfolioColumns;
      try {
        const stored = JSON.parse(
          window.localStorage.getItem(columnsStorageKey("portfolio-current")) ||
            "null",
        );
        return selectedColumns(stored, defaultPortfolioColumns);
      } catch {
        return defaultPortfolioColumns;
      }
    },
  );
  const [columnWidths, setColumnWidths] = useState<
    Record<PortfolioColumnKey, number>
  >(() => {
    if (typeof window === "undefined") return defaultPortfolioColumnPixels;
    try {
      return {
        ...defaultPortfolioColumnPixels,
        ...JSON.parse(
          window.localStorage.getItem(
            columnWidthsStorageKey("portfolio-current"),
          ) || "{}",
        ),
      };
    } catch {
      return defaultPortfolioColumnPixels;
    }
  });
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const sorted = sortProjectsByRecency(projects);
  const portfolio = sorted;
  const realProjects = sorted;
  const activeMemberOptions = workspaceMembers
    .filter((member) => String(member.status || "active") !== "removed")
    .map((member) => ({ id: member.id, name: memberName(member) }));
  const discoveredDeliveryEntities = [
    ...realProjects.map((project) => project.deliveryEntity || project.bpo),
    ...tasks.map((task) => task.deliveryEntity || task.bpo),
  ].map((value) => String(value || "").trim());
  const discoveredClientEntities = [
    ...realProjects.map((project) => project.clientEntity || project.client),
    ...tasks.map((task) => task.clientEntity || task.client),
  ].map((value) => String(value || "").trim());
  const bpoOptions = controlledOptionNames(
    tags,
    "delivery_entity",
    discoveredDeliveryEntities,
  );
  const clientOptions = controlledOptionNames(
    tags,
    "client_entity",
    discoveredClientEntities,
  );
  const phaseOptions: DeliveryPhase[] = (
    stageFilter === "all"
      ? Object.values(DELIVERY_PHASES_BY_STAGE).flat()
      : phasesForStage(stageFilter)
  ) as DeliveryPhase[];
  const columnSet = new Set(visibleColumns);
  const currentPortfolioViewFilters: PortfolioViewFilters = {
    filter,
    stageFilter,
    phaseFilter,
    healthFilter,
    tagFilter,
    workCategoryFilter,
    productPhaseFilter,
    taxonomyDimension,
    taxonomyValue,
    search,
    view,
    primarySort,
    secondarySort,
  };
  const portfolioGridStyle = {
    gridTemplateColumns: visibleColumns
      .map((column) => `${columnWidths[column] || defaultPortfolioColumnPixels[column]}px`)
      .join(" "),
  };
  const updateColumnWidth = (
    column: PortfolioColumnKey,
    value: number,
  ) => {
    setColumnWidths((current) => {
      const next = { ...current, [column]: clampColumnWidth(value) };
      window.localStorage.setItem(
        columnWidthsStorageKey("portfolio-current"),
        JSON.stringify(next),
      );
      return next;
    });
  };
  const resetColumnWidths = () => {
    setColumnWidths(defaultPortfolioColumnPixels);
    window.localStorage.setItem(
      columnWidthsStorageKey("portfolio-current"),
      JSON.stringify(defaultPortfolioColumnPixels),
    );
  };
  const toggleColumn = (column: PortfolioColumnKey) => {
    setVisibleColumns((current) => {
      const next = current.includes(column)
        ? current.filter((candidate) => candidate !== column)
        : defaultPortfolioColumns.filter((candidate) =>
            [...current, column].includes(candidate),
          );
      window.localStorage.setItem(
        columnsStorageKey("portfolio-current"),
        JSON.stringify(next),
      );
      return next;
    });
  };
  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) return;
    const next = [
      ...savedViews.filter((candidate) => candidate.name !== name),
      {
        name,
        columns: visibleColumns,
        widths: columnWidths,
        filters: currentPortfolioViewFilters,
      },
    ];
    setSavedViews(next);
    window.localStorage.setItem(columnsStorageKey("portfolio"), JSON.stringify(next));
    setViewName("");
  };
  const applySavedView = (name: string) => {
    const saved = savedViews.find((candidate) => candidate.name === name);
    if (!saved) return;
    const nextColumns = selectedColumns(saved.columns, defaultPortfolioColumns);
    setVisibleColumns(nextColumns);
    if (saved.widths) {
      const nextWidths = { ...defaultPortfolioColumnPixels, ...saved.widths };
      setColumnWidths(nextWidths);
      window.localStorage.setItem(
        columnWidthsStorageKey("portfolio-current"),
        JSON.stringify(nextWidths),
      );
    }
    if (saved.filters) {
      setFilter(saved.filters.filter || "active");
      setStageFilter(saved.filters.stageFilter || "all");
      setPhaseFilter(saved.filters.phaseFilter || "all");
      setHealthFilter(saved.filters.healthFilter || "all");
      setTagFilter(saved.filters.tagFilter || "all");
      setWorkCategoryFilter(saved.filters.workCategoryFilter || "all");
      setProductPhaseFilter(saved.filters.productPhaseFilter || "all");
      setTaxonomyDimension(saved.filters.taxonomyDimension || "bpo");
      setTaxonomyValue(saved.filters.taxonomyValue || null);
      setSearch(saved.filters.search || "");
      setView(saved.filters.view || "overview");
      setPrimarySort(saved.filters.primarySort || "stage");
      setSecondarySort(saved.filters.secondarySort || "due");
    }
    window.localStorage.setItem(
      columnsStorageKey("portfolio-current"),
      JSON.stringify(nextColumns),
    );
  };
  const deleteSavedView = (name: string) => {
    const next = savedViews.filter((candidate) => candidate.name !== name);
    setSavedViews(next);
    window.localStorage.setItem(columnsStorageKey("portfolio"), JSON.stringify(next));
  };
  const filtered = portfolio.filter((project) => {
    const status = String(project.status || "planning").toLowerCase();
    const health = projectHealth(
      project,
      tasks.filter((task) => task.projectId === project.id),
      risks.filter((risk) => risk.projectId === project.id),
    );
    const matchesFilter =
      filter === "all" ||
      (filter === "active"
        ? !["completed", "archived", "done", "deleted", "cancelled"].includes(
            status,
          )
        : status === filter);
    const matchesStage =
      stageFilter === "all" || deliveryStage(project) === stageFilter;
    const matchesPhase =
      phaseFilter === "all" || deliveryPhase(project) === phaseFilter;
    const matchesHealth = healthFilter === "all" || health === healthFilter;
    const matchesProjectTag = matchesTag(project, tagFilter);
    const matchesWorkCategory =
      workCategoryFilter === "all" || workCategory(project) === workCategoryFilter;
    const matchesProductPhase =
      productPhaseFilter === "all" || productPhase(project) === productPhaseFilter;
    const matchesTaxonomy =
      !taxonomyValue ||
      portfolioDimensionValue(project, taxonomyDimension, tasks, risks) ===
        taxonomyValue;
    const haystack =
      `${projectTitle(project)} ${project.clientEntity || project.client || ""} ${project.deliveryEntity || project.bpo || ""} ${workCategory(project)} ${productPhase(project)} ${tagLabels(project, tags).join(" ")} ${project.serviceLine || ""} ${project.projectKey || ""}`.toLowerCase();
    return (
      matchesFilter &&
      matchesStage &&
      matchesHealth &&
      matchesProjectTag &&
      matchesWorkCategory &&
      matchesProductPhase &&
      matchesPhase &&
      matchesTaxonomy &&
      haystack.includes(search.toLowerCase())
    );
  });
  const sortedFiltered = [...filtered].sort((left, right) => {
    const primary = projectSortValue(
      left,
      primarySort,
      tasks,
      risks,
    ).localeCompare(projectSortValue(right, primarySort, tasks, risks));
    if (primary) return primary;
    if (primarySort !== secondarySort) {
      const secondary = projectSortValue(
        left,
        secondarySort,
        tasks,
        risks,
      ).localeCompare(projectSortValue(right, secondarySort, tasks, risks));
      if (secondary) return secondary;
    }
    return projectTitle(left).localeCompare(projectTitle(right));
  });
  const openProjects = portfolio.filter(
    (project) =>
      !["completed", "archived", "done", "deleted", "cancelled"].includes(
        String(project.status || "").toLowerCase(),
      ),
  );
  const allAttention = openProjects.filter((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectRisks = risks.filter((risk) => risk.projectId === project.id);
    return projectHealth(project, projectTasks, projectRisks) !== "on_track";
  });
  const attention = allAttention.slice(0, 3);
  const allRows = realProjects.map((project) =>
    projectSummary(
      project,
      tasks.filter((task) => task.projectId === project.id),
    ),
  );
  const totals = allRows.reduce(
    (acc, row) => ({
      plannedHours: acc.plannedHours + Number(row.plannedHours || 0),
      actualHours: acc.actualHours + Number(row.actualHours || 0),
      initial: acc.initial + row.initial,
      recurring: acc.recurring + row.recurring,
    }),
    { plannedHours: 0, actualHours: 0, initial: 0, recurring: 0 },
  );
  const stageCounts = DELIVERY_STAGES.map((stage) => ({
    stage,
    count: realProjects.filter((project) => deliveryStage(project) === stage)
      .length,
  }));
  const healthCounts = (["on_track", "at_risk", "blocked"] as const).map(
    (health) => ({
      health,
      count: realProjects.filter(
        (project) =>
          projectHealth(
            project,
            tasks.filter((task) => task.projectId === project.id),
            risks.filter((risk) => risk.projectId === project.id),
          ) === health,
      ).length,
    }),
  );
  const upcomingProjects = [...realProjects]
    .sort((left, right) => {
      const leftDate = projectDueDate(left);
      const rightDate = projectDueDate(right);
      if (leftDate === "No date") return 1;
      if (rightDate === "No date") return -1;
      return leftDate.localeCompare(rightDate);
    })
    .slice(0, 8);
  const taxonomyBreakdown = [
    ...new Set(
      realProjects.map((project) =>
        portfolioDimensionValue(project, taxonomyDimension, tasks, risks),
      ),
    ),
  ]
    .map((value) => ({
      value,
      count: realProjects.filter(
        (project) =>
          portfolioDimensionValue(project, taxonomyDimension, tasks, risks) ===
          value,
      ).length,
    }))
    .sort((left, right) => right.count - left.count);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const renderEconomics = (project: any, projectTasks: any[]) => {
    const summary = projectSummary(project, projectTasks);
    const periods = normalizedFinancePeriods(project);
    const ledgerSummary = financeSummary(periods);
    const buildCount = periods.filter(
      (period) => period.kind === "build",
    ).length;
    const monthCount = periods.filter(
      (period) => period.kind === "monthly",
    ).length;
    return (
      <div className="do-command-economics" key={`${project.id}-economics`}>
        <div className="do-command-economics-head">
          <div>
            <span className="do-project-card-kicker">
              PROJECT FINANCIAL LEDGER
            </span>
            <strong>{projectTitle(project)}</strong>
            <small>
              {project.client || "Internal"} · {buildCount} build/CR period
              {buildCount === 1 ? "" : "s"} · {monthCount} operating month
              {monthCount === 1 ? "" : "s"} · {summary.actualHours}h used of{" "}
              {summary.plannedHours}h planned
            </small>
          </div>
          <div className="do-command-economics-total">
            <span>Cost</span>
            <strong>${ledgerSummary.actualCost.toLocaleString()}</strong>
            <span>Revenue</span>
            <strong>${ledgerSummary.actualRevenue.toLocaleString()}</strong>
            <span>Outstanding</span>
            <strong>${ledgerSummary.outstanding.toLocaleString()}</strong>
          </div>
        </div>
        <div className="do-cost-grid">
          <label>
            Delivery stage
            <select
              onChange={(event) =>
                onUpdateProject(project.id, {
                  deliveryStage: event.target.value,
                })
              }
              value={deliveryStage(project)}
            >
              {DELIVERY_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {deliveryStageLabels[stage]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Next step
            <input
              defaultValue={project.nextAction || ""}
              onBlur={(event) =>
                onUpdateProject(project.id, {
                  nextAction: event.target.value.trim(),
                })
              }
              placeholder="Next concrete step"
            />
          </label>
        </div>
        <ProjectFinanceLedger
          compact
          project={project}
          templates={costTemplates}
          onCreateCostTemplate={onCreateCostTemplate}
          onUpdateCostTemplate={onUpdateCostTemplate}
          onUpdateProject={onUpdateProject}
        />
      </div>
    );
  };

  const exportPortfolioPdf = () => {
    const printable = window.open("", "_blank", "width=1200,height=800");
    if (!printable) return;
    const rows = sortedFiltered
      .map((project) => {
        const projectTasks = tasks.filter(
          (task) => task.projectId === project.id,
        );
        const health = projectHealth(
          project,
          projectTasks,
          risks.filter((risk) => risk.projectId === project.id),
        );
        const summary = projectSummary(project, projectTasks);
        return `<tr><td><strong>${escapeHtml(projectTitle(project))}</strong><small>${escapeHtml(project.projectKey || "")}</small></td><td>${escapeHtml(project.bpo || "Internal")}<small>${escapeHtml(project.client || "Internal")}</small></td><td>${escapeHtml(deliveryStageLabels[deliveryStage(project)])}</td><td>${escapeHtml(deliveryPhaseLabel(project))}<small>${escapeHtml(project.sourceStatus || project.status || "—")}</small></td><td><span class="health ${escapeHtml(health)}">${escapeHtml(projectHealthLabel(health))}</span></td><td>${summary.progress}%</td><td>${escapeHtml(projectDueDate(project))}</td><td>${escapeHtml(project.nextAction || "Define next step")}</td><td>${summary.actualHours}h / ${summary.plannedHours}h</td><td>$${summary.initial.toLocaleString()}<small>$${summary.recurring.toLocaleString()} / month</small></td></tr>`;
      })
      .join("");
    printable.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Certo Work · ${escapeHtml(filter === "all" ? "Portfolio" : projectStatusLabel(filter))}</title><style>@page{size:A3 landscape;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#25372d;font:12px Inter,Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #244f3a}h1{margin:4px 0;font-size:28px;letter-spacing:-1px}.kicker{color:#52735f;font-size:10px;font-weight:800;letter-spacing:1.4px}.meta{text-align:right;color:#718078}table{width:100%;border-collapse:collapse;table-layout:fixed}th{padding:9px 7px;border-bottom:1px solid #bbc9bf;color:#6d7b72;font-size:9px;text-align:left;text-transform:uppercase}td{padding:10px 7px;border-bottom:1px solid #e1e7e2;vertical-align:top;word-wrap:break-word}td:first-child{width:16%}td:nth-child(8){width:17%}strong,small{display:block}small{margin-top:3px;color:#859188;font-size:9px}.health{display:inline-block;border-radius:999px;background:#e6f0e9;padding:4px 7px;color:#356b4c;font-weight:700}.health.at_risk{background:#f5ecd9;color:#98651f}.health.blocked{background:#f4e1dd;color:#a24e40}footer{margin-top:15px;color:#829088;font-size:9px}</style></head><body><header><div><div class="kicker">CERTO WORK · PROJECT PORTFOLIO</div><h1>${escapeHtml(filter === "all" ? "All projects" : projectStatusLabel(filter))}</h1><div>${sortedFiltered.length} projects · sorted by ${escapeHtml(projectSortOptions.find((option) => option.value === primarySort)?.label)} then ${escapeHtml(projectSortOptions.find((option) => option.value === secondarySort)?.label)}</div></div><div class="meta">Generated ${escapeHtml(new Date().toLocaleString())}<br/>Current filtered view</div></header><table><thead><tr><th>Project</th><th>BPO / Client</th><th>Stage</th><th>Phase / Status</th><th>Health</th><th>Progress</th><th>Due</th><th>Next step</th><th>Hours</th><th>Economics</th></tr></thead><tbody>${rows}</tbody></table><footer>Health reflects the current Certo Work signals and any manual override. Use the browser print dialog to save this report as PDF.</footer><script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`,
    );
    printable.document.close();
  };

  return (
    <section
      aria-label="Project command center"
      className="do-command-center do-command-center-embedded"
      data-testid="project-command-center"
    >
      <datalist id="do-bpo-master">
        {bpoOptions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="do-client-master">
        {clientOptions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <header className="do-command-head is-compact">
        <div>
          <span className="do-project-card-kicker">DELIVERY CONTROL TOWER</span>
          <h1>Project command center</h1>
        </div>
        <div className="do-command-head-actions">
          <button
            className={templatesOpen ? "is-active" : ""}
            onClick={() => setTemplatesOpen((open) => !open)}
            type="button"
          >
            <Copy size={14} /> Templates
          </button>
          <button
            className={view === "dashboard" ? "is-active" : ""}
            onClick={() => setView("dashboard")}
            type="button"
          >
            <LayoutGrid size={14} /> Dashboard
          </button>
          <button
            aria-label="Close command center"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </div>
      </header>
      {templatesOpen && onCreateProjectTemplate && onDeleteProjectTemplate && onApplyProjectTemplate && (
        <ProjectTemplatesPanel
          onApply={onApplyProjectTemplate}
          onClose={() => setTemplatesOpen(false)}
          onCreate={onCreateProjectTemplate}
          onDelete={onDeleteProjectTemplate}
          projects={projects}
          templates={projectTemplates}
          workspaceMembers={workspaceMembers}
        />
      )}
      <div className="do-command-metrics">
        <div>
          <strong>
            {
              realProjects.filter(
                (project) =>
                  ![
                    "completed",
                    "archived",
                    "done",
                    "deleted",
                    "cancelled",
                  ].includes(String(project.status || "").toLowerCase()),
              ).length
            }{" "}
            / {realProjects.length}
          </strong>
          <span>Open / total projects</span>
        </div>
        <div>
          <strong>
            {
              realProjects.filter(
                (project) => deliveryStage(project) === "operations",
              ).length
            }
          </strong>
          <span>In operations</span>
        </div>
        <div className="is-risk">
          <strong>
            {
              realProjects.filter(
                (project) =>
                  projectHealth(
                    project,
                    tasks.filter((task) => task.projectId === project.id),
                    risks.filter((risk) => risk.projectId === project.id),
                  ) !== "on_track",
              ).length
            }
          </strong>
          <span>Need attention</span>
        </div>
        <div>
          <strong>
            {Math.round(totals.actualHours)}h /{" "}
            {Math.round(totals.plannedHours)}h
          </strong>
          <span>Hours used / planned</span>
        </div>
        <div>
          <strong>${Math.round(totals.recurring).toLocaleString()}</strong>
          <span>Monthly recurring</span>
        </div>
        <div>
          <strong>${Math.round(totals.initial).toLocaleString()}</strong>
          <span>Initial investment</span>
        </div>
      </div>
      <div className={`do-command-body do-command-body-${view}`}>
        {view === "dashboard" && (
          <section className="do-portfolio-dashboard">
            {onAsk && (
              <section className="do-pm-copilot">
                <div>
                  <span>
                    <Sparkles size={13} /> CERTO FOR PROJECT MANAGERS
                  </span>
                  <strong>Ask from the live portfolio</strong>
                  <small>
                    Answers use the same projects, risks, dates, assignments and
                    costs you see here.
                  </small>
                </div>
                <div>
                  {[
                    "What needs my attention today, and why?",
                    "Which projects are likely to miss their date?",
                    "Where are we over budget or over hours?",
                    "Prepare a concise stakeholder portfolio update.",
                  ].map((question) => (
                    <button
                      key={question}
                      onClick={() => onAsk(question)}
                      type="button"
                    >
                      {question}
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="do-portfolio-dashboard-grid">
              <section className="do-portfolio-card">
                <div className="do-portfolio-card-head">
                  <div>
                    <span className="do-project-card-kicker">
                      DELIVERY PIPELINE
                    </span>
                    <h3>Projects by stage</h3>
                  </div>
                  <span>{realProjects.length} total</span>
                </div>
                <div className="do-stage-bars">
                  {stageCounts.map(({ stage, count }) => (
                    <button
                      key={stage}
                      onClick={() => {
                        setFilter("all");
                        setStageFilter(stage);
                        setHealthFilter("all");
                        setTaxonomyValue(null);
                        setSearch("");
                        setView("overview");
                      }}
                      type="button"
                    >
                      <span>{deliveryStageLabels[stage]}</span>
                      <i>
                        <em
                          style={{
                            width: `${realProjects.length ? Math.max(4, (count / realProjects.length) * 100) : 0}%`,
                          }}
                        />
                      </i>
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>
              </section>
              <section className="do-portfolio-card">
                <div className="do-portfolio-card-head">
                  <div>
                    <span className="do-project-card-kicker">
                      PORTFOLIO HEALTH
                    </span>
                    <h3>Where attention is needed</h3>
                  </div>
                  <AlertTriangle size={15} />
                </div>
                <div className="do-health-summary">
                  {healthCounts.map(({ health, count }) => (
                    <button
                      key={health}
                      onClick={() => {
                        setFilter("all");
                        setStageFilter("all");
                        setHealthFilter(health);
                        setTaxonomyValue(null);
                        setSearch("");
                        setView("overview");
                      }}
                      type="button"
                    >
                      <span
                        className={`do-health-dot ${healthClass(health)}`}
                      />
                      <strong>{count}</strong>
                      <small>{projectHealthLabel(health)}</small>
                    </button>
                  ))}
                </div>
                <p className="do-portfolio-note">
                  Health is calculated from overdue dates, blocked work, open
                  risks and any explicit override.
                </p>
              </section>
              <section className="do-portfolio-card do-portfolio-card-wide">
                <div className="do-portfolio-card-head">
                  <div>
                    <span className="do-project-card-kicker">NEXT EXITS</span>
                    <h3>Upcoming project checkpoints</h3>
                  </div>
                  <button onClick={() => setView("overview")} type="button">
                    Open portfolio <ArrowRight size={13} />
                  </button>
                </div>
                <div className="do-upcoming-list">
                  {upcomingProjects.map((project) => {
                    const health = projectHealth(
                      project,
                      tasks.filter((task) => task.projectId === project.id),
                      risks.filter((risk) => risk.projectId === project.id),
                    );
                    return (
                      <button
                        key={project.id}
                        onClick={() => onOpenProject(project)}
                        type="button"
                      >
                        <span
                          className={`do-health-dot ${healthClass(health)}`}
                        />
                        <span>
                          <strong>{projectTitle(project)}</strong>
                          <small>
                            {project.client || "Internal"} ·{" "}
                            {deliveryPhaseLabel(project)}
                          </small>
                        </span>
                        <time>{projectDueDate(project)}</time>
                        <ArrowRight size={13} />
                      </button>
                    );
                  })}
                  {upcomingProjects.length === 0 && (
                    <EmptyState
                      icon={<CalendarDays size={18} />}
                      title="No dates yet"
                      text="Add a due date from the project console."
                    />
                  )}
                </div>
              </section>
              <section className="do-portfolio-card">
                <div className="do-portfolio-card-head">
                  <div>
                    <span className="do-project-card-kicker">
                      PORTFOLIO BREAKDOWN
                    </span>
                    <h3>Explore the portfolio</h3>
                  </div>
                  <label className="do-taxonomy-dimension">
                    <span>Group by</span>
                    <select
                      aria-label="Group portfolio projects"
                      onChange={(event) => {
                        setTaxonomyDimension(
                          event.target.value as PortfolioDimension,
                        );
                        setTaxonomyValue(null);
                      }}
                      value={taxonomyDimension}
                    >
                      {portfolioDimensionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="do-bpo-list">
                  {taxonomyBreakdown.slice(0, 10).map(({ value, count }) => (
                    <button
                      className={taxonomyValue === value ? "is-active" : ""}
                      key={value}
                      onClick={() => {
                        setFilter("all");
                        setStageFilter("all");
                        setHealthFilter("all");
                        setSearch("");
                        setTaxonomyValue(value);
                        setView("overview");
                      }}
                      type="button"
                    >
                      <span>{value}</span>
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}
        <details className="do-command-attention">
          <summary>
            <span>
              <AlertTriangle size={15} />
              <strong>
                {allAttention.length
                  ? `${allAttention.length} project${allAttention.length === 1 ? "" : "s"} need attention`
                  : "No project demands escalation"}
              </strong>
              <small>
                {allAttention.length
                  ? "Expand to review the strongest risk signals."
                  : "Portfolio signals are currently on track."}
              </small>
            </span>
            <span>{allAttention.length ? "Review" : "All clear"}</span>
          </summary>
          {attention.length ? (
            <div>
              {attention.map((project) => {
                const health = projectHealth(
                  project,
                  tasks.filter((task) => task.projectId === project.id),
                  risks.filter((risk) => risk.projectId === project.id),
                );
                return (
                  <button
                    key={project.id}
                    onClick={() => onOpenProject(project)}
                    type="button"
                  >
                    <span className={healthClass(health)}>
                      {projectHealthLabel(health)}
                    </span>
                    <strong>{projectTitle(project)}</strong>
                    <small>
                      {
                        tasks.filter(
                          (task) =>
                            task.projectId === project.id &&
                            taskWorkLane(task) === "blocked",
                        ).length
                      }{" "}
                      blocked ·{" "}
                      {
                        risks.filter((risk) => risk.projectId === project.id)
                          .length
                      }{" "}
                      risks
                    </small>
                    <ArrowRight size={13} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="do-command-calm">
              <CheckCircle2 size={17} />
              <span>
                <strong>No project demands escalation.</strong>
                <small>Review by exception; keep the team moving.</small>
              </span>
            </div>
          )}
        </details>
        <section className="do-command-portfolio">
          <div className="do-command-toolbar">
            <div className="do-command-toolbar-left">
              <div className="do-command-filters">
                {[
                  "active",
                  "planning",
                  "paused",
                  "completed",
                  "archived",
                  "deleted",
                  "all",
                ].map((value) => (
                  <button
                    className={filter === value ? "is-active" : ""}
                    key={value}
                    onClick={() => setFilter(value)}
                    type="button"
                  >
                    {value === "all"
                      ? "All"
                      : value === "active"
                        ? "Open"
                        : projectStatusLabel(value)}
                  </button>
                ))}
              </div>
              <div className="do-command-view-toggle">
                <button
                  className={view === "overview" ? "is-active" : ""}
                  onClick={() => setView("overview")}
                  type="button"
                >
                  Portfolio
                </button>
                <button
                  className={view === "economics" ? "is-active" : ""}
                  onClick={() => setView("economics")}
                  type="button"
                >
                  Financials
                </button>
              </div>
            </div>
            <label>
              <Search size={14} />
              <input
                aria-label="Search projects"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search project, client or service"
                value={search}
              />
            </label>
          </div>
          <div className="do-command-subtoolbar">
            <label>
              Stage
              <select
                aria-label="Filter by delivery stage"
                onChange={(event) =>
                  (() => {
                    const next = event.target.value as "all" | DeliveryStage;
                    setStageFilter(next);
                    if (
                      next !== "all" &&
                      phaseFilter !== "all" &&
                      !phasesForStage(next).includes(
                        phaseFilter as DeliveryPhase,
                      )
                    )
                      setPhaseFilter("all");
                  })()
                }
                value={stageFilter}
              >
                <option value="all">All stages</option>
                {DELIVERY_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {deliveryStageLabels[stage]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phase
              <select
                aria-label="Filter by project phase"
                onChange={(event) => setPhaseFilter(event.target.value)}
                value={phaseFilter}
              >
                <option value="all">All phases</option>
                {phaseOptions.map((phase) => (
                  <option key={phase} value={phase}>
                    {deliveryPhaseLabels[phase]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Health
              <select
                aria-label="Filter by project health"
                onChange={(event) => setHealthFilter(event.target.value)}
                value={healthFilter}
              >
                <option value="all">All health</option>
                <option value="on_track">On track</option>
                <option value="at_risk">At risk</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label>
              Tag
              <select
                aria-label="Filter projects by tag"
                onChange={(event) => setTagFilter(event.target.value)}
                value={tagFilter}
              >
                <option value="all">All tags</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name || tag.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                aria-label="Filter projects by work category"
                onChange={(event) => setWorkCategoryFilter(event.target.value)}
                value={workCategoryFilter}
              >
                <option value="all">All categories</option>
                {WORK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product Phase
              <select
                aria-label="Filter projects by product phase"
                onChange={(event) => setProductPhaseFilter(event.target.value)}
                value={productPhaseFilter}
              >
                <option value="all">All product phases</option>
                {PRODUCT_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                aria-label="Primary project sort"
                onChange={(event) =>
                  setPrimarySort(event.target.value as ProjectSortKey)
                }
                value={primarySort}
              >
                {projectSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Then
              <select
                aria-label="Secondary project sort"
                onChange={(event) =>
                  setSecondarySort(event.target.value as ProjectSortKey)
                }
                value={secondarySort}
              >
                {projectSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={exportPortfolioPdf} type="button">
              <FileText size={12} /> Export PDF
            </button>
            {view === "overview" && (
              <div className="do-table-scroll-buttons" aria-label="Move portfolio table horizontally">
                <button aria-label="Move table left" onClick={() => tableScrollRef.current?.scrollBy({ left: -520, behavior: "smooth" })} type="button"><ArrowLeft size={12} /></button>
                <button aria-label="Move table right" onClick={() => tableScrollRef.current?.scrollBy({ left: 520, behavior: "smooth" })} type="button"><ArrowRight size={12} /></button>
              </div>
            )}
            <span className="do-command-taxonomy-note">
              {taxonomyValue ? (
                <button
                  className="do-active-filter"
                  onClick={() => setTaxonomyValue(null)}
                  type="button"
                >
                  {
                    portfolioDimensionOptions.find(
                      (option) => option.value === taxonomyDimension,
                    )?.label
                  }
                  : {taxonomyValue} <X size={11} />
                </button>
              ) : (
                <>
                  Edit cells directly · Stage is the Certo lifecycle; Phase is
                  a controlled delivery checkpoint.{" "}
                  <InfoTip
                    label="Portfolio fields"
                    text="Stage is fixed to Define, Onboarding, Build, Deploy and Operations. Each Stage has four standard Phases. Health is automatic unless overridden. Progress is completed executable work unless manually set."
                  />
                </>
              )}
            </span>
          </div>
          {view === "overview" && (
            <details className="do-view-manager">
              <summary>
                <SlidersHorizontal size={13} /> Views & columns
              </summary>
              <div className="do-view-manager-body">
                <label>
                  Saved views
                  <select
                    aria-label="Apply saved portfolio view"
                    onChange={(event) => applySavedView(event.target.value)}
                    value=""
                  >
                    <option value="">Choose saved view</option>
                    {savedViews.map((saved) => (
                      <option key={saved.name} value={saved.name}>
                        {saved.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  New view name
                  <input
                    onChange={(event) => setViewName(event.target.value)}
                    placeholder="PM weekly view"
                    value={viewName}
                  />
                </label>
                <button onClick={saveCurrentView} type="button">
                  Save current view
                </button>
                <div className="do-column-picker">
                  {defaultPortfolioColumns
                    .filter((column) => column !== "project" && column !== "actions")
                    .map((column) => (
                      <label key={column}>
                        <input
                          checked={visibleColumns.includes(column)}
                          onChange={() => toggleColumn(column)}
                          type="checkbox"
                        />
                        {portfolioColumnLabels[column]}
                      </label>
                    ))}
                </div>
                <div className="do-column-widths">
                  <div>
                    <strong>Column widths</strong>
                    <button onClick={resetColumnWidths} type="button">
                      Reset
                    </button>
                  </div>
                  {visibleColumns
                    .filter((column) => column !== "actions")
                    .map((column) => (
                      <label key={`width-${column}`}>
                        <span>{portfolioColumnLabels[column]}</span>
                        <input
                          aria-label={`${portfolioColumnLabels[column]} width`}
                          max={420}
                          min={72}
                          onChange={(event) =>
                            updateColumnWidth(column, Number(event.target.value))
                          }
                          type="range"
                          value={
                            columnWidths[column] ||
                            defaultPortfolioColumnPixels[column]
                          }
                        />
                        <small>
                          {columnWidths[column] ||
                            defaultPortfolioColumnPixels[column]}
                          px
                        </small>
                      </label>
                    ))}
                </div>
                {savedViews.length > 0 && (
                  <div className="do-saved-view-list">
                    {savedViews.map((saved) => (
                      <button
                        key={saved.name}
                        onClick={() => deleteSavedView(saved.name)}
                        type="button"
                      >
                        Delete {saved.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}
          {view === "overview" ? (
            <div className="do-command-table-scroll" ref={tableScrollRef}>
            <div className="do-command-table">
              <div className="do-command-table-head" style={portfolioGridStyle}>
                {columnSet.has("project") && <span>
                  Project{" "}
                  <InfoTip
                    label="Project"
                    text="Edit the name directly. The stable project key remains underneath."
                  />
                </span>}
                {columnSet.has("delivery_entity") && <span>
                  Delivery Entity{" "}
                  <InfoTip
                    label="Delivery Entity"
                    text="Who delivers the work: BPO, internal team, vendor, or operating unit."
                  />
                </span>}
                {columnSet.has("client_entity") && <span>
                  Client Entity{" "}
                  <InfoTip
                    label="Client Entity"
                    text="Who receives or pays for the work. Choose from existing clients or type a new one."
                  />
                </span>}
                {columnSet.has("tags") && <span>Tags</span>}
                {columnSet.has("work_category") && <span>
                  Work Category{" "}
                  <InfoTip
                    label="Work Category"
                    text="Classifies the work without changing the delivery lifecycle. Use Product Development for products, platforms, apps or internal software you are building."
                  />
                </span>}
                {columnSet.has("product_phase") && <span>
                  Product Phase{" "}
                  <InfoTip
                    label="Product Phase"
                    text="Product-specific maturity: Explore, Shape, Build, Beta, Launch or Grow. It stays separate from delivery Stage and Phase."
                  />
                </span>}
                {columnSet.has("stage") && <span>
                  Stage{" "}
                  <InfoTip
                    label="Stage"
                    text="Fixed Certo lifecycle: Define, Onboarding, Build, Deploy or Operations."
                  />
                </span>}
                {columnSet.has("phase") && <span>
                  Phase{" "}
                  <InfoTip
                    label="Phase"
                    text="Standard checkpoint inside the selected Stage. The options change automatically when Stage changes."
                  />
                </span>}
                {columnSet.has("status") && <span>
                  Status{" "}
                  <InfoTip
                    label="Status"
                    text="Administrative record state: Planning, Active, Paused, Completed or Archived."
                  />
                </span>}
                {columnSet.has("health") && <span>
                  Health{" "}
                  <InfoTip
                    label="Health"
                    text="Auto checks blocked work, critical or open risks and overdue dates. Select a value to override it."
                  />
                </span>}
                {columnSet.has("progress") && <span>
                  Progress{" "}
                  <InfoTip
                    label="Progress"
                    text="Auto equals completed executable items divided by all executable items. Enter a percentage to override it."
                  />
                </span>}
                {columnSet.has("due") && <span>
                  Due{" "}
                  <InfoTip
                    label="Due date"
                    text="Editable delivery date. A revised date is used when one exists."
                  />
                </span>}
                {columnSet.has("solution_architect") && <span>
                  Solution Architect{" "}
                  <InfoTip
                    label="Solution Architect"
                    text="Accountable for solution design and technical coherence."
                  />
                </span>}
                {columnSet.has("project_manager") && <span>
                  Project Manager{" "}
                  <InfoTip
                    label="Project Manager"
                    text="Accountable for delivery planning, coordination, status and escalation."
                  />
                </span>}
                {columnSet.has("economics") && <span>
                  Economics{" "}
                  <InfoTip
                    label="Economics"
                    text="Build cost and the latest calendar-month operating cost."
                  />
                </span>}
                {columnSet.has("actions") && <span />}
              </div>
              {sortedFiltered.map((project) => {
                const projectTasks = tasks.filter(
                  (task) => task.projectId === project.id,
                );
                const projectRisks = risks.filter(
                  (risk) => risk.projectId === project.id,
                );
                const health = projectHealth(
                  project,
                  projectTasks,
                  projectRisks,
                );
                const summary = projectSummary(project, projectTasks);
                const favorite = isProjectFavorite(project);
                return (
                  <div
                    className={`do-command-project-block ${project.demo ? "is-demo" : ""}`}
                    key={project.id}
                  >
                    <article style={portfolioGridStyle}>
                      {columnSet.has("project") && <div className="do-command-project-name">
                        <button
                          aria-label={
                            favorite ? "Remove favorite" : "Favorite project"
                          }
                          className={favorite ? "is-favorite" : ""}
                          disabled={Boolean(project.demo)}
                          onClick={() =>
                            onUpdateProject(project.id, { favorite: !favorite })
                          }
                          type="button"
                        >
                          <Star
                            fill={favorite ? "currentColor" : "none"}
                            size={14}
                          />
                        </button>
                        <span>
                          <InlineEdit
                            ariaLabel={`Project name for ${projectTitle(project)}`}
                            onCommit={(title) =>
                              title &&
                              onUpdateProject(project.id, {
                                title,
                                name: title,
                              })
                            }
                            placeholder="Project name"
                            value={projectTitle(project)}
                          />
                          <small>
                            {project.demo ? "DEMO · " : ""}
                            {project.projectKey || "No key"} ·{" "}
                            {project.serviceLine ||
                              project.projectType ||
                              project.category ||
                              "Delivery"}
                          </small>
                        </span>
                      </div>}
                      {columnSet.has("delivery_entity") && <div className="do-master-data-cell">
                        <ControlledSelect
                          ariaLabel={`Delivery Entity for ${projectTitle(project)}`}
                          value={
                            project.deliveryEntity || project.bpo || "Internal"
                          }
                          options={bpoOptions}
                          onAddOption={(name) =>
                            onCreateControlledOption?.("delivery_entity", name)
                          }
                          onChange={(value) =>
                            onUpdateProject(project.id, {
                              deliveryEntity:
                                value.trim() || "Internal",
                              bpo: value.trim() || "Internal",
                            })
                          }
                        />
                      </div>}
                      {columnSet.has("client_entity") && <div className="do-master-data-cell">
                        <ControlledSelect
                          ariaLabel={`Client Entity for ${projectTitle(project)}`}
                          value={
                            project.clientEntity ||
                            project.client ||
                            "Internal"
                          }
                          options={clientOptions}
                          onAddOption={(name) =>
                            onCreateControlledOption?.("client_entity", name)
                          }
                          onChange={(value) =>
                            onUpdateProject(project.id, {
                              clientEntity:
                                value.trim() || "Internal",
                              client: value.trim() || "Internal",
                            })
                          }
                        />
                      </div>}
                      {columnSet.has("tags") && (
                        <TagPicker
                          label={`Tags for ${projectTitle(project)}`}
                          onCreateTag={(name) =>
                            onCreateControlledOption?.("tag", name)
                          }
                          onChange={(patch) => onUpdateProject(project.id, patch)}
                          record={project}
                          tags={tags}
                        />
                      )}
                      {columnSet.has("work_category") && (
                      <select
                        aria-label={`Work Category for ${projectTitle(project)}`}
                        className="do-table-select"
                        onChange={(event) =>
                          onUpdateProject(project.id, {
                            workCategory: event.target.value,
                            portfolioCategory: event.target.value,
                            projectType:
                              event.target.value === "Product Development"
                                ? "product"
                                : project.projectType,
                          })
                        }
                        value={workCategory(project)}
                      >
                        {WORK_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      )}
                      {columnSet.has("product_phase") && (
                      <select
                        aria-label={`Product Phase for ${projectTitle(project)}`}
                        className="do-table-select"
                        onChange={(event) =>
                          onUpdateProject(project.id, {
                            productPhase: event.target.value,
                            roadmapPhase: event.target.value,
                          })
                        }
                        value={productPhase(project)}
                      >
                        {PRODUCT_PHASES.map((phase) => (
                          <option key={phase} value={phase}>
                            {phase}
                          </option>
                        ))}
                      </select>
                      )}
                      {columnSet.has("stage") && (
                      <select
                        aria-label={`Stage for ${projectTitle(project)}`}
                        className="do-stage-select"
                        disabled={Boolean(project.demo)}
                        onChange={(event) =>
                          (() => {
                            const nextStage = event.target
                              .value as DeliveryStage;
                            const currentPhase = deliveryPhase(project);
                            const nextPhase = phasesForStage(nextStage).includes(
                              currentPhase,
                            )
                              ? currentPhase
                              : phasesForStage(nextStage)[0];
                            onUpdateProject(project.id, {
                              deliveryStage: nextStage,
                              phase: nextPhase,
                            });
                          })()
                        }
                        value={deliveryStage(project)}
                      >
                        {DELIVERY_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {deliveryStageLabels[stage]}
                          </option>
                        ))}
                      </select>
                      )}
                      {columnSet.has("phase") && (
                      <select
                        aria-label={`Phase for ${projectTitle(project)}`}
                        className="do-table-select"
                        onChange={(event) =>
                          onUpdateProject(project.id, {
                            phase: event.target.value,
                          })
                        }
                        value={deliveryPhase(project)}
                      >
                        {phasesForStage(deliveryStage(project)).map((phase) => (
                          <option key={phase} value={phase}>
                            {deliveryPhaseLabels[phase]}
                          </option>
                        ))}
                      </select>
                      )}
                      {columnSet.has("status") && (
                      <select
                        aria-label={`Status for ${projectTitle(project)}`}
                        className="do-table-select"
                        onChange={(event) =>
                          onUpdateProject(project.id, {
                            status: event.target.value,
                          })
                        }
                        value={String(
                          project.status || "planning",
                        ).toLowerCase()}
                      >
                        {!PROJECT_STATUSES.includes(
                          String(
                            project.status || "planning",
                          ).toLowerCase() as (typeof PROJECT_STATUSES)[number],
                        ) && (
                          <option
                            value={String(
                              project.status || "planning",
                            ).toLowerCase()}
                          >
                            {projectStatusLabel(project.status)}
                          </option>
                        )}
                        {PROJECT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {projectStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                      )}
                      {columnSet.has("health") && (
                      <select
                        aria-label={`Health for ${projectTitle(project)}`}
                        className={`do-health-select ${healthClass(health)}`}
                        onChange={(event) =>
                          onUpdateProject(project.id, {
                            healthOverride:
                              event.target.value === "auto"
                                ? null
                                : event.target.value,
                          })
                        }
                        value={project.healthOverride || "auto"}
                      >
                        <option value="auto">
                          Auto · {projectHealthLabel(health)}
                        </option>
                        <option value="on_track">On track</option>
                        <option value="at_risk">At risk</option>
                        <option value="blocked">Blocked</option>
                      </select>
                      )}
                      {columnSet.has("progress") && <div className="do-progress-edit">
                        <input
                          aria-label={`Progress for ${projectTitle(project)}`}
                          defaultValue={summary.progress}
                          key={`${project.id}-${project.progress == null ? "auto" : "manual"}`}
                          max={100}
                          min={0}
                          onBlur={(event) =>
                            onUpdateProject(project.id, {
                              progress: Math.max(
                                0,
                                Math.min(100, Number(event.target.value || 0)),
                              ),
                            })
                          }
                          type="number"
                        />
                        {project.progress == null ? (
                          <small>Auto</small>
                        ) : (
                          <button
                            onClick={() =>
                              onUpdateProject(project.id, { progress: null })
                            }
                            type="button"
                          >
                            Auto
                          </button>
                        )}
                      </div>}
                      {columnSet.has("due") && (
                      <input
                        aria-label={`Due date for ${projectTitle(project)}`}
                        className="do-table-input"
                        defaultValue={
                          projectDueDate(project) === "No date"
                            ? ""
                            : projectDueDate(project)
                        }
                        onBlur={(event) =>
                          onUpdateProject(project.id, {
                            revisedDueDate: event.target.value || null,
                          })
                        }
                        type="date"
                      />
                      )}
                      {columnSet.has("solution_architect") && (
                      <select
                        aria-label={`Solution Architect for ${projectTitle(project)}`}
                        className="do-table-select"
                        onChange={(event) =>
                          onUpdateProject(project.id, {
                            solutionArchitectId: event.target.value || null,
                            solutionArchitect:
                              activeMemberOptions.find(
                                (member) => member.id === event.target.value,
                              )?.name || "",
                          })
                        }
                        value={project.solutionArchitectId || ""}
                      >
                        <option value="">
                          {project.solutionArchitect || "Unassigned"}
                        </option>
                        {activeMemberOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      )}
                      {columnSet.has("project_manager") && (
                      <select
                        aria-label={`Project Manager for ${projectTitle(project)}`}
                        className="do-table-select"
                        onChange={(event) =>
                          onUpdateProject(project.id, {
                            projectManagerId: event.target.value || null,
                            projectManager:
                              activeMemberOptions.find(
                                (member) => member.id === event.target.value,
                              )?.name || "",
                          })
                        }
                        value={project.projectManagerId || ""}
                      >
                        <option value="">
                          {project.projectManager ||
                            project.owner ||
                            "Unassigned"}
                        </option>
                        {activeMemberOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      )}
                      {columnSet.has("economics") && (
                      <span>
                        ${summary.initial.toLocaleString()}
                        <small>
                          ${summary.recurring.toLocaleString()} / mo
                        </small>
                      </span>
                      )}
                      {columnSet.has("actions") && (
                      <div className="do-command-row-actions">
                        {project.demo ? (
                          <button
                            onClick={() =>
                              setExpandedId(
                                expandedId === project.id ? null : project.id,
                              )
                            }
                            type="button"
                          >
                            {expandedId === project.id ? "Hide" : "Preview"}
                          </button>
                        ) : ["deleted", "archived"].includes(
                            String(project.status || "").toLowerCase(),
                          ) ? (
                          <button
                            disabled={!onRestoreProject}
                            onClick={() => onRestoreProject?.(project)}
                            type="button"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenProject(project)}
                            type="button"
                          >
                            Open
                          </button>
                        )}
                        {!project.demo &&
                          !["deleted", "archived"].includes(
                            String(project.status || "").toLowerCase(),
                          ) &&
                          (archiveConfirmId === project.id ? (
                            <>
                              <button
                                onClick={() => setArchiveConfirmId(null)}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                className="is-danger"
                                onClick={() => onArchiveProject(project)}
                                type="button"
                              >
                                Confirm
                              </button>
                            </>
                          ) : (
                            <button
                              aria-label={`Archive ${projectTitle(project)}`}
                              onClick={() => setArchiveConfirmId(project.id)}
                              type="button"
                            >
                              <Archive size={13} />
                            </button>
                          ))}
                        {!project.demo &&
                          !["deleted", "archived"].includes(
                            String(project.status || "").toLowerCase(),
                          ) &&
                          onDeleteProject && (
                            <button
                              aria-label={`Delete ${projectTitle(project)}`}
                              onClick={() => onDeleteProject(project)}
                              type="button"
                            >
                              <X size={13} />
                          </button>
                        )}
                      </div>
                      )}
                    </article>
                    {expandedId === project.id &&
                      renderEconomics(project, projectTasks)}
                  </div>
                );
              })}
              {sortedFiltered.length === 0 && (
                <EmptyState
                  icon={<LayoutGrid size={20} />}
                  title="No projects in this view"
                  text="Change the filter or create a project through the conversation."
                />
              )}
            </div>
            </div>
          ) : (
            <div className="do-command-economics-list">
              {sortedFiltered.map((project) =>
                renderEconomics(
                  project,
                  tasks.filter((task) => task.projectId === project.id),
                ),
              )}
              {sortedFiltered.length === 0 && (
                <EmptyState
                  icon={<LayoutGrid size={20} />}
                  title="No projects in this view"
                  text="Change the filter or create a project through the conversation."
                />
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
