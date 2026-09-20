import { addDays, getTodayKey } from "../dateKeys";
import { isItemDoneStatus, type PlanItem } from "../types";
import type { CalEvent } from "../calendar/types";
import type { LeftoverEntry } from "../useDayPlan";

export type CandidateSignals = {
  overdue: boolean;
  dueToday: boolean;
  dueThisWeek: boolean;
  semaforoRed: boolean;
  semaforoYellow: boolean;
  isLeftover: boolean;
  leftoverDays: number;
  type: string;
  hasExternalStakeholder: boolean;
  projectMilestoneSoon: boolean;
};

export type Candidate = { item: PlanItem; signals: CandidateSignals };

function dueDateOf(item: PlanItem): string | null {
  const raw = item.dueDate || item.targetDate || null;
  return raw ? String(raw).slice(0, 10) : null;
}

export function collectCandidates(
  items: PlanItem[],
  leftovers: LeftoverEntry[],
  _events: CalEvent[],
  dateKey: string,
  plannedIds: Set<string>,
): Candidate[] {
  void _events;
  const today = dateKey || getTodayKey();
  const weekEnd = addDays(today, 7);
  const leftoverById = new Map(leftovers.map((l) => [l.itemId, l]));
  const out: Candidate[] = [];
  for (const item of items) {
    if (plannedIds.has(item.id)) continue;
    if (isItemDoneStatus(item.status)) continue;
    const due = dueDateOf(item);
    const leftover = leftoverById.get(item.id);
    const leftoverDays = leftover
      ? Math.max(0, Math.round((Date.parse(today) - Date.parse(leftover.fromDateKey)) / 86400000))
      : 0;
    const type = String(item.workItemType || item.type || item.itemType || "").toLowerCase();
    const priority = String(item.priority || "").toUpperCase();
    out.push({
      item,
      signals: {
        overdue: Boolean(due && due < today),
        dueToday: due === today,
        dueThisWeek: Boolean(due && due >= today && due <= weekEnd),
        semaforoRed: priority === "P1" || priority === "1",
        semaforoYellow: priority === "P2" || priority === "2",
        isLeftover: Boolean(leftover),
        leftoverDays,
        type,
        hasExternalStakeholder: false,
        projectMilestoneSoon: false,
      },
    });
  }
  return out;
}
