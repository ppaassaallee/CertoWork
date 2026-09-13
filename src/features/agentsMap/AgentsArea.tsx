import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgentsLibrary } from "../../components/agents/AgentsLibrary";
import { RoutinesHome } from "../../components/routines/RoutinesHome";
import { useRoutineHost } from "../../components/routines/RoutineHost";
import type { AgentActivityItem } from "../../lib/agentActivity";
import {
  allowRoutineWriteOthers,
  listRoutineRuns,
  type RoutineSpec,
} from "../../lib/routines";
import { AgentsMapView } from "./AgentsMapView";
import {
  isAgentsMapEnabled,
  readAgentsAreaTab,
  writeAgentsAreaTab,
  type AgentsAreaTab,
} from "./agentsMapFlag";
import type { RunLike } from "./mapHealth";
import "./agentsMap.css";

const TABS: Array<{ id: AgentsAreaTab; label: string }> = [
  { id: "map", label: "Mapa" },
  { id: "agents", label: "Agentes" },
  { id: "routines", label: "Rutinas" },
  { id: "runs", label: "Corridas" },
  { id: "analytics", label: "Analítica" },
];

export function AgentsArea({
  onOpenOdysseus,
  onOpenAutomations,
  onOpenActivity,
  onCreateAgent,
  onOpenApprovals,
  activityItems = [],
  pendingApprovals = 0,
  viewerUserId,
  routines = [],
  workspaceName,
  onRoutinesChanged,
  areaTitle = "Rutinas",
  initialTab,
  flagOffFallback = "routines",
}: {
  onOpenOdysseus: () => void;
  onOpenAutomations: () => void;
  onOpenActivity: () => void;
  onCreateAgent?: () => void;
  onOpenApprovals?: () => void;
  activityItems?: AgentActivityItem[];
  pendingApprovals?: number;
  viewerUserId?: string | null;
  routines?: RoutineSpec[];
  workspaceName?: string;
  onRoutinesChanged?: () => void;
  /** Shell title — “Rutinas” is the control tower; Agentes when opened from /agents. */
  areaTitle?: string;
  initialTab?: AgentsAreaTab;
  /** What to render when the map flag is off. */
  flagOffFallback?: "routines" | "agents";
}) {
  const enabled = isAgentsMapEnabled();
  const navigate = useNavigate();
  const { openRoutine } = useRoutineHost();
  const [tab, setTab] = useState<AgentsAreaTab>(() => {
    if (!enabled) return flagOffFallback === "agents" ? "agents" : "routines";
    if (initialTab) return initialTab;
    const saved = readAgentsAreaTab();
    return saved || "map";
  });
  const [runsByRoutineId, setRunsByRoutineId] = useState<Record<string, RunLike[]>>({});

  useEffect(() => {
    if (!enabled || (tab !== "map" && tab !== "runs" && tab !== "analytics")) return;
    let cancelled = false;
    const targets = routines.slice(0, 40);
    void Promise.all(
      targets.map(async (routine) => {
        try {
          const runs = await listRoutineRuns(routine.id, 24);
          return [routine.id, runs] as const;
        } catch {
          return [routine.id, []] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setRunsByRoutineId(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, routines, tab]);

  const flatRuns = useMemo(() => {
    const rows: Array<RunLike & { routineTitle: string; routineId: string }> = [];
    for (const routine of routines) {
      for (const run of runsByRoutineId[routine.id] || []) {
        rows.push({
          ...run,
          routineTitle: routine.title,
          routineId: routine.id,
          id: (run as { id?: string }).id,
        } as RunLike & { routineTitle: string; routineId: string; id?: string });
      }
    }
    return rows
      .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")))
      .slice(0, 40);
  }, [routines, runsByRoutineId]);

  if (!enabled) {
    if (flagOffFallback === "agents") {
      return (
        <AgentsLibrary
          activityItems={activityItems}
          pendingApprovals={pendingApprovals}
          routines={routines}
          viewerUserId={viewerUserId}
          onCreateAgent={onCreateAgent}
          onOpenActivity={onOpenActivity}
          onOpenApprovals={onOpenApprovals}
          onOpenAutomations={onOpenAutomations}
          onOpenOdysseus={onOpenOdysseus}
        />
      );
    }
    return <RoutinesHome />;
  }

  const selectTab = (next: AgentsAreaTab) => {
    setTab(next);
    writeAgentsAreaTab(next);
  };

  return (
    <div className="cw-agents-area" data-testid="agents-area">
      <div className="cw-agents-area-head">
        <strong>{areaTitle}</strong>
        <div className="cw-agents-area-tabs" role="tablist" aria-label={`${areaTitle} views`}>
          {TABS.map((item) => (
            <button
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => selectTab(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="cw-agents-area-live">
          <span className="cw-agents-map-chip is-success">● En vivo</span>
          <span className="cw-agents-map-chip">24 h</span>
        </div>
      </div>

      {tab === "map" ? (
        <AgentsMapView
          activityItems={activityItems}
          pendingApprovals={pendingApprovals}
          routines={routines}
          runsByRoutineId={runsByRoutineId}
          workspaceName={workspaceName}
          onAllowWriteOthers={async (routine) => {
            await allowRoutineWriteOthers(routine.id);
            onRoutinesChanged?.();
          }}
          onOpenApprovals={onOpenApprovals}
          onOpenRoutine={(routine) =>
            openRoutine({
              entityType: routine.scope?.entityType || "portfolio",
              entityId: routine.scope?.entityId,
              entityTitle: routine.scope?.entityTitle || routine.title,
            })
          }
        />
      ) : null}

      {tab === "agents" ? (
        <AgentsLibrary
          activityItems={activityItems}
          pendingApprovals={pendingApprovals}
          routines={routines}
          viewerUserId={viewerUserId}
          onCreateAgent={onCreateAgent}
          onOpenActivity={onOpenActivity}
          onOpenApprovals={onOpenApprovals}
          onOpenAutomations={() => selectTab("routines")}
          onOpenOdysseus={onOpenOdysseus}
        />
      ) : null}

      {tab === "routines" ? <RoutinesHome /> : null}

      {tab === "runs" ? (
        <section className="cw-agents-runs" data-testid="agents-runs">
          <table>
            <thead>
              <tr>
                <th>Rutina</th>
                <th>Inicio</th>
                <th>Estado</th>
                <th>Duración</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              {flatRuns.length === 0 ? (
                <tr>
                  <td colSpan={5}>Sin corridas todavía.</td>
                </tr>
              ) : (
                flatRuns.map((run) => (
                  <tr key={String((run as { id?: string }).id || `${run.routineId}-${run.startedAt}`)}>
                    <td>{run.routineTitle}</td>
                    <td>{String(run.startedAt || "").slice(0, 19).replace("T", " ")}</td>
                    <td>{String(run.status || "—")}</td>
                    <td>
                      {run.usage?.durationMs
                        ? `${Math.round(Number(run.usage.durationMs) / 1000)} s`
                        : "—"}
                    </td>
                    <td>${Number(run.usage?.costUsd || 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "analytics" ? (
        <section className="cw-agents-analytics" data-testid="agents-analytics">
          <div className="cw-agents-analytics-grid">
            <article>
              <span>Rutinas activas</span>
              <strong className="tabular-nums">
                {routines.filter((routine) => routine.status === "active").length}
              </strong>
            </article>
            <article>
              <span>Corridas (muestra)</span>
              <strong className="tabular-nums">{flatRuns.length}</strong>
            </article>
            <article>
              <span>Pendientes aprobación</span>
              <strong className="tabular-nums">{pendingApprovals}</strong>
            </article>
            <article>
              <span>Costo muestra</span>
              <strong className="tabular-nums">
                $
                {flatRuns
                  .reduce((sum, run) => sum + Number(run.usage?.costUsd || 0), 0)
                  .toFixed(2)}
              </strong>
            </article>
          </div>
          {pendingApprovals > 0 ? (
            <p className="cw-agents-map-empty">
              Hay aprobaciones pendientes.{" "}
              <button
                className="cw-overview-link"
                onClick={() => (onOpenApprovals ? onOpenApprovals() : navigate("/approvals"))}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--accent)",
                  cursor: "pointer",
                }}
                type="button"
              >
                Abrir Approvals
              </button>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
