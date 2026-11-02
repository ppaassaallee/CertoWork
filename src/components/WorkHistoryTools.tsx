import { useState } from "react";
import { CheckCircle2, Circle, Redo2, Undo2 } from "./ui/Icon";
import { redoEdit, undoEdit, useEditHistory } from "../lib/editHistory";
import { countDoneItems, useDoneCandidates, useToggleDone } from "../lib/doneVisibility";
import { localize } from "../lib/localize";
import { useLocale } from "../lib/useLocale";

function shortcutMod() {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
}

export function WorkHistoryTools({
  scope,
  rows,
}: {
  scope: string;
  rows: readonly unknown[];
}) {
  const locale = useLocale();
  const history = useEditHistory();
  const { reveal, toggle } = useToggleDone(scope);
  const publishedRows = useDoneCandidates(scope);
  const [announce, setAnnounce] = useState("");
  const mod = shortcutMod();
  const undoText = history.undoLabel ? localize(locale, history.undoLabel.en, history.undoLabel.es) : "";
  const redoText = history.redoLabel ? localize(locale, history.redoLabel.en, history.redoLabel.es) : "";
  const hiddenCount = reveal ? 0 : countDoneItems(publishedRows || rows);
  const showLabel = localize(locale, "Show done", "Ver terminadas");
  const hideLabel = localize(locale, "Hide done", "Ocultar terminadas");
  const doneLabel = reveal ? hideLabel : showLabel;
  const doneTitle = reveal
    ? localize(locale, "Hide tasks marked done", "Ocultar tareas terminadas")
    : hiddenCount > 0
      ? localize(
          locale,
          `Show ${hiddenCount} done task${hiddenCount === 1 ? "" : "s"}`,
          `Ver ${hiddenCount} terminada${hiddenCount === 1 ? "" : "s"}`,
        )
      : localize(locale, "Show tasks marked done", "Ver tareas terminadas");

  return (
    <div className="cw-history-tools" data-testid="work-history-tools">
      <div className="cw-history-pair" role="group" aria-label={localize(locale, "Undo and redo", "Deshacer y rehacer")}>
        <button
          aria-disabled={history.undoCount === 0}
          aria-keyshortcuts="Control+Z Meta+Z"
          aria-label={undoText ? localize(locale, `Undo: ${undoText}`, `Deshacer: ${undoText}`) : localize(locale, "Undo", "Deshacer")}
          className={history.undoCount === 0 ? "is-disabled" : ""}
          data-testid="undo-button"
          onClick={() => {
            if (!history.undoCount) return;
            setAnnounce(localize(locale, `Undone. ${undoText}`, `Deshecho. ${undoText}`));
            void undoEdit();
          }}
          title={
            undoText
              ? `${localize(locale, "Undo", "Deshacer")}: ${undoText} (${mod}Z)`
              : localize(locale, `Nothing to undo (${mod}Z)`, `Nada que deshacer (${mod}Z)`)
          }
          type="button"
        >
          <Undo2 size={14} />
          <span className="cw-history-label">{localize(locale, "Undo", "Deshacer")}</span>
          {history.undoCount > 1 ? <span className="cw-history-step">{history.undoCount}</span> : null}
        </button>
        <button
          aria-disabled={history.redoCount === 0}
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          aria-label={redoText ? localize(locale, `Redo: ${redoText}`, `Rehacer: ${redoText}`) : localize(locale, "Redo", "Rehacer")}
          className={history.redoCount === 0 ? "is-disabled" : ""}
          data-testid="redo-button"
          onClick={() => {
            if (!history.redoCount) return;
            setAnnounce(localize(locale, `Redone. ${redoText}`, `Rehecho. ${redoText}`));
            void redoEdit();
          }}
          title={
            redoText
              ? `${localize(locale, "Redo", "Rehacer")}: ${redoText} (${mod}⇧Z)`
              : localize(locale, `Nothing to redo (${mod}⇧Z)`, `Nada que rehacer (${mod}⇧Z)`)
          }
          type="button"
        >
          <Redo2 size={14} />
          <span className="cw-history-label">{localize(locale, "Redo", "Rehacer")}</span>
        </button>
      </div>
      <button
        aria-pressed={reveal}
        className={`cw-history-done${reveal ? " is-on" : ""}`}
        data-testid="show-done-toggle"
        onClick={toggle}
        title={doneTitle}
        type="button"
      >
        {reveal ? <CheckCircle2 size={14} /> : <Circle size={14} />}
        <span className="cw-history-label">{doneLabel}</span>
        {hiddenCount > 0 ? <span className="cw-history-count">{hiddenCount > 99 ? "99+" : hiddenCount}</span> : null}
      </button>
      <span aria-live="polite" className="sr-only">{announce}</span>
    </div>
  );
}
