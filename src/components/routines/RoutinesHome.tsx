import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Pause, Play, Sparkles } from "../ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import {
  activateGuidedRecipe,
  activateRoutine,
  buildFlowFromManifest,
  buildFlowFromPlan,
  getManifest,
  listRoutineRuns,
  listRoutinesForWorkspace,
  pauseRoutine,
  relativeNextRunLabel,
  recipesForDomain,
  resolveRoutineFlow,
  routineStatusTone,
  type RoutineSpec,
} from "../../lib/routines";
import { FlowMini, FlowView } from "../../features/routines/flow";
import { RoutineDetail } from "../../features/routines/RoutineDetail";

function scopeLabel(routine: RoutineSpec) {
  const title = routine.scope?.entityTitle || routine.scope?.entityType || "—";
  if (routine.scope?.entityType === "portfolio") return "Mi trabajo";
  if (routine.scope?.entityType === "project" && routine.scope.entityId) {
    return title;
  }
  return title;
}

function whenLabel(routine: RoutineSpec) {
  const trigger = routine.trigger as { human?: string; kind?: string };
  return String(trigger?.human || trigger?.kind || "—");
}

export function RoutinesHome({
  selectedRoutineId = null,
}: {
  selectedRoutineId?: string | null;
}) {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"list" | "recipes" | "runs">("list");
  const [recipeDomain, setRecipeDomain] = useState<"all" | "personal" | "project" | "portfolio">(
    "all",
  );
  const [routines, setRoutines] = useState<RoutineSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recipePreviewId, setRecipePreviewId] = useState<string | null>(null);
  const [allRuns, setAllRuns] = useState<Array<{ routine: RoutineSpec; run: any }>>([]);

  const selected = useMemo(
    () => routines.find((routine) => routine.id === selectedRoutineId) || null,
    [routines, selectedRoutineId],
  );
  const gallery = useMemo(() => recipesForDomain(recipeDomain), [recipeDomain]);
  const recipePreview = useMemo(() => {
    if (!recipePreviewId) return null;
    return gallery.find((recipe) => recipe.id === recipePreviewId) || null;
  }, [gallery, recipePreviewId]);

  const reload = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError("");
    try {
      const rows = await listRoutinesForWorkspace(workspace.id, user?.uid);
      setRoutines(rows);
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
    if (tab !== "runs" || routines.length === 0) return;
    let cancelled = false;
    void Promise.all(
      routines.slice(0, 20).map(async (routine) => {
        try {
          const runs = (await listRoutineRuns(routine.id, 8)) as any[];
          return runs.map((run) => ({ routine, run }));
        } catch {
          return [] as Array<{ routine: RoutineSpec; run: any }>;
        }
      }),
    ).then((chunks) => {
      if (cancelled) return;
      setAllRuns(
        chunks
          .flat()
          .sort((a, b) =>
            String(b.run?.startedAt || "").localeCompare(String(a.run?.startedAt || "")),
          )
          .slice(0, 40),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [tab, routines]);

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

  const activatePersonal = async (recipeId: string) => {
    if (!workspace?.id || !user?.uid) return;
    setBusyId(recipeId);
    try {
      const id = await activateGuidedRecipe({
        workspaceId: workspace.id,
        ownerUserId: user.uid,
        recipeId,
      });
      setTab("list");
      setRecipePreviewId(null);
      await reload();
      if (id) navigate(`/rutinas/${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude activar la rutina.");
    } finally {
      setBusyId(null);
    }
  };

  if (selected) {
    return (
      <RoutineDetail
        key={selected.id}
        onChanged={() => void reload()}
        routine={selected}
      />
    );
  }

  return (
    <div className="do-routines-home" data-testid="routines-home">
      <header className="do-routines-home-head">
        <div>
          <span className="do-routine-kicker">
            <Sparkles size={13} /> Rutinas
          </span>
          <h1>Rutinas</h1>
          <p>Cada rutina es una frase dibujada. Abrí el Flujo para ver cómo funciona.</p>
        </div>
        <div className="do-routines-tabs" role="tablist">
          <button
            className={tab === "list" ? "is-active" : ""}
            onClick={() => setTab("list")}
            role="tab"
            type="button"
          >
            Mis rutinas
          </button>
          <button
            className={tab === "recipes" ? "is-active" : ""}
            onClick={() => setTab("recipes")}
            role="tab"
            type="button"
          >
            Recetas
          </button>
          <button
            className={tab === "runs" ? "is-active" : ""}
            onClick={() => setTab("runs")}
            role="tab"
            type="button"
          >
            Corridas
          </button>
        </div>
      </header>

      {error ? <p className="do-routine-error">{error}</p> : null}

      {tab === "recipes" ? (
        <div>
          {recipePreview ? (
            <div data-testid="recipe-flow-detail">
              <button
                onClick={() => setRecipePreviewId(null)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
                type="button"
              >
                ← Recetas
              </button>
              <h2 style={{ fontSize: 16, fontWeight: 500 }}>{recipePreview.title}</h2>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {recipePreview.sentence}
              </p>
              <FlowView
                model={
                  getManifest(recipePreview.id)
                    ? buildFlowFromManifest(getManifest(recipePreview.id)!)
                    : buildFlowFromPlan({
                        title: recipePreview.title,
                        goal: recipePreview.sentence,
                        sentence: recipePreview.sentence,
                        trigger: {
                          kind: "manual",
                          human: recipePreview.triggerHint || "Manual",
                        },
                        deliverable: {
                          channel: "email",
                          to: [],
                          format: "short",
                          language: "es",
                        },
                        permissions: {
                          readCerto: "always",
                          writeOwner: "always",
                          editItems: "ask",
                          writeOthers: "ask",
                          approvedActionTypes: [],
                        },
                      })
                }
                readOnly
              />
              {recipePreview.class === "guided" ? (
                <button
                  className="do-project-primary-btn"
                  disabled={busyId === recipePreview.id}
                  onClick={() => void activatePersonal(recipePreview.id)}
                  style={{ marginTop: 12 }}
                  type="button"
                >
                  Usar en Mi trabajo
                </button>
              ) : (
                <button
                  className="do-project-primary-btn"
                  onClick={() => navigate("/projects")}
                  style={{ marginTop: 12 }}
                  type="button"
                >
                  Usar en…
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="do-routine-domain-filters" role="tablist" aria-label="Dominio">
                {(
                  [
                    ["all", "Todas"],
                    ["personal", "Personal"],
                    ["project", "Proyecto"],
                    ["portfolio", "Portafolio"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    className={recipeDomain === id ? "is-active" : ""}
                    key={id}
                    onClick={() => setRecipeDomain(id)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="do-routines-recipes-grid" data-testid="routines-recipes">
                {gallery.map((recipe) => {
                  const manifest = getManifest(recipe.id);
                  const mini = manifest
                    ? buildFlowFromManifest(manifest)
                    : buildFlowFromPlan({
                        title: recipe.title,
                        goal: recipe.sentence,
                        sentence: recipe.sentence,
                        trigger: { kind: "manual", human: recipe.triggerHint || "Manual" },
                        deliverable: {
                          channel: "email",
                          to: [],
                          format: "short",
                          language: "es",
                        },
                        permissions: {
                          readCerto: "always",
                          writeOwner: "always",
                          editItems: "ask",
                          writeOthers: "ask",
                          approvedActionTypes: [],
                        },
                      });
                  return (
                    <article key={recipe.id}>
                      <strong>{recipe.title}</strong>
                      <p>{recipe.sentence}</p>
                      <FlowMini model={mini} />
                      <small>
                        {recipe.triggerHint} · {recipe.deliverableHint}
                        {recipe.estimatedMinutes ? ` · ~${recipe.estimatedMinutes} min` : ""}
                      </small>
                      <button
                        onClick={() => setRecipePreviewId(recipe.id)}
                        type="button"
                      >
                        Ver flujo
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : tab === "runs" ? (
        <div data-testid="routines-runs-tab">
          {allRuns.length === 0 ? (
            <p className="do-routine-muted">Sin corridas todavía.</p>
          ) : (
            <ul className="do-routines-run-list">
              {allRuns.map(({ routine, run }) => (
                <li key={run.id}>
                  <button
                    onClick={() => navigate(`/rutinas/${routine.id}`)}
                    style={{
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                      font: "inherit",
                    }}
                    type="button"
                  >
                    <strong>{routine.title}</strong>
                    <span>
                      {String(run.startedAt || "").slice(0, 16).replace("T", " ")} · {run.status}
                    </span>
                    <small>{String(run.output?.text || "").slice(0, 120)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
                <span>Partí de una receta o abrí un proyecto y tocá ✦ Rutina.</span>
              </div>
            ) : (
              <table className="do-routines-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Clase</th>
                    <th>Dónde</th>
                    <th>Cuándo</th>
                    <th>Flujo</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {routines.map((routine) => {
                    const tone = routineStatusTone(routine.status);
                    const manifest = routine.recipeId
                      ? getManifest(routine.recipeId)
                      : null;
                    const mini = resolveRoutineFlow(routine, manifest);
                    return (
                      <tr key={routine.id}>
                        <td>
                          <button
                            onClick={() => navigate(`/rutinas/${routine.id}`)}
                            type="button"
                          >
                            {routine.title}
                          </button>
                        </td>
                        <td>{routine.class === "guided" ? "Guiada" : "Automática"}</td>
                        <td>{scopeLabel(routine)}</td>
                        <td>
                          {whenLabel(routine)}
                          {routine.status === "active" ? (
                            <small> · {relativeNextRunLabel(routine.nextRunAt)}</small>
                          ) : null}
                        </td>
                        <td>
                          <FlowMini model={mini} />
                        </td>
                        <td>
                          <span className={`do-routine-status is-${tone}`}>
                            {routine.status}
                          </span>
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
                            {routine.status === "active" ? (
                              <Pause size={14} />
                            ) : (
                              <Play size={14} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
