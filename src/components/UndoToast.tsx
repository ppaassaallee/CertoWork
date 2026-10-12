import { useEffect, useState } from "react";
import { currentUndo, runUndo, subscribeUndo } from "../lib/undoToast";

export function UndoToast() {
  const [entry, setEntry] = useState(currentUndo);
  useEffect(() => subscribeUndo(() => setEntry(currentUndo())), []);
  if (!entry) return null;
  return (
    <div className="cw-undo-toast" role="status" data-testid="undo-toast">
      <span>{entry.message}</span>
      <button type="button" onClick={() => runUndo()}>
        Undo
      </button>
    </div>
  );
}
