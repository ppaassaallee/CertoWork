import { useEffect, useState } from "react";
import { runUndo, subscribeUndo, type UndoEntry } from "../lib/undoToast";

export function UndoToast() {
  const [entry, setEntry] = useState<UndoEntry | null>(null);
  useEffect(() => subscribeUndo(setEntry), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
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
