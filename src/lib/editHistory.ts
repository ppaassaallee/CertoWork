import { useSyncExternalStore } from "react";

/** Five-step undo/redo for work edits. Undo and redo do not record themselves. */

export const EDIT_HISTORY_LIMIT = 5;

export type EditLabel = { en: string; es: string };

export type EditStep = {
  id: string;
  label: EditLabel;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
};

type Listener = () => void;

type Snapshot = {
  undoLabel: EditLabel | null;
  redoLabel: EditLabel | null;
  undoCount: number;
  redoCount: number;
};

const listeners = new Set<Listener>();
let undoStack: EditStep[] = [];
let redoStack: EditStep[] = [];
let applying = false;
let snapshot: Snapshot = { undoLabel: null, redoLabel: null, undoCount: 0, redoCount: 0 };

type ItemWriter = (
  taskId: string,
  patch: Record<string, unknown>,
  options?: { history?: boolean },
) => Promise<void> | void;

let itemWriter: ItemWriter = async () => undefined;

export function bindItemHistoryWriter(writer: ItemWriter) {
  itemWriter = writer;
}

export function isApplyingHistory() {
  return applying;
}

function publish() {
  const undo = undoStack[0];
  const redo = redoStack[0];
  snapshot = {
    undoLabel: undo?.label || null,
    redoLabel: redo?.label || null,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
  };
  for (const listener of listeners) listener();
}

export function getHistorySnapshot() {
  return snapshot;
}

export function subscribeHistory(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEditHistory() {
  return useSyncExternalStore(subscribeHistory, getHistorySnapshot, getHistorySnapshot);
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

export function pushEdit(step: Omit<EditStep, "id"> & { id?: string }) {
  if (applying) return "";
  const next: EditStep = { ...step, id: step.id || `${Date.now()}-${undoStack.length}` };
  undoStack = [next, ...undoStack].slice(0, EDIT_HISTORY_LIMIT);
  redoStack = [];
  publish();
  return next.id;
}

export async function undoEdit() {
  if (applying) return false;
  const step = undoStack[0];
  if (!step) return false;
  undoStack = undoStack.slice(1);
  applying = true;
  publish();
  try {
    await step.undo();
    redoStack = [step, ...redoStack].slice(0, EDIT_HISTORY_LIMIT);
    return true;
  } catch (error) {
    undoStack = [step, ...undoStack].slice(0, EDIT_HISTORY_LIMIT);
    console.error("Undo failed", error);
    return false;
  } finally {
    applying = false;
    publish();
  }
}

export async function redoEdit() {
  if (applying) return false;
  const step = redoStack[0];
  if (!step) return false;
  redoStack = redoStack.slice(1);
  applying = true;
  publish();
  try {
    await step.redo();
    undoStack = [step, ...undoStack].slice(0, EDIT_HISTORY_LIMIT);
    return true;
  } catch (error) {
    redoStack = [step, ...redoStack].slice(0, EDIT_HISTORY_LIMIT);
    console.error("Redo failed", error);
    return false;
  } finally {
    applying = false;
    publish();
  }
}

function sameValue(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  if (left == null && right == null) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function isSentinel(value: unknown) {
  return Boolean(value && typeof value === "object" && "_methodName" in (value as object));
}

export function reversibleChange(before: Record<string, unknown>, written: Record<string, unknown>) {
  const undoPatch: Record<string, unknown> = {};
  const redoPatch: Record<string, unknown> = {};
  let changed = false;
  for (const key of Object.keys(written)) {
    if (key === "updatedAt") continue;
    const next = written[key];
    if (isSentinel(next)) continue;
    const prev = before[key];
    if (sameValue(prev, next)) continue;
    changed = true;
    undoPatch[key] = prev === undefined ? null : prev;
    redoPatch[key] = next;
  }
  return changed ? { undoPatch, redoPatch } : null;
}

function itemName(before: Record<string, unknown>) {
  const name = String(before.title || before.name || "Item").trim() || "Item";
  return name.length > 42 ? `${name.slice(0, 40)}…` : name;
}

export function describeItemEdit(before: Record<string, unknown>, patch: Record<string, unknown>): EditLabel {
  const name = itemName(before);
  if ("status" in patch) {
    const next = String(patch.status || "");
    if (next === "deleted" || next === "archived") {
      return { en: `Deleted “${name}”`, es: `Eliminada “${name}”` };
    }
    if (next === "done" || next === "completed" || next === "closed") {
      return { en: `Marked “${name}” done`, es: `Marcada “${name}” como terminada` };
    }
    if (next === "cancelled" || next === "canceled") {
      return { en: `Cancelled “${name}”`, es: `Cancelada “${name}”` };
    }
    return { en: `Status of “${name}”`, es: `Estado de “${name}”` };
  }
  if ("title" in patch || "name" in patch) {
    return { en: `Renamed “${name}”`, es: `Renombrada “${name}”` };
  }
  if ("assigneeIds" in patch || "assigneeId" in patch || "owner" in patch) {
    return { en: `Reassigned “${name}”`, es: `Reasignada “${name}”` };
  }
  if ("dueDate" in patch || "targetDate" in patch || "startDate" in patch || "parentId" in patch) {
    return { en: `Moved “${name}”`, es: `Movida “${name}”` };
  }
  if ("rank" in patch || "order" in patch || "manualOrder" in patch) {
    return { en: `Reordered “${name}”`, es: `Reordenada “${name}”` };
  }
  return { en: `Updated “${name}”`, es: `Actualizada “${name}”` };
}

export function recordItemEdit(
  taskId: string,
  before: Record<string, unknown>,
  userPatch: Record<string, unknown>,
  written: Record<string, unknown>,
) {
  if (applying) return "";
  const diff = reversibleChange(before, written);
  if (!diff) return "";
  const undoPatch = diff.undoPatch;
  const redoPatch = diff.redoPatch;
  return pushEdit({
    label: describeItemEdit(before, userPatch),
    undo: () => Promise.resolve(itemWriter(taskId, undoPatch, { history: false })),
    redo: () => Promise.resolve(itemWriter(taskId, redoPatch, { history: false })),
  });
}

export function resetEditHistoryForTests() {
  undoStack = [];
  redoStack = [];
  applying = false;
  itemWriter = async () => undefined;
  listeners.clear();
  snapshot = { undoLabel: null, redoLabel: null, undoCount: 0, redoCount: 0 };
}
