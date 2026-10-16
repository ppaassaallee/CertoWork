import { useCallback, useSyncExternalStore } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { createSharedFlagStore, type UserFeatureFlags } from "./sharedFlagStore";

const store = createSharedFlagStore((uid, publish) =>
  onSnapshot(
    doc(db, "users", uid),
    (snapshot) => {
      const flags = snapshot.exists()
        ? (snapshot.data() as { flags?: Record<string, unknown> }).flags
        : undefined;
      publish({
        dailyBrief: flags?.dailyBrief === true,
        billing: flags?.billing === true,
        tables: flags?.tables === true,
        collab: flags?.collab === true,
        dailyPlan: flags?.dailyPlan === true,
      });
    },
    () => publish({}),
  ),
);

export function useUserFlags(uid?: string | null): UserFeatureFlags {
  const subscribe = useCallback((notify: () => void) => store.subscribe(uid, notify), [uid]);
  const getSnapshot = useCallback(() => store.getSnapshot(uid), [uid]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
