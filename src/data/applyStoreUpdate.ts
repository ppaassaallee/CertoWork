function sameValue(left: unknown, right: unknown) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function sameMember<T extends { id: string }>(left: T, right: T) {
  if (left === right) return true;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => sameValue(leftRecord[key], rightRecord[key]));
}

/**
 * Apply a React-style setState update to a doc store.
 * Field edits (title, tags) often keep the same updatedAt until the server
 * timestamp lands. replaceAll ignores those because it only compares id +
 * stamp, so optimistic tag and rename updates were dropped. Row upserts
 * apply the changed document and leave untouched rows alone.
 */
export function applyStoreUpdate<T extends { id: string }>(
  store: {
    getSnapshot: () => T[];
    replaceAll: (rows: T[]) => void;
    clear: () => void;
    upsert?: (row: T) => void;
    remove?: (id: string) => void;
  },
  update: T[] | ((prev: T[]) => T[]),
) {
  if (typeof update === "function") {
    const prev = store.getSnapshot();
    const next = update(prev);
    if (store.upsert && store.remove) {
      const prevById = new Map(prev.map((row) => [row.id, row]));
      const nextIds = new Set<string>();
      for (const row of next) {
        nextIds.add(row.id);
        const before = prevById.get(row.id);
        if (!before || !sameMember(before, row)) store.upsert(row);
      }
      for (const row of prev) {
        if (!nextIds.has(row.id)) store.remove(row.id);
      }
      return;
    }
    store.replaceAll(next);
    return;
  }
  if (update.length === 0) {
    store.clear();
    return;
  }
  store.replaceAll(update);
}
