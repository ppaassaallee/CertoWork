type SnapshotState = {
  empty: boolean;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
};

/** An empty local cache is not proof that records were removed on the server. */
export function hasConfirmedSnapshotData(snapshot: SnapshotState) {
  return !snapshot.empty || !snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites;
}

/** Publish a first partial view if necessary, but never erase a complete view after an error. */
export function createCompleteSnapshotMerge<T extends { id: string }>(
  queryCount: number,
  publish: (items: T[]) => void,
  include: (item: T) => boolean = () => true,
) {
  const buckets = new Map<number, T[]>();
  const settled = new Set<number>();
  let failed = false;
  let publishedComplete = false;
  const publishAvailable = () => {
    if (settled.size !== queryCount || buckets.size === 0 || (failed && publishedComplete)) return;
    const merged = new Map<string, T>();
    for (const bucket of buckets.values()) {
      for (const item of bucket) if (include(item)) merged.set(item.id, item);
    }
    publish([...merged.values()]);
    if (!failed) publishedComplete = true;
  };
  return {
    update(index: number, items: T[]) {
      buckets.set(index, items);
      settled.add(index);
      publishAvailable();
    },
    fail(index: number) {
      failed = true;
      settled.add(index);
      publishAvailable();
    },
  };
}
