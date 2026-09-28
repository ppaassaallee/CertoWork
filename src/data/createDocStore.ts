import { useCallback, useRef, useSyncExternalStore } from "react";

export type DocRow = { id: string; updatedAt?: unknown; [key: string]: unknown };

function rowStamp(row: DocRow): string {
  const updated = row.updatedAt as { seconds?: number; toMillis?: () => number } | string | number | null | undefined;
  if (updated == null) return "";
  if (typeof updated === "string" || typeof updated === "number") return String(updated);
  if (typeof updated.toMillis === "function") return String(updated.toMillis());
  if (typeof updated.seconds === "number") return String(updated.seconds);
  return String(updated);
}

/** True when ids + updatedAt stamps match (order-sensitive). */
export function sameDocSignature(left: DocRow[], right: DocRow[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i].id !== right[i].id) return false;
    if (rowStamp(left[i]) !== rowStamp(right[i])) return false;
  }
  return true;
}

export type DocStore<T extends DocRow> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T[];
  getMap: () => Map<string, T>;
  replaceAll: (rows: T[]) => void;
  upsert: (row: T) => void;
  remove: (id: string) => void;
  clear: () => void;
};

/**
 * Map-backed collection store for useSyncExternalStore.
 * replaceAll is a no-op when the id/updatedAt signature is unchanged — cuts
 * shell re-renders from Firestore republishes that carry the same documents.
 */
export function createDocStore<T extends DocRow>(): DocStore<T> {
  let map = new Map<string, T>();
  let snapshot: T[] = [];
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const rebuildSnapshot = () => {
    snapshot = [...map.values()];
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    getMap() {
      return map;
    },
    replaceAll(rows) {
      if (sameDocSignature(snapshot, rows)) return;
      map = new Map(rows.map((row) => [row.id, row]));
      rebuildSnapshot();
      emit();
    },
    upsert(row) {
      const prev = map.get(row.id);
      if (prev && rowStamp(prev) === rowStamp(row) && prev === row) return;
      if (prev && sameDocSignature([prev], [row])) {
        // Same stamp — still replace object if callers need fresh fields without stamp change.
        // Only skip when shallow stamp+id equal AND JSON of keys we care about matches.
      }
      map.set(row.id, row);
      rebuildSnapshot();
      emit();
    },
    remove(id) {
      if (!map.has(id)) return;
      map.delete(id);
      rebuildSnapshot();
      emit();
    },
    clear() {
      if (snapshot.length === 0) return;
      map = new Map();
      snapshot = [];
      emit();
    },
  };
}

export function useDocStore<T extends DocRow>(store: DocStore<T>): T[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useDocSelector<T extends DocRow, S>(
  store: DocStore<T>,
  selector: (rows: T[]) => S,
  isEqual: (a: S, b: S) => boolean = Object.is,
): S {
  const selectedRef = useRef<S>(selector(store.getSnapshot()));
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const subscribe = useCallback(
    (onChange: () => void) =>
      store.subscribe(() => {
        const next = selectorRef.current(store.getSnapshot());
        if (!isEqual(selectedRef.current, next)) {
          selectedRef.current = next;
          onChange();
        }
      }),
    [store, isEqual],
  );

  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(store.getSnapshot());
    if (!isEqual(selectedRef.current, next)) selectedRef.current = next;
    return selectedRef.current;
  }, [store, isEqual]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
