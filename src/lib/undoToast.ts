import { UNDO_WINDOW_MS } from "./softDelete";

export type UndoEntry = {
  id: number;
  message: string;
  undo: () => void;
};

let entry: UndoEntry | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function currentUndo() {
  return entry;
}

export function subscribeUndo(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pushUndo(message: string, undo: () => void) {
  if (timer) clearTimeout(timer);
  entry = { id: nextId++, message, undo };
  emit();
  const id = entry.id;
  timer = setTimeout(() => {
    if (entry?.id === id) {
      entry = null;
      emit();
    }
  }, UNDO_WINDOW_MS);
  return id;
}

export function runUndo() {
  const current = entry;
  entry = null;
  if (timer) clearTimeout(timer);
  emit();
  current?.undo();
}

/** Test helper. */
export function resetUndoForTests() {
  entry = null;
  if (timer) clearTimeout(timer);
  timer = null;
  emit();
}
