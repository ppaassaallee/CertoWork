import { useCallback, useSyncExternalStore } from "react";
import { isRemovedWorkItem } from "./itemRemoval";
import { isCompletedWorkStatus } from "./workStatuses";

/** Done rows stay hidden until the user asks to see them. One preference per list. */
const STORAGE_PREFIX = "certo.work.showDone:";

type Listener = () => void;
const listeners = new Set<Listener>();
const viewAsks = new Map<string, boolean>();
const forcedOff = new Map<string, boolean>();
const candidates = new Map<string, readonly unknown[]>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeDoneVisibility(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readShowDone(scope: string) {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${scope}`) === "1";
  } catch {
    return false;
  }
}

export function writeShowDone(scope: string, value: boolean) {
  const current = readShowDone(scope);
  if (current === value) return;
  try {
    if (value) localStorage.setItem(`${STORAGE_PREFIX}${scope}`, "1");
    else localStorage.removeItem(`${STORAGE_PREFIX}${scope}`);
  } catch {
    /* private mode */
  }
  emit();
}

export function isDoneWorkItem(item: unknown) {
  if (!item || typeof item !== "object" || isRemovedWorkItem(item)) return false;
  const status = (item as { status?: unknown }).status;
  return isCompletedWorkStatus(status == null ? null : String(status));
}

export function hideDoneItems<T>(items: readonly T[], revealDone: boolean) {
  if (revealDone) return items.slice();
  return items.filter((item) => !isDoneWorkItem(item));
}

export function countDoneItems(items: readonly unknown[]) {
  return items.reduce<number>((count, item) => count + (isDoneWorkItem(item) ? 1 : 0), 0);
}

export function viewAsksForDone(view?: { filters?: Array<{ columnId?: string; op?: string; value?: unknown }> } | null) {
  const filters = view?.filters || [];
  return filters.some((rule) => {
    if (rule.columnId !== "status" || (rule.op !== "eq" && rule.op !== "in")) return false;
    const values = Array.isArray(rule.value) ? rule.value : [rule.value];
    return values.some((value) => isCompletedWorkStatus(String(value || "")));
  });
}

export function revealDoneFor(scope: string) {
  if (forcedOff.get(scope)) return false;
  return readShowDone(scope) || viewAsks.get(scope) === true;
}

export function setDoneViewAsks(scope: string, asks: boolean) {
  if ((viewAsks.get(scope) === true) === asks && viewAsks.has(scope)) return;
  viewAsks.set(scope, asks);
  emit();
}

export function setDoneCandidates(scope: string, rows: readonly unknown[]) {
  if (candidates.get(scope) === rows) return;
  candidates.set(scope, rows);
  emit();
}

export function useDoneCandidates(scope: string) {
  return useSyncExternalStore(
    subscribeDoneVisibility,
    () => candidates.get(scope),
    () => undefined,
  );
}

export function clearDoneForce(scope: string) {
  if (!forcedOff.get(scope)) return;
  forcedOff.delete(scope);
  emit();
}

export function toggleDoneVisibility(scope: string) {
  const reveal = revealDoneFor(scope);
  if (reveal) {
    writeShowDone(scope, false);
    if (viewAsks.get(scope)) forcedOff.set(scope, true);
    else forcedOff.delete(scope);
  } else {
    writeShowDone(scope, true);
    forcedOff.delete(scope);
  }
  emit();
}

export function useRevealDone(scope: string) {
  return useSyncExternalStore(
    subscribeDoneVisibility,
    () => revealDoneFor(scope),
    () => false,
  );
}

export function useToggleDone(scope: string) {
  const reveal = useRevealDone(scope);
  const toggle = useCallback(() => toggleDoneVisibility(scope), [scope]);
  return { reveal, toggle };
}

export function resetDoneVisibilityForTests() {
  viewAsks.clear();
  forcedOff.clear();
  candidates.clear();
  listeners.clear();
  try {
    const drop: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(STORAGE_PREFIX)) drop.push(key);
    }
    for (const key of drop) localStorage.removeItem(key);
  } catch {
    /* no storage */
  }
}
