import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowUpDown,
  Bookmark,
  Bug,
  Calendar,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FileText,
  Filter,
  GitBranch,
  Kanban,
  Layers,
  ListChecks,
  MoreHorizontal,
  Plus,
  Sparkles,
  Star,
  Zap,
} from "../../../components/ui/Icon";
import type { WorkItemsViewMode } from "../../../lib/itemViewMemory";
import {
  formatCheckpointLabel,
  taskWorkLane,
} from "../../../lib/projectPortfolio";
import { hierarchyKind, type HierarchyKind } from "../../../lib/itemHierarchy";
import { checklistItems, checklistProgress } from "../../../lib/kanbanFeatures";
import { notionEstimateHours } from "../../../lib/notionProjectTable";

export type ProjectViewId = WorkItemsViewMode | "docs";

type IconType = ComponentType<{ size?: number }>;

const VIEW_TABS: Array<{ id: ProjectViewId; label: string; Icon: IconType }> = [
  { id: "list", label: "Tabla", Icon: ListChecks },
  { id: "kanban", label: "Tablero", Icon: Kanban },
  { id: "gantt", label: "Gantt", Icon: CalendarRange },
  { id: "calendar", label: "Calendario", Icon: Calendar },
  { id: "docs", label: "Docs", Icon: FileText },
];

function shortDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Display name without trailing `(PROJECT-KEY)`. Key renders as its own badge. */
export function projectDisplayName(project: any) {
  const raw = String(project?.title || project?.name || "").trim();
  const key = String(project?.projectKey || project?.key || "").trim();
  if (!raw) return "Untitled project";
  if (key) {
    const stripped = raw
      .replace(new RegExp(`\\s*\\(${escapeRegExp(key)}\\)\\s*$`, "i"), "")
      .trim();
    if (stripped) return stripped;
  }
  return raw.replace(/\s*\([A-Z0-9][A-Z0-9_-]{6,}\)\s*$/, "").trim() || raw;
}

