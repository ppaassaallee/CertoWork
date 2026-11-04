const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Bad civil date: ${iso}`);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function weekday(iso: string): number {
  return fromIsoDate(iso).getUTCDay();
}

export function dayName(iso: string): string {
  return DAYS[weekday(iso)] ?? "";
}

export function mondayOf(input: Date | string): string {
  const date = typeof input === "string" ? fromIsoDate(input) : new Date(input.getTime());
  const delta = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - delta);
  return toIsoDate(date);
}

export function weekKey(input: Date | string): string {
  return mondayOf(input);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromIsoDate(b).getTime() - fromIsoDate(a).getTime()) / 864e5);
}

export function addDays(iso: string, n: number): string {
  const date = fromIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + n);
  return toIsoDate(date);
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const date = fromIsoDate(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatDayHeading(iso: string): string {
  const date = fromIsoDate(iso);
  return `${DAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Monday–Friday civil dates inside a calendar month. `month` is 1–12. */
export function workingDaysOfMonth(year: number, month: number): string[] {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = 1; d <= last; d++) {
    const date = new Date(Date.UTC(year, month - 1, d, 12, 0, 0));
    const dow = date.getUTCDay();
    if (dow > 0 && dow < 6) days.push(toIsoDate(date));
  }
  return days;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function weekLabel(week: string): string {
  return `Week of ${formatDate(week)} to ${formatDate(addDays(week, 4))}`;
}
