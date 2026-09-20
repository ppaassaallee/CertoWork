/**
 * Focus score: weighted completion (Growth 3 · Fires 2 · Extras 1).
 * +10 if key item is doneToday; null if no entries.
 */
import { BUCKET_WEIGHT } from "./buckets";
import type { DayPlan } from "./types";

export function computeFocusScore(
  plan: DayPlan | null,
  keyItemId?: string | null,
): number | null {
  if (!plan?.entries?.length) return null;
  let weightDone = 0;
  let weightAll = 0;
  for (const entry of plan.entries) {
    const w = BUCKET_WEIGHT[entry.bucket] ?? 1;
    weightAll += w;
    if (entry.doneToday) weightDone += w;
  }
  if (weightAll === 0) return null;
  let score = Math.round((100 * weightDone) / weightAll);
  const keyId = keyItemId ?? plan.keyItemId;
  if (keyId) {
    const keyEntry = plan.entries.find((e) => e.itemId === keyId);
    if (keyEntry?.doneToday) score = Math.min(100, score + 10);
  }
  return score;
}
