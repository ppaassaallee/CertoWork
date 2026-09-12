import { useMemo, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Calendar, MoreHorizontal } from "../../components/ui/Icon";
import { KpiTile } from "./components/KpiTile";
import { StageRoadmap } from "./components/StageRoadmap";
import { ProgressDonut } from "./components/ProgressDonut";
import { TeamCard } from "./components/TeamCard";
import { MilestonesCard } from "./components/MilestonesCard";
import { buildProjectOverview } from "./useOverviewData";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";
import "./overview.css";

export function ProjectOverview({
  project,
  tasks,
  milestones = [],
  members = [],
  onOpenGantt,
  onOpenList,
}: {
  project: any;
  tasks: any[];
  milestones?: any[];
  members?: WorkspaceMember[];
  onOpenGantt?: () => void;
  onOpenList?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const model = useMemo(
    () => buildProjectOverview({ project, tasks, milestones, members }),
    [project, tasks, milestones, members],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const stagger = reduceMotion ? 0 : 0.06;

  const card = (index: number, child: ReactNode) => (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      key={index}
      transition={{ delay: index * stagger, duration: 0.25 }}
    >
      {child}
    </motion.div>
  );

  return (
    <div className="cw-overview" data-testid="project-overview">
      {card(
        0,
        <header className="cw-overview-header">
          <div className="cw-overview-header-main">
            <span className="cw-overview-project-icon" aria-hidden="true">
              {model.initial}
            </span>
            <div>
              <h2>{model.title}</h2>
              {model.description ? <p>{model.description}</p> : null}
            </div>
          </div>
          <div className="cw-overview-header-aside">
            {model.dateRangeLabel ? (
              <span className="cw-overview-date-pill">
                <Calendar size={13} />
                {model.dateRangeLabel}
              </span>
            ) : null}
            {model.team.length ? (
              <div className="cw-overview-avatar-stack">
                {model.team.slice(0, 3).map((member) => (
                  <span className="cw-overview-avatar" key={member.id}>
                    {member.avatar}
                  </span>
                ))}
                {model.team.length > 3 ? (
                  <span className="cw-overview-avatar is-more">
                    +{model.team.length - 3}
                  </span>
                ) : null}
              </div>
            ) : null}
            <button aria-label="Más" className="cw-overview-more" type="button">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </header>,
      )}

      {card(
        1,
        <div className="cw-overview-kpis">
          {model.kpis.map((kpi) => (
            <KpiTile key={kpi.id} kpi={kpi} />
          ))}
        </div>,
      )}

      <div className="cw-overview-grid">
        <div className="cw-overview-main">
          {card(
            2,
            <StageRoadmap
              empty={model.emptyDated || tasks.length === 0}
              onOpenGantt={onOpenGantt}
              onOpenList={onOpenList}
              rangeEndIso={model.rangeEndIso}
              rangeStartIso={model.rangeStartIso}
              rows={model.roadmap}
              todayIso={todayIso}
            />,
          )}
        </div>
        <aside className="cw-overview-side">
          {card(
            3,
            <section className="cw-overview-card">
              <header className="cw-overview-card-head">
                <h3>Progreso</h3>
              </header>
              <ProgressDonut animate={!reduceMotion} progress={model.progress} />
            </section>,
          )}
          {model.team.length
            ? card(4, <TeamCard members={model.team} />)
            : null}
          {model.milestones.length
            ? card(5, <MilestonesCard milestones={model.milestones} />)
            : null}
        </aside>
      </div>
    </div>
  );
}
