import { addDays as dfAddDays, format, parseISO, startOfWeek } from "date-fns";

/**
 * Date keys are always browser-local YYYY-MM-DD.
 * Dev-only override: localStorage.dailyPlanDateOverride = 'YYYY-MM-DD'
 */
export function getDateKey(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}

export function getTodayKey(): string {
  if (import.meta.env.DEV && typeof localStorage !== "undefined") {
    try {
      const override = localStorage.getItem("dailyPlanDateOverride");
      if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
    } catch {
      /* ignore */
    }
  }
  return getDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  // noon local to avoid DST edge flips
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(key: string, n: number): string {
  return getDateKey(dfAddDays(parseDateKey(key), n));
}

/** Monday → Sunday week containing anchorKey. */
export function getWeekKeys(anchorKey: string): string[] {
  const monday = startOfWeek(parseDateKey(anchorKey), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => getDateKey(dfAddDays(monday, i)));
}

export function labelForKey(key: string, todayKey: string): string {
  if (key === todayKey) return "Today";
  if (key === addDays(todayKey, -1)) return "Yesterday";
  try {
    return format(parseISO(key), "EEEE");
  } catch {
    return key;
  }
}

/** Header for leftovers tray: "From yesterday" / "From Friday". */
export function leftoversHeader(fromDateKey: string, todayKey: string): string {
  if (fromDateKey === addDays(todayKey, -1)) return "From yesterday";
  const day = labelForKey(fromDateKey, todayKey);
  return `From ${day}`;
}
