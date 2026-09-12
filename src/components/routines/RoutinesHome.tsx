import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Pause, Play, Sparkles } from "../ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import {
  activateRoutine,
  buildDryRunPreview,
  listRoutineRuns,
  listRoutinesForWorkspace,
  pauseRoutine,
  recordManualRoutineRun,
  relativeNextRunLabel,
  ROUTINE_RECIPES,
  routineStatusTone,
  type RoutineSpec,
} from "../../lib/routines";

function scopeLabel(routine: RoutineSpec) {
  const title = routine.scope?.entityTitle || routine.scope?.entityType || "—";
  if (routine.scope?.entityType === "portfolio") return "Portafolio";
  if (routine.scope?.entityType === "project" && routine.scope.entityId) {
    return title;
  }
  return title;
}

function whenLabel(routine: RoutineSpec) {
  const trigger = routine.trigger as any;
  return String(trigger?.human || trigger?.kind || "—");
}

export function RoutinesHome() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"list" | "recipes">("list");
  const [routines, setRoutines] = useState<RoutineSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selected = useMemo(
    () => routines.find((routine) => routine.id === selectedId) || null,
    [routines, selectedId],
  );

  const reload = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError("");
    try {
      const rows = await listRoutinesForWorkspace(workspace.id, user?.uid);
      setRoutines(rows);
      if (selectedId && !rows.some((row) => row.id === selectedId)) {
        setSelectedId(null);
        setRuns([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude cargar las rutinas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [workspace?.id, user?.uid]);

  useEffect(() => {
    if (!selectedId) {
      setRuns([]);
      return;
    }
    void listRoutineRuns(selectedId)
      .then(setRuns)
      .catch(() => setRuns([]));
  }, [selectedId]);

  const toggle = async (routine: RoutineSpec) => {
    setBusyId(routine.id);
    try {
      if (routine.status === "active") await pauseRoutine(routine.id);
      else await activateRoutine(routine);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude actualizar la rutina.");
    } finally {
      setBusyId(null);
    }
  };

  const runNow = async (routine: RoutineSpec) => {
    if (!user || !workspace) return;
    setBusyId(routine.id);
    try {
      const preview = buildDryRunPreview({
        goal: routine.goal,
        scopeTitle: scopeLabel(routine),
        entityType: routine.scope.entityType,
        language: routine.deliverable?.language || "es",
      });
      await recordManualRoutineRun({
        routine,
        workspaceId: workspace.id,
        userId: user.uid,
        outputText: preview.text,
        steps: preview.steps,
      });
      setSelectedId(routine.id);
      await reload();
      const nextRuns = await listRoutineRuns(routine.id);
      setRuns(nextRuns);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude correr la rutina.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="do-routines-home" data-testid="routines-home">
      <header className="do-routines-home-head">
        <div>
          <span className="do-routine-kicker">
            <Sparkles size={13} /> Rutinas
          </span>
          <h1>Rutinas</h1>
          <p>Frases que corren solas. Los pasos se ven en cada corrida.</p>
        </div>
        <div className="do-routines-tabs" role="tablist">
          <button
            className={tab === "list" ? "is-active" : ""}
            onClick={() => setTab("list")}
            role="tab"
            type="button"
          >
            Lista
          </button>
          <button
            className={tab === "recipes" ? "is-active" : ""}
            onClick={() => setTab("recipes")}
            role="tab"
            type="button"
          >
            Recetas
          </button>
        </div>
      </header>

      {error ? <p className="do-routine-error">{error}</p> : null}

      {tab === "recipes" ? (
        <div className="do-routines-recipes-grid" data-testid="routines-recipes">
          {ROUTINE_RECIPES.map((recipe) => (
            <article key={recipe.id}>
              <strong>{recipe.title}</strong>
              <p>{recipe.sentence}</p>
              <small>
                {recipe.triggerHint} · {recipe.deliverableHint}
              </small>
              <button
                onClick={() => {
                  if (recipe.entityTypes.includes("portfolio")) navigate("/projects");
                  else navigate("/projects");
                }}
                type="button"
              >
                Usar en…
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="do-routines-layout">
          <div className="do-routines-table-wrap">
            {loading ? (
              <p className="do-routine-muted">
                <Loader2 size={14} className="do-spin" /> Cargando…
              </p>
            ) : routines.length === 0 ? (
              <div className="do-routines-empty">
                <Sparkles size={22} />
                <strong>Todavía no hay rutinas</strong>
                <span>Abrí un proyecto y tocá ✦ Rutina, o partí de una receta.</span>
              </div>
            ) : (
              <table className="do-routines-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Dónde</th>
                    <th>Cuándo</th>
                    <th>Última</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {routines.map((routine) => {
                    const tone = routineStatusTone(routine.status);
                    return (
                      <tr
                        className={selectedId === routine.id ? "is-selected" : ""}
                        key={routine.id}
                        onClick={() => setSelectedId(routine.id)}
                      >
                        <td>
                          <button type="button">{routine.title}</button>
                        </td>
                        <td>{scopeLabel(routine)}</td>
                        <td>
                          {whenLabel(routine)}
                          {routine.status === "active" ? (
                            <small> · {relativeNextRunLabel(routine.nextRunAt)}</small>
                          ) : null}
                        </td>
                        <td>{relativeNextRunLabel(routine.lastRunAt) === "—" ? "—" : relativeNextRunLabel(routine.lastRunAt)?.replace(/^en /, "hace ").replace(/^vencida$/, "reciente") || "—"}</td>
                        <td>
                          <span className={`do-routine-status is-${tone}`}>{routine.status}</span>
                        </td>
                        <td>
                          <button
                            aria-label={routine.status === "active" ? "Pausar" : "Activar"}
                            disabled={busyId === routine.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggle(routine);
                            }}
                            type="button"
                          >
                            {routine.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selected ? (
            <aside className="do-routines-detail" data-testid="routine-detail">
              <header>
                <strong>{selected.title}</strong>
                <span className={`do-routine-status is-${routineStatusTone(selected.status)}`}>
                  {selected.status}
                </span>
              </header>
              <p>{selected.goal}</p>
              <div className="do-routine-card">
                <div className="do-routine-card-row">
                  <span>Cuándo</span>
                  <b>{whenLabel(selected)}</b>
                </div>
                <div className="do-routine-card-row">
                  <span>Entrega</span>
                  <b>{selected.deliverable?.channel}</b>
                </div>
                <div className="do-routine-card-row">
                  <span>Próxima</span>
                  <b>{relativeNextRunLabel(selected.nextRunAt)}</b>
                </div>
              </div>
              <div className="do-routine-actions">
                <button
                  className="do-project-quiet-btn"
                  disabled={busyId === selected.id}
                  onClick={() => void runNow(selected)}
                  type="button"
                >
                  Probar ahora
                </button>
                <button
                  className="do-project-primary-btn"
                  disabled={busyId === selected.id}
                  onClick={() => void toggle(selected)}
                  type="button"
                >
                  {selected.status === "active" ? "Pausar" : "Activar"}
                </button>
              </div>
              <section>
                <strong>Historial</strong>
                {runs.length === 0 ? (
                  <p className="do-routine-muted">Sin corridas todavía.</p>
                ) : (
                  <ul className="do-routines-run-list">
                    {runs.map((run) => (
                      <li key={run.id}>
                        <span>{String(run.startedAt || "").slice(0, 16).replace("T", " ")}</span>
                        <b>{run.status}</b>
                        <small>{String(run.output?.text || "").slice(0, 120)}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
