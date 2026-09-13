import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "../ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import {
  buildDryRunPreview,
  compileRoutineSentence,
  COMPOSER_PLACEHOLDERS,
  recipesForEntity,
  saveRoutineDraft,
  type RoutineCompileResult,
  type RoutineEntityType,
  type RoutinePermissionMode,
  type RoutineSpec,
} from "../../lib/routines";

type ScopeInput = {
  entityType: RoutineEntityType;
  entityId: string | null;
  entityTitle?: string;
};

type RoutineComposerProps = {
  open: boolean;
  onClose: () => void;
  scope: ScopeInput;
  /** Optional counts for dry-run preview. */
  contextStats?: { itemCount?: number; blockedCount?: number; overdueCount?: number };
  /** Prefill sentence when opened from Odysseus or a chip. */
  initialSentence?: string;
  onSaved?: (routineId: string) => void;
};

function permissionLabel(mode: RoutinePermissionMode) {
  if (mode === "always") return "siempre";
  if (mode === "ask") return "pregunta";
  return "nunca";
}

function channelLabel(channel: string) {
  const map: Record<string, string> = {
    email: "Correo",
    comment: "Comentario",
    note: "Nota",
    whatsapp: "WhatsApp",
    slack: "Slack",
    webhook: "Webhook",
    update_items: "Actualizar ítems",
  };
  return map[channel] || channel;
}

function triggerHuman(spec: RoutineCompileResult["spec"]) {
  return spec.trigger.human || "Manual";
}

