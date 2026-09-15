import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  DAY_PLANS_COLLECTION, dayPlanId, localDateKey, computeFocusScore,
  setKeyItem, addPlannedItem, clearPlannedItem,
  type DayPlan, type FocusScore,
} from "../../lib/dayplan";

export function useDayPlan(input: {
  userId: string | undefined;
  workspaceId: string | undefined;
  /** ítems míos de hoy con su status, para el score */
  items: Array<{ id: string; status: "open" | "done" | "archived" }>;
}) {
  const date = localDateKey();
  const [plan, setPlan] = useState<DayPlan | null>(null);

  useEffect(() => {
    if (!input.userId) return;
    const ref = doc(db, DAY_PLANS_COLLECTION, dayPlanId(input.userId, date));
    return onSnapshot(ref, (snap) => setPlan(snap.exists() ? (snap.data() as DayPlan) : null));
  }, [input.userId, date]);

  const itemStatusById = useMemo(() => {
    const map: Record<string, "open" | "done" | "archived"> = {};
    for (const it of input.items) map[it.id] = it.status;
    return map;
  }, [input.items]);

  const score: FocusScore = useMemo(
    () => computeFocusScore({ plan, itemStatusById }),
    [plan, itemStatusById],
  );

  const setKey = useCallback(async (itemId: string | null) => {
    if (!input.userId || !input.workspaceId) return;
    await setKeyItem(input.userId, input.workspaceId, date, itemId);
  }, [input.userId, input.workspaceId, date]);

  const planItem = useCallback(async (itemId: string) => {
    if (!input.userId || !input.workspaceId) return;
    await addPlannedItem(input.userId, input.workspaceId, date, itemId);
  }, [input.userId, input.workspaceId, date]);

  const clearItem = useCallback(async (itemId: string) => {
    if (!input.userId || !input.workspaceId) return;
    await clearPlannedItem(input.userId, input.workspaceId, date, itemId);
  }, [input.userId, input.workspaceId, date]);

  return { date, plan, score, setKey, planItem, clearItem };
}
