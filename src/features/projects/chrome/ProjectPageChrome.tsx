import type { ComponentType, ReactNode } from "react";
import {
  ArrowUpDown,
  Calendar,
  CalendarRange,
  FileText,
  Filter,
  Kanban,
  ListChecks,
  MoreHorizontal,
  Plus,
} from "../../../components/ui/Icon";
import type { WorkItemsViewMode } from "../../../lib/itemViewMemory";
import { taskWorkLane } from "../../../lib/projectPortfolio";

export type ProjectViewId = WorkItemsViewMode | "docs";

type IconType = ComponentType<{ size?: number }>;

const VIEW_TABS: Array<{ id: ProjectViewId; label: string; Icon: IconType }> = [
  { id: "list", label: "Table", Icon: ListChecks },
  { id: "kanban", label: "Board", Icon: Kanban },
  { id: "gantt", label: "Gantt", Icon: CalendarRange },
  { id: "calendar", label: "Calendar", Icon: Calendar },
  { id: "docs", label: "Docs", Icon: FileText },
];

function shortDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

type ProjectPageHeaderProps = {
  project: any;
  tasks: any[];
  healthLabel: string;
  healthTone: string;
  stageControl: ReactNode;
  statusControl: ReactNode;
  description?: string;
  moreOpen: boolean;
  onToggleMore: () => void;
  moreMenu: ReactNode;
  titleEditor: ReactNode;
};

export function ProjectPageHeader({
  project,
  tasks,
  healthLabel,
  healthTone,
  stageControl,
  statusControl,
  description,
  moreOpen,
  onToggleMore,
  moreMenu,
  titleEditor,
}: ProjectPageHeaderProps) {
  const kpis = projectKpis(tasks);
  const range = projectDateRangeLabel(project, tasks);
  const initial = String(project?.title || project?.name || "P")
    .trim()
    .charAt(0)
    .toUpperCase() || "P";

  return (
    <header className="do-project-page-header" data-testid="project-page-header">
      <div className="do-project-page-header-main">
        <div className="do-project-page-icon" aria-hidden="true">
          <span>{initial}</span>
        </div>
        <div className="do-project-page-identity">
          <span className="do-project-page-eyebrow">Project</span>
          <div className="do-project-page-title-row">{titleEditor}</div>
          {description ? (
            <p className="do-project-page-desc">{description}</p>
          ) : (
            <p className="do-project-page-desc is-empty">Add a one-line outcome for this project</p>
          )}
          <div className="do-project-page-meta">
            {stageControl}
            <span className="dot" aria-hidden="true">
              ·
            </span>
            {statusControl}
          </div>
        </div>
      </div>

      <div className="do-project-page-header-aside">
        <div className="do-project-kpi-row" aria-label="Project counters">
          <div className="do-project-kpi">
            <strong>{kpis.open}</strong>
            <span>Open</span>
          </div>
          <div className="do-project-kpi">
            <strong>{kpis.inProgress}</strong>
            <span>In progress</span>
          </div>
          <div className="do-project-kpi">
            <strong>{kpis.done}</strong>
            <span>Done</span>
          </div>
        </div>
        {range ? <span className="do-project-date-pill">{range}</span> : null}
        <span className={`do-project-health-chip is-${healthTone}`}>{healthLabel}</span>
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
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div className="do-project-page-tab-actions">
        <button
          aria-label="Filter"
          className={`do-project-quiet-btn${filterOpen ? " is-active" : ""}`}
          data-testid="notion-filter-button"
          onClick={onToggleFilter}
          type="button"
        >
          <Filter size={15} />
          Filter
        </button>
        <button
          aria-label="Sort"
          className={`do-project-quiet-btn${sortOpen ? " is-active" : ""}`}
          data-testid="notion-sort-button"
          onClick={onToggleSort}
          type="button"
        >
          <ArrowUpDown size={15} />
          Sort
        </button>
        <button className="do-project-primary-btn" onClick={onAddTask} type="button">
          <Plus size={15} />
          Add task
        </button>
      </div>
    </div>
  );
}
