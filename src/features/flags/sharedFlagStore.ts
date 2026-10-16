export type UserFeatureFlags = Readonly<Record<string, boolean>>;

type Entry = {
  flags: UserFeatureFlags;
  listeners: Set<() => void>;
  stop?: () => void;
};

const EMPTY_FLAGS: UserFeatureFlags = Object.freeze({});

function sameFlags(left: UserFeatureFlags, right: UserFeatureFlags): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

/** One underlying document listener per signed-in user, shared by every flag hook. */
export function createSharedFlagStore(
  listen: (uid: string, publish: (flags: UserFeatureFlags) => void) => () => void,
) {
  const entries = new Map<string, Entry>();

  return {
    getSnapshot(uid?: string | null): UserFeatureFlags {
      return (uid && entries.get(uid)?.flags) || EMPTY_FLAGS;
    },
    subscribe(uid: string | null | undefined, notify: () => void): () => void {
      if (!uid) return () => {};
      let entry = entries.get(uid);
      if (!entry) {
        entry = { flags: EMPTY_FLAGS, listeners: new Set() };
        entries.set(uid, entry);
      }
      entry.listeners.add(notify);
      if (entry.listeners.size === 1) {
        entry.stop = listen(uid, (flags) => {
          const current = entries.get(uid);
          if (!current || sameFlags(current.flags, flags)) return;
          current.flags = flags;
          current.listeners.forEach((listener) => listener());
        });
      }
      return () => {
        const current = entries.get(uid);
        if (!current) return;
        current.listeners.delete(notify);
        if (current.listeners.size === 0) {
          current.stop?.();
          entries.delete(uid);
        }
      };
    },
  };
}
