import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";

/**
 * Per-user Daily Plan flag. Alejandro enables via Firestore console:
 *   users/{uid}.flags.dailyPlan = true
 * The app never writes this field. Returns false while loading / signed out.
 */
export function useDailyPlanEnabled(): boolean {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setEnabled(false);
      return;
    }
    const ref = doc(db, "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        const flags = snap.exists() ? (snap.data() as { flags?: { dailyPlan?: unknown } }).flags : undefined;
        setEnabled(flags?.dailyPlan === true);
      },
      () => setEnabled(false),
    );
  }, [user?.uid]);

  return enabled;
}
