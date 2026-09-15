import type { FocusScore, FocusScoreInput } from "./types";

/**
 * Focus score rules (deterministic):
 *  - 0 if no plan or nothing planned and no key task.
 *  - +10 for having a key task set.
 *  - +60 when the key task is done.
 *  - remaining 30 points scale with cleared planned items (done or cleared / planned).
 *  - Adding items never raises the score; only done/cleared does.
 */
export function computeFocusScore(input: FocusScoreInput): FocusScore {
  const plan = input.plan;
  const planned = plan ? plan.plannedItemIds.length : 0;
  const keySet = Boolean(plan?.keyItemId);
  const keyDone = keySet ? input.itemStatusById[plan!.keyItemId!] === "done" : false;

  const done = plan
    ? plan.plannedItemIds.filter((id) => input.itemStatusById[id] === "done").length
    : 0;
  const cleared = plan
    ? plan.plannedItemIds.filter(
        (id) => plan.clearedItemIds.includes(id) && input.itemStatusById[id] !== "done",
      ).length
    : 0;
  const remaining = Math.max(0, planned - done - cleared);

  let value = 0;
  if (keySet) value += 10;
  if (keyDone) value += 60;
  if (planned > 0) {
    value += Math.round((30 * (done + cleared)) / planned);
  } else if (keyDone) {
    value += 30; // solo tarea clave, y la hiciste: día completo
  }

  return { value: Math.min(100, value), keySet, keyDone, planned, done, cleared, remaining };
}
