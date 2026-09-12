/** Next-run helpers for Certo Rutinas schedules (Phase 2). */

function parseCronParts(cron: string): {
  minute: number;
  hour: number;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
} | null {
  const parts = String(cron || "").trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (!Number.isFinite(minute) || !Number.isFinite(hour)) return null;
  return {
    minute,
    hour,
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

function dayAllowed(dayOfWeek: string, jsDay: number): boolean {
  if (dayOfWeek === "*") return true;
  if (dayOfWeek.includes("-")) {
    const [from, to] = dayOfWeek.split("-").map(Number);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    return jsDay >= from && jsDay <= to;
  }
  if (dayOfWeek.includes(",")) {
    return dayOfWeek.split(",").map(Number).includes(jsDay);
  }
  return Number(dayOfWeek) === jsDay;
}

function dayOfMonthAllowed(expr: string, date: Date): boolean {
  if (expr === "*") return true;
  if (expr.startsWith("*/")) {
    const step = Number(expr.slice(2));
    if (!Number.isFinite(step) || step < 1) return false;
    // Approximate every-N-days from Unix epoch day count.
    const dayIndex = Math.floor(date.getTime() / 86_400_000);
    return dayIndex % step === 0;
  }
  return Number(expr) === date.getUTCDate();
}

/**
 * Compute the next Date (UTC instant) for a 5-field cron in a given IANA timezone.
 * Uses a forward scan (max 400 days) — fine for product schedules.
 */
export function computeNextRunAt(
  cron: string,
  timezone: string,
  from: Date = new Date(),
): Date | null {
  const parts = parseCronParts(cron);
  if (!parts) return null;
  const tz = timezone || "UTC";
  const start = new Date(from.getTime() + 60_000);

  for (let offset = 0; offset < 400 * 24 * 60; offset += 1) {
    const candidate = new Date(start.getTime() + offset * 60_000);
    const local = localParts(candidate, tz);
    if (local.minute !== parts.minute || local.hour !== parts.hour) continue;
    if (!dayAllowed(parts.dayOfWeek, local.weekday)) continue;
    if (!dayOfMonthAllowed(parts.dayOfMonth, candidate)) continue;
    return candidate;
  }
  return null;
}

function localParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    weekday: weekdayMap[bag.weekday] ?? 0,
  };
}

export function relativeNextRunLabel(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  const diffMs = at.getTime() - now.getTime();
  if (diffMs < 0) return "vencida";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `en ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `en ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "mañana";
  return `en ${days} d`;
}

export function routineStatusTone(status: string): "green" | "amber" | "red" | "gray" {
  if (status === "active") return "green";
  if (status === "draft" || status === "paused") return "gray";
  if (status === "failing") return "red";
  return "amber";
}
