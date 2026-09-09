import { normalizeTimeSector, type TimeSectorId } from "./operatingModel";
import { localDateKey } from "./workspaceDisplay";

/** Normalize stored due/start values to YYYY-MM-DD in local calendar terms. */
export function dateInputValue(value: any) {
  if (!value) return "";
  if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return localDateKey(value);
  if (value?.toDate) {
    try {
      return localDateKey(value.toDate());
    } catch {
      return "";
    }
  }
  if (typeof value?.seconds === "number") return localDateKey(new Date(value.seconds * 1000));
  return "";
}

export { localDateKey };

export function saturdayNoon(value = new Date()) {
  const target = new Date(value);
  target.setHours(12, 0, 0, 0);
  const daysUntilSaturday = (6 - target.getDay() + 7) % 7;
  target.setDate(target.getDate() + daysUntilSaturday);
  return target;
}

function isExpired(value: any, now: Date) {
  if (!value) return false;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed < now.getTime() : false;
  }
  if (value?.toDate) return value.toDate().getTime() < now.getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000 < now.getTime();
  if (value instanceof Date) return value.getTime() < now.getTime();
  return false;
}

export function dueBucket(value: any, now = new Date()) {
  const date = dateInputValue(value);
  if (!date) return "unscheduled";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T00:00:00`);
  const days = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  const sameMonth = due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth();
  const nextMonth =
    due.getFullYear() === today.getFullYear()
      ? due.getMonth() === today.getMonth() + 1
      : today.getMonth() === 11 && due.getFullYear() === today.getFullYear() + 1 && due.getMonth() === 0;
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "this_week";
  if (days <= 14) return "next_week";
  if (sameMonth) return "this_month";
  if (nextMonth || days <= 60) return "next_month";
  return "later";
}

export function timingMarksForItem(
  item: {
    dueDate?: any;
    targetDate?: any;
    timeSector?: any;
    timeSectorDate?: any;
    timeSectorExpiresAt?: any;
  },
  now = new Date(),
) {
  const today = localDateKey(now);
  const due = dateInputValue(item.dueDate || item.targetDate);
  const sector = normalizeTimeSector(item.timeSector);
  const weekEnd = saturdayNoon(now);
  const weekEndDate = localDateKey(weekEnd);
  const sectorDate = dateInputValue(item.timeSectorDate);
  const sectorAlive = !isExpired(item.timeSectorExpiresAt, now);

  // Explicit due date always wins over a stale Today/Week pin.
  const markedToday = due
    ? due === today
    : sector === "today" && sectorDate === today && sectorAlive;

  const markedWeek = due
    ? due > today && due <= weekEndDate
    : !markedToday && sector === "this_week" && sectorAlive;

  return { today, due, weekEnd, weekEndDate, markedToday, markedWeek, sector };
}

export function dueDateTimingPatch(dueDate: string | null | undefined, now = new Date()) {
  const raw = typeof dueDate === "string" ? dueDate.trim() : "";
  const due = dateInputValue(raw) || (/^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "");
  if (!due) {
    return {
      dueDate: null,
      timeSector: null,
      timeSectorDate: null,
      timeSectorExpiresAt: null,
    };
  }
  const today = localDateKey(now);
  const weekEnd = saturdayNoon(now);
  const weekEndDate = localDateKey(weekEnd);
  if (due === today) {
    return {
      dueDate: due,
      timeSector: "today" as TimeSectorId,
      timeSectorDate: today,
      timeSectorExpiresAt: `${today}T23:59:59`,
    };
  }
  if (due > today && due <= weekEndDate) {
    return {
      dueDate: due,
      timeSector: "this_week" as TimeSectorId,
      timeSectorDate: today,
      timeSectorExpiresAt: weekEnd.toISOString(),
    };
  }
  const bucket = dueBucket(due, now);
  const sector =
    bucket === "unscheduled" || bucket === "overdue"
      ? null
      : (bucket as TimeSectorId);
  return {
    dueDate: due,
    timeSector: sector,
    timeSectorDate: today,
    timeSectorExpiresAt: null,
  };
}

export function todayTimingPatch(now = new Date()) {
  const today = localDateKey(now);
  return {
    dueDate: today,
    timeSector: "today" as TimeSectorId,
    timeSectorDate: today,
    timeSectorExpiresAt: `${today}T23:59:59`,
  };
}

export function weekTimingPatch(now = new Date()) {
  const today = localDateKey(now);
  const weekEnd = saturdayNoon(now);
  return {
    dueDate: localDateKey(weekEnd),
    timeSector: "this_week" as TimeSectorId,
    timeSectorDate: today,
    timeSectorExpiresAt: weekEnd.toISOString(),
  };
}