export function projectKeyBadge(project: any) {
  return String(project?.projectKey || project?.key || "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function projectKpis(tasks: any[]) {
  let open = 0;
  let inProgress = 0;
  let done = 0;
  for (const task of tasks) {
    const lane = taskWorkLane(task);
    if (lane === "done") done += 1;
    else if (lane === "in_progress" || lane === "blocked") inProgress += 1;
    else open += 1;
  }
  return { open, inProgress, done };
}

export function projectDateRangeLabel(project: any, tasks: any[]) {
  const candidates = [
    project?.startDate,
    project?.targetDate,
    project?.dueDate,
    project?.endDate,
    ...tasks.map((task) => task?.startDate || task?.dueDate || task?.targetDate),
  ]
    .map((value) => String(value || "").slice(0, 10))
    .filter(Boolean)
    .sort();
  if (!candidates.length) return "";
  const start = shortDate(candidates[0]);
  const end = shortDate(candidates[candidates.length - 1]);
  if (start === end) return start;
  return `${start} – ${end}`;
}

export function projectDueIso(project: any) {
  return (
    String(
      project?.revisedDueDate ||
        project?.dueDate ||
        project?.targetDate ||
        project?.originalDueDate ||
        project?.endDate ||
        "",
    ).slice(0, 10) || ""
  );
}

export function projectSummaryStats(project: any, tasks: any[]) {
  const items = Array.isArray(tasks) ? tasks : [];
  const blocked = items.filter((task) => taskWorkLane(task) === "blocked").length;
  const done = items.filter((task) => taskWorkLane(task) === "done").length;
  let progress = items.length ? Math.round((done / items.length) * 100) : 0;
  if (items.length) {
    const checklistPercents = items.map(
      (task) => checklistProgress(checklistItems(task)).percent,
    );
    if (checklistPercents.some((value) => value > 0)) {
      progress = Math.round(
        checklistPercents.reduce((sum, value) => sum + value, 0) / items.length,
      );
    }
  }
  const planned = items.reduce((sum, task) => sum + notionEstimateHours(task), 0);
  const used = items.reduce(
    (sum, task) => sum + (Number(task?.loggedHours || task?.actualHours || 0) || 0),
    0,
  );
  const dueIso = projectDueIso(project);
  const due = dueIso ? formatCheckpointLabel(dueIso) : null;
  const owner = String(
    project?.projectManager || project?.owner || project?.scrumMaster || "",
  ).trim();
  return {
    progress,
    dueIso,
    dueLabel: due?.text || "—",
    dueOverdue: Boolean(due?.overdue),
    owner: owner || "—",
    hoursLabel:
      planned > 0 || used > 0
        ? `${Math.round(used)} / ${planned > 0 ? Math.round(planned) : "—"} h`
        : "— / —",
    itemCount: items.length,
    blockedCount: blocked,
  };
}

export function workItemTypeIcon(kind: HierarchyKind | string) {
  const value = String(kind || "pbi").toLowerCase();
  if (value === "epic") return { Icon: Zap, color: "#7F77DD", label: "Epic" };
  if (value === "feature") return { Icon: Star, color: "#0F7B6C", label: "Feature" };
  if (value === "story") return { Icon: Bookmark, color: "#639922", label: "Story" };
  if (value === "pbi") return { Icon: Bookmark, color: "#639922", label: "PBI" };
  if (value === "task") return { Icon: CheckSquare, color: "#378ADD", label: "Task" };
  if (value === "bug") return { Icon: Bug, color: "#E24B4A", label: "Bug" };
  if (value === "subtask") return { Icon: CornerDownRight, color: "#888780", label: "Subtask" };
  if (value === "issue") return { Icon: GitBranch, color: "#888780", label: "Issue" };
  return { Icon: Layers, color: "#888780", label: "Item" };
}

type ProjectPageHeaderProps = {
  project: any;
  healthLabel: string;
  healthTone: string;
  description?: string;
  moreOpen: boolean;
  onToggleMore: () => void;
  moreMenu: ReactNode;
  titleEditor: ReactNode;
  onOpenRoutine?: () => void;
};

export function ProjectPageHeader({
  project,
  healthLabel,
  healthTone,
  description,
  moreOpen,
  onToggleMore,
  moreMenu,
  titleEditor,
  onOpenRoutine,
}: ProjectPageHeaderProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const initial = projectDisplayName(project).charAt(0).toUpperCase() || "P";
  const key = projectKeyBadge(project);
  const desc = String(description || "").trim();

  return (
    <header className="do-project-page-header" data-testid="project-page-header">
      <div className="do-project-page-header-main">
        <div className="do-project-page-icon" aria-hidden="true">
          <span>{initial}</span>
        </div>
        <div className="do-project-page-identity">
          <div className="do-project-page-title-row">
            {titleEditor}
            {key ? <code className="do-project-key-badge">{key}</code> : null}
          </div>
          {desc ? (
            <p className={`do-project-page-desc${descExpanded ? " is-expanded" : ""}`}>
              {desc}
              {!descExpanded && desc.length > 90 ? (
                <>
                  {" "}
                  <button
                    className="do-project-desc-more"
                    onClick={() => setDescExpanded(true)}
                    type="button"
                  >
                    más
                  </button>
                </>
              ) : null}
              {descExpanded ? (
                <>
                  {" "}
                  <button
                    className="do-project-desc-more"
                    onClick={() => setDescExpanded(false)}
                    type="button"
                  >
                    menos
                  </button>
                </>
              ) : null}
            </p>
          ) : (
            <p className="do-project-page-desc is-empty">Add a one-line outcome for this project</p>
          )}
        </div>
      </div>

      <div className="do-project-page-header-aside">
        <span className={`do-project-health-chip is-${healthTone}`}>{healthLabel}</span>
        {onOpenRoutine ? (
          <button
            aria-label="Rutina"
            className="do-project-routine-btn"
            data-testid="project-routine-button"
            onClick={onOpenRoutine}
            title="Rutina"
            type="button"
          >
            <Sparkles size={14} />
            <span>Rutina</span>
          </button>
        ) : null}
        <div className="do-console-more">
          <button
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-label="More"
            className="do-project-icon-btn"
            data-testid="notion-more-button"
            onClick={onToggleMore}
            title="More"
            type="button"
          >
            <MoreHorizontal size={16} />
          </button>
          {moreMenu}
        </div>
      </div>
    </header>
  );
}

type ProjectSummaryStripProps = {
  project: any;
  tasks: any[];
  stageControl: ReactNode;
};

export function ProjectSummaryStrip({
  project,
  tasks,
  stageControl,
}: ProjectSummaryStripProps) {
  const stats = useMemo(() => projectSummaryStats(project, tasks), [project, tasks]);

  return (
    <div className="do-project-summary-strip" data-testid="project-summary-strip">
      <div className="do-project-summary-stat">
        <span>Progreso</span>
        <b>
          {stats.progress}%
          <span className="do-project-mini-bar" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(100, stats.progress))}%` }} />
          </span>
        </b>
      </div>
      <div className="do-project-summary-stat">
        <span>Entrega</span>
        <b className={stats.dueOverdue ? "is-overdue" : ""}>{stats.dueLabel}</b>
      </div>
      <div className="do-project-summary-stat">
        <span>Etapa</span>
        <b className="do-project-summary-stage">
          {stageControl}
          <ChevronDown size={11} aria-hidden="true" />
        </b>
      </div>
      <div className="do-project-summary-stat">
        <span>Owner</span>
        <b>{stats.owner}</b>
      </div>
      <div className="do-project-summary-stat">
        <span>Horas</span>
        <b>{stats.hoursLabel}</b>
      </div>
      <div className="do-project-summary-stat">
        <span>Ítems</span>
        <b>
          {stats.itemCount}
          {stats.blockedCount > 0 ? (
            <span className="do-project-summary-muted">
              {" "}
              · {stats.blockedCount} bloqueado{stats.blockedCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </b>
      </div>
    </div>
  );
}

type ProjectViewTabsProps = {
  activeView: ProjectViewId;
  onChangeView: (view: ProjectViewId) => void;
  filterOpen: boolean;
  sortOpen: boolean;
  onToggleFilter: () => void;
  onToggleSort: () => void;
  onAddTask: () => void;
};

export function ProjectViewTabs({
  activeView,
  onChangeView,
  filterOpen,
  sortOpen,
  onToggleFilter,
  onToggleSort,
  onAddTask,
}: ProjectViewTabsProps) {
  return (
    <div className="do-project-page-tabs" data-testid="project-page-tabs" aria-label="Project views">
      <div className="do-project-page-tablist" role="tablist">
        {VIEW_TABS.map(({ id, label, Icon }) => (
          <button
            aria-selected={activeView === id}
            className={`do-project-page-tab${activeView === id ? " is-active" : ""}`}
            key={id}
            onClick={() => onChangeView(id)}
            role="tab"
            type="button"
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <div className="do-project-page-tab-actions">
        <span className="do-project-group-label">Agrupar: Épica</span>
        <button
          aria-label="Filter"
          className={`do-project-quiet-btn${filterOpen ? " is-active" : ""}`}
          data-testid="notion-filter-button"
          onClick={onToggleFilter}
          type="button"
        >
          <Filter size={15} />
        </button>
        <button
          aria-label="Sort"
          className={`do-project-quiet-btn${sortOpen ? " is-active" : ""}`}
          data-testid="notion-sort-button"
          onClick={onToggleSort}
          type="button"
        >
          <ArrowUpDown size={15} />
        </button>
        <button className="do-project-primary-btn" onClick={onAddTask} type="button">
          <Plus size={15} />
          Nueva
        </button>
      </div>
    </div>
  );
}

export function WorkItemTypeGlyph({
  item,
  size = 14,
}: {
  item: any;
  size?: number;
}) {
  const kind = hierarchyKind(item);
  const { Icon, color, label } = workItemTypeIcon(kind);
  return (
    <span
      aria-label={label}
      className="do-work-type-glyph"
      style={{ color }}
      title={label}
    >
      <Icon size={size} />
    </span>
  );
}

export function HierarchyChevron({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={expanded}
      aria-label={expanded ? "Collapse" : "Expand"}
      className="do-hierarchy-chevron"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      type="button"
    >
      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    </button>
  );
}
