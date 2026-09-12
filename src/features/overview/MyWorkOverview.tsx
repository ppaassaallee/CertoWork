import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronRight } from "../../components/ui/Icon";
import { KpiTile } from "./components/KpiTile";
import { StageRoadmap } from "./components/StageRoadmap";
import { ProgressDonut } from "./components/ProgressDonut";
import { buildMyWorkOverview, type OverviewRoadmapRow } from "./useOverviewData";
import {
  readMyWorkOverviewCollapsed,
  writeMyWorkOverviewCollapsed,
} from "./overviewFlag";
import type { MyWorkActor } from "../../lib/myWorkItems";
import {
  memberAvatar,
  memberPublicLabel,
  type WorkspaceMember,
} from "../../lib/workspaceCollaboration";
import {
  listRoutinesForWorkspace,
  relativeNextRunLabel,
  type RoutineSpec,
} from "../../lib/routines";
import { useAuth } from "../../lib/AuthContext";
import "./overview.css";

export function MyWorkOverview({
  userId,
  tasks,
  projects,
  actor,
  members = [],
}: {
  userId: string;
  tasks: any[];
  projects: any[];
  actor: MyWorkActor;
  members?: WorkspaceMember[];
}) {
  const { workspace, user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(readMyWorkOverviewCollapsed);
  const [routines, setRoutines] = useState<RoutineSpec[]>([]);

  useEffect(() => {
    if (!workspace?.id || !userId) return;
    let active = true;
    void listRoutinesForWorkspace(workspace.id, userId)
      .then((rows) => {
        if (active) setRoutines(rows.filter((r) => r.status === "active" || r.status === "paused"));
      })
      .catch(() => {
        if (active) setRoutines([]);
      });
    return () => {
      active = false;
    };
  }, [workspace?.id, userId]);

  const model = useMemo(
    () => buildMyWorkOverview({ tasks, projects, actor, members }),
    [tasks, projects, actor, members],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const me = members.find(
    (m) => m.userId === userId || m.id === actor.memberId,
  );
  const avatar = me ? memberAvatar(me) : "🙂";
  const name = me ? memberPublicLabel(me) : user?.displayName || "Yo";

  const roadmapRows: OverviewRoadmapRow[] = model.projectRows.map((row) => ({
    stage: row.stage,
    label: row.label,
    startIso: null,
    endIso: null,
    progressPct: null,
    bars: row.bars,
  }));

  const nextRoutine = [...routines]
    .filter((r) => r.nextRunAt)
    .sort((a, b) => String(a.nextRunAt).localeCompare(String(b.nextRunAt)))[0];

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
    <div className="cw-overview cw-overview-my-work" data-testid="my-work-overview">
      <button
        aria-expanded={!collapsed}
        className="cw-overview-collapse"
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          writeMyWorkOverviewCollapsed(next);
        }}
        type="button"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <span>Resumen</span>
      </button>

      {!collapsed ? (
        <>
          {card(
            0,
            <header className="cw-overview-header">
              <div className="cw-overview-header-main">
                <div>
                  <h2>Mi trabajo</h2>
                  <p className="cw-overview-today-label">{todayLabel}</p>
                </div>
              </div>
              <div className="cw-overview-header-aside">
                <span className="cw-overview-avatar" title={name}>
                  {avatar}
                </span>
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
                  empty={roadmapRows.every((row) => row.bars.length === 0)}
                  leftLabel="Proyecto"
                  rangeEndIso={model.rangeEndIso}
                  rangeStartIso={model.rangeStartIso}
                  rows={roadmapRows}
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
              {model.upcoming.length
                ? card(
                    4,
                    <section className="cw-overview-card" data-testid="overview-upcoming-dues">
                      <header className="cw-overview-card-head">
                        <h3>Próximos vencimientos</h3>
                      </header>
                      <ul className="cw-overview-dues">
                        {model.upcoming.map((item) => (
                          <li key={item.id}>
                            <strong>{item.title}</strong>
                            <small>
                              {item.dueIso}
                              {item.projectName ? ` · ${item.projectName}` : ""}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </section>,
                  )
                : null}
              {routines.length
                ? card(
                    5,
                    <section className="cw-overview-card" data-testid="overview-routines-card">
                      <header className="cw-overview-card-head">
                        <h3>Rutinas mías</h3>
                      </header>
                      <p className="cw-overview-routines-summary">
                        <strong className="tabular-nums">{routines.length}</strong>
                        <span>
                          {nextRoutine?.nextRunAt
                            ? `Próxima: ${relativeNextRunLabel(nextRoutine.nextRunAt)}`
                            : "Sin próxima ejecución"}
                        </span>
                      </p>
                    </section>,
                  )
                : null}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
