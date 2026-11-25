export interface TimeEntry {
  id: string;
  workspaceId: string;
  userId: string;
  sheetId: string;
  projectId: string;
  itemId: string;
  description: string;
  date: string;
  minutes: number;
  billable: boolean;
}
export interface TimeSheet {
  id: string;
  name: string;
}
export type TimeTarget = {
  id: string;
  title?: string;
  name?: string;
  projectId?: string;
  workItemType?: string;
};
export function civilDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return civilDate(value);
}
export function weekDates(date: string): string[] {
  const day = new Date(`${date}T12:00:00`).getDay();
  const monday = shiftDate(date, -(day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}
/** Accept H:MM or decimal hours, never ambiguous bare minute values. */
export function parseDuration(value: string): number | null {
  const text = value.trim().replace(",", ".");
  let minutes: number;
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [h, m] = text.split(":").map(Number);
    if (m > 59) return null;
    minutes = h * 60 + m;
  } else if (/^\d{1,2}(\.\d{1,3})?$/.test(text)) minutes = Math.round(Number(text) * 60);
  else return null;
  return minutes > 0 && minutes <= 1440 ? minutes : null;
}
export function durationLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parsePastedTime(text: string): {
  rows: { date: string; description: string; minutes: number }[];
  invalidLines: number[];
} {
  const rows: { date: string; description: string; minutes: number }[] = [];
  const invalidLines: number[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const [date = "", description = "", duration = "", ...extra] = line.split("\t").map((value) => value.trim());
    const minutes = parseDuration(duration);
    if (
      extra.length ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      civilDate(new Date(`${date}T12:00:00`)) !== date ||
      !description ||
      description.length > 2000 ||
      !minutes ||
      rows.length >= 50
    )
      invalidLines.push(index + 1);
    else rows.push({ date, description, minutes });
  });
  return { rows, invalidLines };
}

/** Pure aggregates over the already loaded, authorized view; no extra reads. */
export function analyzeTime(entries: TimeEntry[], dates: string[]) {
  const daily = dates.map((date) => ({
    date,
    minutes: entries.filter((row) => row.date === date).reduce((sum, row) => sum + row.minutes, 0),
  }));
  const totals = new Map<string, number>();
  entries.forEach((row) => totals.set(row.projectId, (totals.get(row.projectId) || 0) + row.minutes));
  return {
    daily,
    projects: [...totals.entries()]
      .map(([projectId, minutes]) => ({ projectId, minutes }))
      .sort((a, b) => b.minutes - a.minutes),
  };
}
export function validEntry(entry: Omit<TimeEntry, "id">): boolean {
  return (
    Boolean(entry.workspaceId && entry.userId && entry.sheetId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    civilDate(new Date(`${entry.date}T12:00:00`)) === entry.date &&
    Number.isInteger(entry.minutes) &&
    entry.minutes > 0 &&
    entry.minutes <= 1440 &&
    entry.description.trim().length > 0 &&
    entry.description.length <= 2000
  );
}
export function csvExport(entries: TimeEntry[], names?: (entry: TimeEntry) => string[]): string {
  // Defend spreadsheet applications against formula injection, including leading whitespace.
  const cell = (value: string | number | boolean) => {
    let text = String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    "Date,Description,Project,Item,Sheet,Project ID,Item ID,Sheet ID,Minutes,Billable",
    ...entries.map((row) =>
      [
        row.date,
        row.description,
        ...(names?.(row) || ["", "", ""]),
        row.projectId,
        row.itemId,
        row.sheetId,
        row.minutes,
        row.billable,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
