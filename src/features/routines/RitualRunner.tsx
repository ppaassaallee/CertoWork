import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "../../components/ui/Icon";
import { Kbd } from "../../components/ui/Kbd";
import { getLocale } from "../../lib/i18n";
import {
  weekLabel,
  type RecipeManifest,
  type StepSpec,
} from "../../lib/routines/manifest";
import {
  patchRoutineSession,
  type RoutineSession,
} from "../../lib/routines/sessions";
import { RitualCardHost } from "./cards";
import type { GoalComposerAnswer } from "./cards/GoalComposer";
import type { TimeBlocksAnswer } from "./cards/TimeBlocks";
import { finishRitualSession } from "./finishSession";
import "./ritualRunner.css";

export type RitualRunnerProps = {
  open: boolean;
  session: RoutineSession;
  manifest: RecipeManifest;
  onClose: () => void;
  onFinished?: (result: {
    sessionId: string;
    noteId: string;
    chainTo?: string;
  }) => void;
};

function activeSteps(manifest: RecipeManifest, condensed?: boolean): StepSpec[] {
  if (!condensed || !manifest.summaryStepIds?.length) return manifest.steps;
  const allow = new Set(manifest.summaryStepIds);
  return manifest.steps.filter((step) => allow.has(step.id) || step.id === "cierre-final" || step.id === "compromiso");
}

export function RitualRunner({
  open,
  session,
  manifest,
  onClose,
  onFinished,
}: RitualRunnerProps) {
  const locale = getLocale() === "es" ? "es" : "en";
  const steps = useMemo(
    () => activeSteps(manifest, session.condensed || session.status === "missed"),
    [manifest, session.condensed, session.status],
  );
  const [stepIndex, setStepIndex] = useState(
    Math.min(session.stepIndex || 0, Math.max(0, steps.length - 1)),
  );
  const [answers, setAnswers] = useState<Record<string, unknown>>(session.answers || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStepIndex(Math.min(session.stepIndex || 0, Math.max(0, steps.length - 1)));
    setAnswers(session.answers || {});
  }, [session.id, session.stepIndex, session.answers, steps.length]);

  const step = steps[stepIndex];
  const remainingMin = Math.max(
    1,
    Math.round(
      ((manifest.estimatedMinutes || 10) * (steps.length - stepIndex)) / steps.length,
    ),
  );

  const persist = useCallback(
    async (patch: { stepIndex?: number; answers?: Record<string, unknown>; status?: RoutineSession["status"] }) => {
      await patchRoutineSession(session.id, {
        stepIndex: patch.stepIndex ?? stepIndex,
        answers: patch.answers ?? answers,
        status: patch.status || "in_progress",
      });
    },
    [session.id, stepIndex, answers],
  );

  const setCardAnswer = (cardId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [cardId]: value }));
  };

  // Autosave debounce
  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void persist({ status: "in_progress" });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [answers, stepIndex, open, persist]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void goNext();
      }
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, answers]);

  const goBack = async () => {
    if (stepIndex <= 0) return;
    const next = stepIndex - 1;
    setStepIndex(next);
    await persist({ stepIndex: next });
  };

  const pauseLater = async () => {
    await persist({ status: "paused" });
    onClose();
  };

  const goNext = async () => {
    setError("");
    if (stepIndex >= steps.length - 1) {
      setBusy(true);
      try {
        const snapshot: RoutineSession = {
          ...session,
          stepIndex,
          answers,
          status: "in_progress",
        };
        const result = await finishRitualSession({
          session: snapshot,
          manifest,
          locale,
        });
        await patchRoutineSession(session.id, {
          status: "completed",
          stepIndex,
          answers,
          noteId: result.noteId,
          actions: result.actions,
        });
        onFinished?.({
          sessionId: session.id,
          noteId: result.noteId,
          chainTo: manifest.chainsTo,
        });
        onClose();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No pude guardar.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const next = stepIndex + 1;
    setStepIndex(next);
    await persist({ stepIndex: next });
  };

  const skip = async () => {
    if (!step?.skippable) return;
    await goNext();
  };

  if (!open || !step) return null;

  const nextLabel =
    stepIndex >= steps.length - 1
      ? locale === "es"
        ? "Terminar"
        : "Finish"
      : `${locale === "es" ? "Siguiente" : "Next"}: ${steps[stepIndex + 1]?.label || ""}`;

  return (
    <div className="cw-ritual-root" data-testid="ritual-runner" role="dialog" aria-modal="true">
      <div className="cw-ritual-backdrop" onClick={() => void pauseLater()} />
      <div className="cw-ritual-modal">
        <header className="cw-ritual-header">
          <div className="cw-ritual-brand">
            <span aria-hidden>✦</span>
            <strong>{manifest.name}</strong>
            <em>
              · {weekLabel(session.weekOf, locale)}
              {session.status === "missed" || session.condensed
                ? locale === "es"
                  ? " · resumida"
                  : " · condensed"
                : ""}
            </em>
          </div>
          <div className="cw-ritual-progress">
            <div className="cw-ritual-dots" aria-hidden>
              {steps.map((s, i) => (
                <i className={i <= stepIndex ? "is-on" : ""} key={s.id} />
              ))}
            </div>
            <span>
              {stepIndex + 1} {locale === "es" ? "de" : "of"} {steps.length} · ~{remainingMin}{" "}
              min
            </span>
            <button aria-label="Close" onClick={() => void pauseLater()} type="button">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="cw-ritual-body">
          <p className="cw-ritual-step-label">{step.label}</p>
          <h1>{step.question}</h1>
          {step.hint ? <p className="cw-ritual-hint">{step.hint}</p> : null}

          <div className="cw-ritual-cards">
            {step.cards.map((card) => {
              const extraProps: Record<string, unknown> = { ...(card.props || {}) };
              if (card.type === "Capacity") {
                extraProps.goals = answers.goals as GoalComposerAnswer | undefined;
                extraProps.blocks = answers.blocks as TimeBlocksAnswer | undefined;
              }
              return (
                <RitualCardHost
                  cardId={card.id}
                  key={card.id}
                  locale={locale}
                  onChange={(value) => setCardAnswer(card.id, value)}
                  prepared={session.prepared || {}}
                  props={extraProps}
                  type={card.type}
                  value={answers[card.id]}
                />
              );
            })}
          </div>
          {error ? <p className="cw-ritual-error">{error}</p> : null}
        </div>

        <footer className="cw-ritual-footer">
          <div className="cw-ritual-footer-left">
            <button disabled={stepIndex === 0 || busy} onClick={() => void goBack()} type="button">
              ← {locale === "es" ? "Atrás" : "Back"}
            </button>
            <button disabled={busy} onClick={() => void pauseLater()} type="button">
              {locale === "es" ? "Continuar más tarde" : "Continue later"}
            </button>
          </div>
          <div className="cw-ritual-footer-right">
            {step.skippable ? (
              <button disabled={busy} onClick={() => void skip()} type="button">
                {locale === "es" ? "Omitir" : "Skip"}
              </button>
            ) : null}
            <button
              className="cw-ritual-primary"
              disabled={busy}
              onClick={() => void goNext()}
              type="button"
            >
              {busy ? "…" : nextLabel} <Kbd>⌘ ↵</Kbd>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
