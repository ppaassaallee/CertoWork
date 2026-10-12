export type UndoEntry = {
  id: string;
  label: string;
  undo: () => void | Promise<void>;
};

type Listener = (entry: UndoEntry | null) => void;

const listeners = new Set<Listener>();
let current: UndoEntry | null = null;
let timer = 0;

function emit() {
  for (const listener of listeners) listener(current);
}

export function pushUndo(label: string, undo: () => void | Promise<void>) {
  if (timer) window.clearTimeout(timer);
  current = { id: `${Date.now()}`, label, undo };
  emit();
  timer = window.setTimeout(() => {
    current = null;
    timer = 0;
    emit();
  }, 10_000);
  return current.id;
}

export function runUndo() {
  const entry = current;
  current = null;
  if (timer) window.clearTimeout(timer);
  timer = 0;
  emit();
  if (entry) void Promise.resolve(entry.undo());
}

export function subscribeUndo(listener: Listener) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function resetUndoForTests() {
  current = null;
  if (timer) window.clearTimeout(timer);
  timer = 0;
  listeners.clear();
}
