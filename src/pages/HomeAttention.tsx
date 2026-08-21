import { useState } from "react";
import { Activity, ChevronDown, ChevronRight } from "../components/ui/Icon";
import { StatusLight, taskDueStatus } from "../components/ui/StatusLight";
import { t } from "../lib/i18n";
import { projectHealthLabel } from "../lib/projectPortfolio";
import { entityTitle, groupProjectsByHealth, isClosed } from "../lib/workspaceDisplay";

export function HomeAttention({
  projects,
  tasks,
  risks,
  reviewItems,
  todayTasks,
  onOpenProject,
  onOpenApprovals,
  onAsk,
  activityItems,
}: {
  projects: any[];
  tasks: any[];
  risks: any[];
  reviewItems: any[];
  todayTasks: any[];
  onOpenProject: (project: any) => void;
  onOpenApprovals: () => void;
  onAsk: (prompt: string) => void;
  activityItems?: any[];
}) {
  const [showHealthy, setShowHealthy] = useState(false);
  const openProjects = projects.filter((project) => !isClosed(project.status));
  const grouped = groupProjectsByHealth(openProjects, tasks, risks);
  const overdue = todayTasks.filter(
    (task) => taskDueStatus({ status: task.status, dueDate: task.dueDate }) === "red",
  );
  const dueToday = todayTasks.filter(
    (task) => taskDueStatus({ status: task.status, dueDate: task.dueDate }) === "amber",
  );

  return (
    <div className="do-home-attention" data-testid="home-attention">
      {reviewItems.length > 0 && (
        <section className="do-attention-block is-amber">
          <button className="do-attention-head" onClick={onOpenApprovals} type="button">
            <StatusLight status="amber" label={`${reviewItems.length} pending approvals`} />
            <ChevronRight size="sm" />
          </button>
        </section>
      )}

      {grouped.blocked.length > 0 && (
        <section className="do-attention-block is-red">
          <div className="do-attention-head">
            <StatusLight status="red" label={`${grouped.blocked.length} blocked`} pulse />
          </div>
          {grouped.blocked.map((project) => (
            <button key={project.id} onClick={() => onOpenProject(project)} type="button">
              <StatusLight status="red" label={false} size="sm" />
              <span>{entityTitle(project)}</span>
              <ChevronRight size="sm" />
            </button>
          ))}
        </section>
      )}

      {grouped.at_risk.length > 0 && (
        <section className="do-attention-block is-amber">
          <div className="do-attention-head">
            <StatusLight status="amber" label={`${grouped.at_risk.length} at risk`} />
          </div>
          {grouped.at_risk.map((project) => (
            <button key={project.id} onClick={() => onOpenProject(project)} type="button">
              <StatusLight status="amber" label={false} size="sm" />
              <span>{entityTitle(project)}</span>
              <ChevronRight size="sm" />
            </button>
          ))}
        </section>
      )}

      {(overdue.length > 0 || dueToday.length > 0) && (
        <section className="do-attention-block">
          <div className="do-attention-head">
            <StatusLight
              status={overdue.length ? "red" : "amber"}
              label={`${overdue.length + dueToday.length} tasks due`}
            />
          </div>
          {[...overdue, ...dueToday].slice(0, 8).map((task) => (
            <button
              key={task.id}
              onClick={() => onAsk(`Help me move this task forward: ${entityTitle(task)}`)}
              type="button"
            >
              <StatusLight
                status={taskDueStatus({ status: task.status, dueDate: task.dueDate })}
                label={false}
                size="sm"
              />
              <span>{entityTitle(task)}</span>
            </button>
          ))}
        </section>
      )}

      {grouped.on_track.length > 0 && (
        <section className="do-attention-block is-quiet">
          <button
            className="do-attention-head"
            onClick={() => setShowHealthy((open) => !open)}
            type="button"
          >
            <StatusLight
              status="green"
              label={`${grouped.on_track.length} ${t("healthOnTrack").toLowerCase()}`}
            />
            <ChevronDown size="sm" />
          </button>
          {showHealthy &&
            grouped.on_track.slice(0, 8).map((project) => (
              <button key={project.id} onClick={() => onOpenProject(project)} type="button">
                <StatusLight status="green" label={projectHealthLabel("on_track")} size="sm" />
                <span>{entityTitle(project)}</span>
              </button>
            ))}
        </section>
      )}

      {activityItems && activityItems.length > 0 && (
        <section className="do-attention-block is-quiet do-odiseus-recently">
          <div className="do-attention-head">
            <Activity size={13} />
            <span>Odiseus recently</span>
          </div>
          {activityItems.slice(0, 5).map((item, index) => (
            <p key={item.id || index}>{item.summary}</p>
          ))}
        </section>
      )}
    </div>
  );
}
