import { useMemo, useState } from "react";
import { Calendar, ChevronRight, Users } from "../../../components/ui/Icon";
import { projectKpis } from "../chrome/ProjectPageChrome";
import { projectHealthLabel, taskWorkLane } from "../../../lib/projectPortfolio";

function itemTitle(item: any) {
  return String(item?.title || item?.name || "Untitled").trim();
}

function shortDue(value: unknown) {
  const raw = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function priorityTone(priority: unknown) {
  const value = String(priority || "").toUpperCase();
  if (["1", "P1", "HIGH"].includes(value)) return "high";
  if (["2", "P2", "MEDIUM"].includes(value)) return "medium";
  return "low";
}

function relativeTime(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type ProjectContextPanelProps = {
  project: any;
  tasks: any[];
  risks?: any[];
  health: string;
  members: Array<{ id: string; displayName?: string; email?: string }>;
  onOpenTeam: () => void;
  onSelectItem: (id: string) => void;
  onOpenOverview: () => void;
};

export function ProjectContextPanel({
  tasks,
  risks = [],
  health,
  members,
  onOpenTeam,
  onSelectItem,
  onOpenOverview,
}: ProjectContextPanelProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1440;
  });

  const kpis = projectKpis(tasks);
  const total = Math.max(1, kpis.open + kpis.inProgress + kpis.done);
  const progress = Math.round((kpis.done / total) * 100);

  const upcoming = useMemo(() => {
    return [...tasks]
      .filter((task) => taskWorkLane(task) !== "done" && (task.dueDate || task.targetDate))
      .sort((left, right) =>
        String(left.dueDate || left.targetDate).localeCompare(String(right.dueDate || right.targetDate)),
      )
      .slice(0, 3);
  }, [tasks]);

  const activity = useMemo(() => {
    return [...tasks]
      .filter((task) => task.updatedAt || task.createdAt)
      .sort((left, right) =>
        String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)),
      )
      .slice(0, 4);
  }, [tasks]);

  const visibleMembers = members.slice(0, 5);
  const extraMembers = Math.max(0, members.length - visibleMembers.length);

  if (collapsed) {
    return (
      <aside className="do-project-context is-collapsed" data-testid="project-context-panel">
        <button
          aria-label="Expand context panel"
          className="do-project-context-toggle"
          onClick={() => setCollapsed(false)}
          type="button"
        >
          <ChevronRight size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="do-project-context" data-testid="project-context-panel">
      <div className="do-project-context-head">
        <strong>Context</strong>
        <button
          aria-label="Collapse context panel"
          className="do-project-context-toggle"
          onClick={() => setCollapsed(true)}
          type="button"
        >
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      <section className="do-project-context-card">
        <header>
          <span>Project overview</span>
          <button className="is-link" onClick={onOpenOverview} type="button">
            View
          </button>
        </header>
        <div className="do-project-context-ring" aria-label={`${progress}% complete`}>
          <strong className="do-notion-num">{progress}%</strong>
          <span>{projectHealthLabel(health as "on_track" | "at_risk" | "blocked")}</span>
        </div>
        <ul className="do-project-context-legend">
          <li>
            <i className="is-done" /> Completed <em className="do-notion-num">{kpis.done}</em>
          </li>
          <li>
            <i className="is-doing" /> In progress <em className="do-notion-num">{kpis.inProgress}</em>
          </li>
          <li>
            <i className="is-open" /> To do <em className="do-notion-num">{kpis.open}</em>
          </li>
        </ul>
      </section>

      <section className="do-project-context-card">
        <header>
          <span>Team members</span>
          <button className="is-link" onClick={onOpenTeam} type="button">
            View all
          </button>
        </header>
        <div className="do-project-context-avatars">
          {visibleMembers.map((member) => {
            const name = String(member.displayName || member.email || "?").trim();
            return (
              <span className="do-notion-avatar" key={member.id} title={name}>
                {name.charAt(0).toUpperCase()}
              </span>
            );
          })}
          {extraMembers > 0 ? <span className="do-project-context-more">+{extraMembers}</span> : null}
          {visibleMembers.length === 0 ? (
            <span className="do-project-context-empty">
              <Users size={14} /> No members yet
            </span>
          ) : null}
        </div>
      </section>

      <section className="do-project-context-card">
        <header>
          <span>Upcoming deadlines</span>
        </header>
        <div className="do-project-context-list">
          {upcoming.map((task) => {
            const tone = priorityTone(task.priority || task.priorityLevel);
            return (
              <button
                className={`do-project-context-deadline is-${tone}`}
                key={task.id}
                onClick={() => onSelectItem(task.id)}
                type="button"
              >
                <strong>{itemTitle(task)}</strong>
                <span>
                  <Calendar size={12} /> {shortDue(task.dueDate || task.targetDate)}
                </span>
              </button>
            );
          })}
          {upcoming.length === 0 ? <p className="do-project-context-empty">No dated open work.</p> : null}
        </div>
      </section>

      <section className="do-project-context-card">
        <header>
          <span>Recent activity</span>
        </header>
        <div className="do-project-context-list">
          {activity.map((task) => {
            const actor = String(task.updatedByName || task.owner || task.assignee || "Someone").trim();
            return (
              <button
                className="do-project-context-activity"
                key={`act-${task.id}`}
                onClick={() => onSelectItem(task.id)}
                type="button"
              >
                <span className="do-notion-avatar" aria-hidden="true">
                  {actor.charAt(0).toUpperCase()}
                </span>
                <span>
                  <strong>
                    {actor} updated &lsquo;{itemTitle(task)}&rsquo;
                  </strong>
                  <small>{relativeTime(task.updatedAt || task.createdAt)}</small>
                </span>
              </button>
            );
          })}
          {activity.length === 0 ? (
            <p className="do-project-context-empty">
              {risks.length ? `${risks.length} risks on record.` : "No recent item activity."}
            </p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
