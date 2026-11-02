import { useEffect, useState } from "react";
import { canRedo, canUndo, redoEdit, undoEdit } from "../lib/editHistory";
import { runUndo, subscribeUndo, type UndoEntry } from "../lib/undoToast";

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
}

export function UndoToast() {
  const [entry, setEntry] = useState<UndoEntry | null>(null);
  useEffect(() => subscribeUndo(setEntry), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const redo = (key === "z" && event.shiftKey) || key === "y";
      const undo = key === "z" && !event.shiftKey;
      if (!undo && !redo) return;
      if (redo) {
        if (!canRedo()) return;
        event.preventDefault();
        void redoEdit();
        return;
      }
      if (canUndo()) {
        event.preventDefault();
        void undoEdit();
        return;
      }
      if (!entry) return;
      event.preventDefault();
      runUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry]);
  if (!entry) return null;
  return (
    <div className="cw-undo-toast" data-testid="undo-toast" role="status">
      <span>{entry.label}</span>
      <button type="button" onClick={() => runUndo()}>Undo</button>
    </div>
  );
}
