/** Local calendar day helpers — never use toISOString().slice(0,10) for display days. */

export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Days an event occupies in local time. All-day: start inclusive, end exclusive (Google). */
export function eventDayKeys(ev: { start: string; end: string; allDay?: boolean }): string[] {
  if (ev.allDay) {
    const keys: string[] = [];
    const cur = new Date(`${ev.start}T00:00:00`);
    const end = new Date(`${ev.end}T00:00:00`);
    while (cur < end && keys.length < 31) {
      keys.push(localDayKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return keys.length ? keys : [ev.start];
  }
  return [localDayKey(new Date(ev.start))];
}

export function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function eventsForLocalDay<T extends { start: string; end: string; allDay?: boolean }>(
  events: T[],
  day: Date,
): T[] {
  const key = localDayKey(day);
  return events.filter((event) => eventDayKeys(event).includes(key));
}
