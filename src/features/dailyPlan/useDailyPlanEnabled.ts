import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";

const LS_KEY = "certoDailyPlan";
const CHANGE_EVENT = "certo-daily-plan-changed";

function readLocalOverride(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocalOverride(on: boolean) {
  try {
    if (on) window.localStorage.setItem(LS_KEY, "1");
    else window.localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

/**
 * Per-user Daily Plan flag.
 * - Firestore: `users/{uid}.flags.dailyPlan = true`
 * - Instant local override: localStorage `certoDailyPlan=1`
 */
export function useDailyPlanEnabled(): boolean {
  const { user } = useAuth();
  const [remote, setRemote] = useState(false);
  const [local, setLocal] = useState(readLocalOverride);

  useEffect(() => {
    if (!user?.uid) {
      setRemote(false);
      return;
    }
    const ref = doc(db, "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        const flags = snap.exists()
          ? (snap.data() as { flags?: { dailyPlan?: unknown } }).flags
          : undefined;
        setRemote(flags?.dailyPlan === true);
      },
      () => setRemote(false),
    );
  }, [user?.uid]);

  useEffect(() => {
    const syncLocal = () => setLocal(readLocalOverride());
    window.addEventListener(CHANGE_EVENT, syncLocal);
    window.addEventListener("storage", syncLocal);
    return () => {
      window.removeEventListener(CHANGE_EVENT, syncLocal);
      window.removeEventListener("storage", syncLocal);
    };
  }, []);

  return remote || local;
}

/** Turn Daily Plan on for this user (Firestore + localStorage). */
export async function enableDailyPlan(uid: string): Promise<void> {
  writeLocalOverride(true);
  try {
    await setDoc(doc(db, "users", uid), { flags: { dailyPlan: true } }, { merge: true });
  } catch {
    /* local override still works if rules lag */
  }
}

/** Turn Daily Plan off. */
export async function disableDailyPlan(uid: string): Promise<void> {
  writeLocalOverride(false);
  try {
    await setDoc(doc(db, "users", uid), { flags: { dailyPlan: false } }, { merge: true });
  } catch {
    /* ignore */
  }
}
