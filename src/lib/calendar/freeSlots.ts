export type FreeSlotEvent = { start: string; end: string };

export type FreeSlotOpts = {
  from: string;
  to: string;
  minMinutes: number;
  workHours: { start: number; end: number };
  timezone: string;
};

function parseInstant(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function dayKeyInTz(ms: number, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

function workWindowMs(dayIso: string, hour: number, timezone: string) {
  // Interpret workHours in the given timezone via offset approximation.
  const probe = new Date(`${dayIso}T12:00:00Z`);
  let offsetMin = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    }).formatToParts(probe);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
    const m = tz.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
    if (m) offsetMin = Number(m[1]) * 60 + Number(m[2] || 0) * Math.sign(Number(m[1]) || 1);
  } catch {
    offsetMin = 0;
  }
  const utcMs = Date.parse(`${dayIso}T00:00:00Z`) + hour * 60 * 60 * 1000 - offsetMin * 60 * 1000;
  return utcMs;
}

function mergeIntervals(intervals: Array<[number, number]>) {
  if (!intervals.length) return [] as Array<[number, number]>;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    const last = out[out.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}

/**
 * Pure free-slot finder: within workHours each day between from/to,
 * subtract occupied intervals (merged), return gaps ≥ minMinutes.
 */
export function findFreeSlots(
  events: FreeSlotEvent[],
  opts: FreeSlotOpts,
): Array<{ start: string; end: string }> {
  const fromMs = parseInstant(opts.from);
  const toMs = parseInstant(opts.to);
  if (fromMs == null || toMs == null || toMs <= fromMs) return [];
  const minMs = Math.max(1, opts.minMinutes) * 60_000;
  const busy = mergeIntervals(
    events
      .map((event) => {
        const start = parseInstant(event.start);
        const end = parseInstant(event.end);
        if (start == null || end == null || end <= start) return null;
        return [Math.max(start, fromMs), Math.min(end, toMs)] as [number, number];
      })
      .filter((row): row is [number, number] => row != null && row[1] > row[0]),
  );

  const slots: Array<{ start: string; end: string }> = [];
  const dayStart = new Date(fromMs);
  dayStart.setUTCHours(0, 0, 0, 0);
  for (let cursor = dayStart.getTime(); cursor < toMs; cursor += 86_400_000) {
    const dayIso = dayKeyInTz(Math.max(cursor, fromMs), opts.timezone);
    const winStart = Math.max(fromMs, workWindowMs(dayIso, opts.workHours.start, opts.timezone));
    const winEnd = Math.min(toMs, workWindowMs(dayIso, opts.workHours.end, opts.timezone));
    if (winEnd <= winStart) continue;
    const dayBusy = busy
      .map(([s, e]) => [Math.max(s, winStart), Math.min(e, winEnd)] as [number, number])
      .filter(([s, e]) => e > s);
    let pointer = winStart;
    for (const [s, e] of dayBusy) {
      if (s - pointer >= minMs) {
        slots.push({ start: new Date(pointer).toISOString(), end: new Date(s).toISOString() });
      }
      pointer = Math.max(pointer, e);
    }
    if (winEnd - pointer >= minMs) {
      slots.push({ start: new Date(pointer).toISOString(), end: new Date(winEnd).toISOString() });
    }
  }
  return slots;
}
