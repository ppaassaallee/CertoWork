import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { addDays } from "./dateKeys";
import {
  addEntry,
  getPlansInRange,
  moveEntry,
  removeEntry,
  setDoneToday as setDoneTodayService,
  subscribeDayPlan,
} from "./dayPlanService";
import {
  isItemDoneStatus,
  type DayPlan,
  type DayPlanEntry,
  type PlanBucket,
  type PlanItem,
} from "./types";

export type JoinedEntry = DayPlanEntry & { item: PlanItem | null };

export type LeftoverEntry = DayPlanEntry & { item: PlanItem; fromDateKey: string };

export function useDayPlan(
  dateKey: string,
  items: PlanItem[],
  options?: {
    onError?: (message: string) => void;
  },
) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [leftovers, setLeftovers] = useState<LeftoverEntry[]>([]);
  const [optimistic, setOptimistic] = useState<DayPlan | null | undefined>(undefined);
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;

  const itemsById = useMemo(() => {
    const map = new Map<string, PlanItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  useEffect(() => {
    if (!uid) {
      setPlan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeDayPlan(uid, dateKey, (next) => {
      setPlan(next);
      setOptimistic(undefined);
      setLoading(false);
    });
  }, [uid, dateKey]);

  const effectivePlan = optimistic !== undefined ? optimistic : plan;

  useEffect(() => {
    if (!uid) {
      setLeftovers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const prior = await getPlansInRange(uid, addDays(dateKey, -7), addDays(dateKey, -1));
        if (cancelled) return;
        const todayIds = new Set((effectivePlan?.entries || []).map((e) => e.itemId));
        const mostRecent = [...prior].reverse().find((p) => p.entries?.length);
        if (!mostRecent) {
          setLeftovers([]);
          return;
        }
        const next: LeftoverEntry[] = [];
        for (const entry of mostRecent.entries) {
          if (entry.doneToday) continue;
          if (todayIds.has(entry.itemId)) continue;
          const item = itemsById.get(entry.itemId);
          if (!item) continue;
          if (isItemDoneStatus(item.status)) continue;
          next.push({ ...entry, item, fromDateKey: mostRecent.date });
        }
        setLeftovers(next);
      } catch (err) {
        if (!cancelled) {
          onErrorRef.current?.(
            err instanceof Error ? err.message : "Could not load leftovers",
          );
          setLeftovers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, dateKey, effectivePlan, itemsById]);

  const entriesByBucket = useMemo(() => {
    const empty: Record<PlanBucket, JoinedEntry[]> = {
      fire: [],
      growth: [],
      extra: [],
    };
    for (const entry of effectivePlan?.entries || []) {
      const bucket = (entry.bucket in empty ? entry.bucket : "extra") as PlanBucket;
      empty[bucket].push({
        ...entry,
        item: itemsById.get(entry.itemId) || null,
      });
    }
    for (const bucket of Object.keys(empty) as PlanBucket[]) {
      empty[bucket].sort((a, b) => {
        if (a.doneToday !== b.doneToday) return a.doneToday ? 1 : -1;
        return a.order - b.order;
      });
    }
    return empty;
  }, [effectivePlan, itemsById]);

  const add = useCallback(
    async (itemId: string, bucket: PlanBucket) => {
      if (!uid) return;
      await addEntry(uid, dateKey, itemId, bucket);
    },
    [uid, dateKey],
  );

  const move = useCallback(
    async (itemId: string, toBucket: PlanBucket, toIndex: number) => {
      if (!uid || !plan) return;
      const prev = plan;
      const without = plan.entries.filter((e) => e.itemId !== itemId);
      const moving = plan.entries.find((e) => e.itemId === itemId);
      if (!moving) return;
      const target = without
        .filter((e) => e.bucket === toBucket)
        .sort((a, b) => a.order - b.order);
      const clamped = Math.max(0, Math.min(toIndex, target.length));
      const others = without.filter((e) => e.bucket !== toBucket);
      const nextBucket = [...target];
      nextBucket.splice(clamped, 0, { ...moving, bucket: toBucket });
      const renumbered: DayPlanEntry[] = [];
      for (const bucket of ["fire", "growth", "extra"] as PlanBucket[]) {
        const list = bucket === toBucket ? nextBucket : others.filter((e) => e.bucket === bucket);
        list.forEach((e, order) => renumbered.push({ ...e, bucket, order }));
      }
      setOptimistic({ ...plan, entries: renumbered });
      try {
        await moveEntry(uid, dateKey, itemId, toBucket, toIndex);
      } catch (err) {
        setOptimistic(prev);
        options?.onError?.(err instanceof Error ? err.message : "Move failed");
      }
    },
    [uid, dateKey, plan, options],
  );

  const remove = useCallback(
    async (itemId: string) => {
      if (!uid) return;
      await removeEntry(uid, dateKey, itemId);
    },
    [uid, dateKey],
  );

  const setDoneToday = useCallback(
    async (itemId: string, done: boolean) => {
      if (!uid || !plan) return;
      const prev = plan;
      setOptimistic({
        ...plan,
        entries: plan.entries.map((e) =>
          e.itemId === itemId ? { ...e, doneToday: done } : e,
        ),
      });
      try {
        await setDoneTodayService(uid, dateKey, itemId, done);
      } catch (err) {
        setOptimistic(prev);
        options?.onError?.(err instanceof Error ? err.message : "Update failed");
      }
    },
    [uid, dateKey, plan, options],
  );

  return {
    plan: effectivePlan,
    loading,
    entriesByBucket,
    leftovers,
    actions: { add, move, remove, setDoneToday },
  };
}
