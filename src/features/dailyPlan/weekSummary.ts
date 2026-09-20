import { getPlansInRange } from "./dayPlanService";
import type { DayPlan, DayPlanEntry, PlanBucket } from "./types";
import { BUCKET_ORDER } from "./buckets";

export type WeekDaySummary = {
  dateKey: string;
  planned: number;
  done: number;
  focusScore: number | null;
  closingNote: string | null;
  byBucket: Record<PlanBucket, { planned: number; done: number }>;
};

export async function getWeekSummary(uid: string, weekKeys: string[]) {
  const plans = await getPlansInRange(uid, weekKeys[0], weekKeys[weekKeys.length - 1]);
  const byDate = new Map(plans.map((p: DayPlan) => [p.date, p]));
  const days: WeekDaySummary[] = weekKeys.map((dateKey) =>
    summarizeDay(dateKey, byDate.get(dateKey) || null),
  );
  const totals = days.reduce(
    (acc, d) => ({
      planned: acc.planned + d.planned,
      done: acc.done + d.done,
    }),
    { planned: 0, done: 0 },
  );
  return { days, totals, topProjects: [] as Array<{ projectId: string; doneCount: number }> };
}

function summarizeDay(dateKey: string, plan: DayPlan | null): WeekDaySummary {
  const byBucket = Object.fromEntries(
    BUCKET_ORDER.map((b: PlanBucket) => [b, { planned: 0, done: 0 }]),
  ) as Record<PlanBucket, { planned: number; done: number }>;
  for (const e of plan?.entries || []) {
    byBucket[e.bucket].planned += 1;
    if (e.doneToday) byBucket[e.bucket].done += 1;
  }
  return {
    dateKey,
    planned: plan?.entries.length || 0,
    done: (plan?.entries || []).filter((e: DayPlanEntry) => e.doneToday).length,
    focusScore: plan?.focusScore ?? null,
    closingNote: plan?.closingNote ?? null,
    byBucket,
  };
}
