/** Apply a React-style setState update to a doc store. */
export function applyStoreUpdate<T extends { id: string }>(
  store: {
    getSnapshot: () => T[];
    replaceAll: (rows: T[]) => void;
    clear: () => void;
  },
  update: T[] | ((prev: T[]) => T[]),
) {
  if (typeof update === "function") {
    store.replaceAll(update(store.getSnapshot()));
    return;
  }
  if (update.length === 0) {
    store.clear();
    return;
  }
  store.replaceAll(update);
}