export function RoutineComposer({
  open,
  onClose,
  scope,
  contextStats,
  initialSentence,
  onSaved,
}: RoutineComposerProps) {
  const { user, workspace } = useAuth();
  const recipes = useMemo(() => recipesForEntity(scope.entityType), [scope.entityType]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [sentence, setSentence] = useState("");
  const [recipeId, setRecipeId] = useState<string | undefined>();
  const [compiled, setCompiled] = useState<RoutineCompileResult | null>(null);
  const [preview, setPreview] = useState<{ text: string; steps: Array<{ kind: string; label: string }> } | null>(
    null,
  );
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [busy, setBusy] = useState<"compile" | "preview" | "save" | null>(null);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSentence(String(initialSentence || "").trim());
    setCompiled(null);
    setPreview(null);
    setError("");
    setSavedId(null);
    setQuestionAnswer("");
  }, [open, initialSentence, scope.entityType, scope.entityId]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % COMPOSER_PLACEHOLDERS.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSentence("");
      setCompiled(null);
      setPreview(null);
      setRecipeId(undefined);
      setQuestionAnswer("");
      setError("");
      setSavedId(null);
      setBusy(null);
    }
  }, [open]);

  if (!open) return null;

  const compile = () => {
    const text = sentence.trim();
    if (!text) return;
    setBusy("compile");
    setError("");
    try {
      const result = compileRoutineSentence({
        sentence: text,
        scope: {
          entityType: scope.entityType,
          entityId: scope.entityId,
          entityTitle: scope.entityTitle,
        },
        ownerEmail: user?.email || undefined,
        recipeId,
      });
      setCompiled(result);
      setPreview(null);
      setQuestionAnswer(result.questions[0]?.suggested || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude compilar la rutina.");
    } finally {
      setBusy(null);
    }
  };

  const runPreview = async () => {
    if (!compiled) return;
    setBusy("preview");
    setError("");
    try {
      // Phase 1: local dry-run. Worker LLM preview lands in a later slice.
      const local = buildDryRunPreview({
        goal: compiled.spec.goal,
        scopeTitle: scope.entityTitle || scope.entityType,
        entityType: scope.entityType,
        itemCount: contextStats?.itemCount,
        blockedCount: contextStats?.blockedCount,
        overdueCount: contextStats?.overdueCount,
        language: compiled.spec.deliverable.language,
      });
      setPreview(local);

      if (user && workspace) {
        const token = await user.getIdToken();
        const response = await fetch("/api/routines/preview", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.uid,
            workspaceId: workspace.id,
            sentence: compiled.spec.sentence,
            goal: compiled.spec.goal,
            scope,
            contextStats,
            language: compiled.spec.deliverable.language,
          }),
        });
        if (response.ok) {
          const result = await response.json();
          if (String(result?.text || "").trim()) {
            setPreview({
              text: String(result.text),
              steps: Array.isArray(result.steps) ? result.steps : local.steps,
            });
          }
        }
      }
    } catch {
      // Local preview already set.
    } finally {
      setBusy(null);
    }
  };

  const activateDraft = async () => {
    if (!compiled || !user || !workspace) return;
    if (compiled.questions.length && !questionAnswer.trim()) {
      setError(compiled.questions[0]?.prompt || "Falta una aclaración.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      const next: RoutineCompileResult = {
        ...compiled,
        spec: {
          ...compiled.spec,
          deliverable: {
            ...compiled.spec.deliverable,
            to:
              questionAnswer.trim() && compiled.spec.deliverable.channel === "email"
                ? [questionAnswer.trim()]
                : compiled.spec.deliverable.to,
          },
          status: "active",
        },
      };
      const id = await saveRoutineDraft({
        workspaceId: workspace.id,
        ownerUserId: user.uid,
        compiled: next,
        activate: true,
      });
      setSavedId(id);
      onSaved?.(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude guardar la rutina.");
    } finally {
      setBusy(null);
    }
  };

  const updateSpec = (patch: Partial<RoutineCompileResult["spec"]>) => {
    if (!compiled) return;
    setCompiled({
      ...compiled,
      spec: { ...compiled.spec, ...patch },
    });
  };

  return (
    <div className="do-routine-overlay" data-testid="routine-composer">
      <button aria-label="Cerrar" className="do-routine-backdrop" onClick={onClose} type="button" />
      <div className="do-routine-popover" role="dialog" aria-label="Nueva rutina">
        <header className="do-routine-popover-head">
          <div>
            <span className="do-routine-kicker">
              <Sparkles size={13} /> Rutina
            </span>
            <strong>{scope.entityTitle || "Este alcance"}</strong>
          </div>
          <button aria-label="Cerrar rutina" className="do-project-icon-btn" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        {!compiled ? (
          <>
            <label className="do-routine-input-wrap">
              <span className="sr-only">Describí la rutina</span>
              <textarea
                autoFocus
                data-testid="routine-sentence-input"
                onChange={(event) => setSentence(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    compile();
                  }
                }}
                placeholder={COMPOSER_PLACEHOLDERS[placeholderIndex]}
                rows={3}
                value={sentence}
              />
            </label>
            <div className="do-routine-recipes" aria-label="Recetas">
              {recipes.map((recipe) => (
                <button
                  className={recipeId === recipe.id ? "is-active" : ""}
                  key={recipe.id}
                  onClick={() => {
                    setRecipeId(recipe.id);
                    setSentence(recipe.sentence);
                  }}
                  type="button"
                >
                  {recipe.title}
                </button>
              ))}
            </div>
            <footer className="do-routine-popover-foot">
              <span className="do-routine-muted">Una frase. Enter compila la tarjeta.</span>
              <button
                className="do-project-primary-btn"
                disabled={!sentence.trim() || busy === "compile"}
                onClick={compile}
                type="button"
              >
                {busy === "compile" ? <Loader2 size={14} className="do-spin" /> : null}
                Compilar
              </button>
            </footer>
          </>
        ) : (
          <>
            <RoutineCompiledCard
              compiled={compiled}
              onChangeGoal={(goal) => updateSpec({ goal })}
              onChangePermission={(key, mode) =>
                updateSpec({
                  permissions: { ...compiled.spec.permissions, [key]: mode },
                })
              }
            />

            {compiled.questions[0] ? (
              <div className="do-routine-question" data-testid="routine-question">
                <span>{compiled.questions[0].prompt}</span>
                <input
                  onChange={(event) => setQuestionAnswer(event.target.value)}
                  placeholder="valor sugerido"
                  value={questionAnswer}
                />
              </div>
            ) : null}

            {preview ? (
              <div className="do-routine-preview" data-testid="routine-preview">
                <strong>Vista previa</strong>
                <ol className="do-routine-steps">
                  {preview.steps.map((step, index) => (
                    <li key={`${step.label}-${index}`}>{step.label}</li>
                  ))}
                </ol>
                <pre>{preview.text}</pre>
              </div>
            ) : null}

            {error ? <p className="do-routine-error">{error}</p> : null}
            {savedId ? (
              <p className="do-routine-saved" data-testid="routine-saved">
                Activada. Próxima corrida según el horario de la tarjeta. Ver todas en Rutinas.
              </p>
            ) : null}

            <footer className="do-routine-popover-foot">
              <div className="do-routine-estimates">
                <span>~${compiled.estimatedCostUsd.toFixed(2)} / corrida</span>
                <span>·</span>
                <span>~{compiled.estimatedMinutesSaved} min ahorrados</span>
              </div>
              <div className="do-routine-actions">
                <button
                  className="do-project-quiet-btn"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setCompiled(null);
                    setPreview(null);
                  }}
                  type="button"
                >
                  Atrás
                </button>
                <button
                  className="do-project-quiet-btn"
                  data-testid="routine-try-now"
                  disabled={Boolean(busy)}
                  onClick={() => void runPreview()}
                  type="button"
                >
                  {busy === "preview" ? <Loader2 size={14} className="do-spin" /> : null}
                  Probar ahora
                </button>
                <button
                  className="do-project-primary-btn"
                  data-testid="routine-activate"
                  disabled={Boolean(busy) || Boolean(savedId)}
                  onClick={() => void activateDraft()}
                  type="button"
                >
                  {busy === "save" ? <Loader2 size={14} className="do-spin" /> : null}
                  {savedId ? "Guardada" : "Activar"}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function RoutineCompiledCard({
  compiled,
  onChangeGoal,
  onChangePermission,
}: {
  compiled: RoutineCompileResult;
  onChangeGoal: (goal: string) => void;
  onChangePermission: (
    key: "editItems" | "writeOthers",
    mode: RoutinePermissionMode,
  ) => void;
}) {
  const { spec } = compiled;
  return (
    <div className="do-routine-card" data-testid="routine-compiled-card">
      <div className="do-routine-card-row">
        <span>Cuándo</span>
        <b>{triggerHuman(spec)}</b>
      </div>
      <div className="do-routine-card-row is-stack">
        <span>Qué</span>
        <textarea
          aria-label="Objetivo de la rutina"
          onChange={(event) => onChangeGoal(event.target.value)}
          rows={2}
          value={spec.goal}
        />
      </div>
      <div className="do-routine-card-row">
        <span>Entrega</span>
        <b>
          {channelLabel(spec.deliverable.channel)}
          {spec.deliverable.to.length ? ` · ${spec.deliverable.to.join(", ")}` : ""}
          {` · ${spec.deliverable.format === "short" ? "corto" : "largo"}`}
          {` · ${spec.deliverable.language.toUpperCase()}`}
        </b>
      </div>
      <div className="do-routine-card-row is-stack">
        <span>Permisos</span>
        <div className="do-routine-perm-chips">
          <span className="is-on">Leer Certo · siempre</span>
          <span className="is-on">Escribirme · siempre</span>
          <button
            className={`is-${spec.permissions.editItems}`}
            onClick={() =>
              onChangePermission(
                "editItems",
                spec.permissions.editItems === "ask"
                  ? "always"
                  : spec.permissions.editItems === "always"
                    ? "never"
                    : "ask",
              )
            }
            type="button"
          >
            Editar ítems · {permissionLabel(spec.permissions.editItems)}
          </button>
          <button
            className={`is-${spec.permissions.writeOthers}`}
            onClick={() =>
              onChangePermission(
                "writeOthers",
                spec.permissions.writeOthers === "ask"
                  ? "never"
                  : spec.permissions.writeOthers === "never"
                    ? "ask"
                    : "always",
              )
            }
            type="button"
          >
            Escribir a otros · {permissionLabel(spec.permissions.writeOthers)}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { RoutineSpec };
