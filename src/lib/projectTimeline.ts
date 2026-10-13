import { dateInputValue } from "./itemTiming";
import { NO_PROJECT_SECTION, orderSections } from "./myWorkSectionOrder";

export type TimelineScale = "day" | "week" | "month" | "quarter";
export type TimelineGrouping = "hierarchy" | "project" | "status" | "none";
export interface TimelineItem {
  id: string;
  title: string;
  kind: string;
  parentId: string;
  projectId: string;
  projectLabel: string;
  status: string;
  startDate?: unknown;
  plannedStartDate?: unknown;
  sprintStartDate?: unknown;
  dueDate?: unknown;
  targetDate?: unknown;
  endDate?: unknown;
  plannedEndDate?: unknown;
  assigneeIds?: string[];
  assignees?: string[];
  assigneeId?: string;
  owner?: string;
  assignee?: string;
}
export interface TimelineEntry extends TimelineItem {
  start: number | null;
  end: number | null;
  depth: number;
  rollup: boolean;
  startOnly: boolean;
  children: string[];
}
export interface TimelineSection {
  id: string;
  label: string;
  entries: TimelineEntry[];
}
const DAY_MS = 86_400_000;

/** Calendar coordinates use whole UTC days, so daylight saving never shifts a bar. */
export function timelineDay(value: unknown): number | null {
  const key = dateInputValue(value);
  if (!key) return null;
  const ms = Date.parse(`${key}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== key) return null;
  return ms / DAY_MS;
}
export function timelineDate(day: number): Date {
  return new Date(day * DAY_MS);
}
export function timelineToday(now = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;
}

export function buildTimelineEntries(items: TimelineItem[]): TimelineEntry[] {
  const entries = items.map((item): TimelineEntry => {
    const start = timelineDay(item.startDate || item.plannedStartDate || item.sprintStartDate);
    const end = timelineDay(item.dueDate || item.targetDate || item.endDate || item.plannedEndDate);
    return { ...item, start: start === null ? end : end === null ? start : Math.min(start, end),
      end: end === null ? start : start === null ? end : Math.max(start, end),
      depth: 0, rollup: false, startOnly: start !== null && end === null, children: [] };
  });
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  // Missing parents, self-links and cross-project links are standalone visually.
  for (const entry of entries) {
    const parent = byId.get(entry.parentId);
    if (!parent || parent.id === entry.id || parent.projectId !== entry.projectId) entry.parentId = "";
  }
  // Break corrupt cycles before traversing. Never drop a record because of a cycle.
  for (const entry of entries) {
    const seen = new Set([entry.id]);
    let current = entry;
    while (current.parentId) {
      if (seen.has(current.parentId)) { entry.parentId = ""; break; }
      seen.add(current.parentId);
      current = byId.get(current.parentId)!;
    }
  }
  for (const entry of entries) byId.get(entry.parentId)?.children.push(entry.id);
  const ordered: TimelineEntry[] = [];
  const visit = (entry: TimelineEntry, depth: number): { start: number | null; end: number | null } => {
    entry.depth = depth;
    ordered.push(entry);
    const children = entry.children.map((id) => byId.get(id)!);
    const childRanges = children.map((child) => visit(child, depth + 1));
    // Undated containers can show their real children's schedule, explicitly as a rollup.
    if (entry.start === null && children.length) {
      const dated = childRanges.filter((child) => child.start !== null && child.end !== null);
      if (dated.length) {
        entry.start = Math.min(...dated.map((child) => child.start!));
        entry.end = Math.max(...dated.map((child) => child.end!));
        entry.rollup = true;
      }
    }
    const starts = [entry.start, ...childRanges.map((child) => child.start)].filter((day): day is number => day !== null);
    const ends = [entry.end, ...childRanges.map((child) => child.end)].filter((day): day is number => day !== null);
    return { start: starts.length ? Math.min(...starts) : null, end: ends.length ? Math.max(...ends) : null };
  };
  for (const entry of entries.filter((item) => !item.parentId)) visit(entry, 0);
  return ordered;
}

export function timelineSections(entries: TimelineEntry[], grouping: TimelineGrouping, standaloneLabel: string, sectionOrder: string[] = []): TimelineSection[] {
  if (grouping === "none") return [{ id: "all", label: "", entries }];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const sections = new Map<string, TimelineSection>();
  for (const entry of entries) {
    let id: string;
    let label: string;
    if (grouping === "project") {
      id = entry.projectId || NO_PROJECT_SECTION;
      label = entry.projectLabel;
    } else if (grouping === "status") {
      id = entry.status;
      label = entry.status;
    } else {
      let root = entry;
      while (root.parentId && byId.has(root.parentId)) root = byId.get(root.parentId)!;
      id = root.children.length ? root.id : "standalone";
      label = root.children.length ? root.title : standaloneLabel;
    }
    const group = sections.get(id);
    if (group) group.entries.push(entry);
    else sections.set(id, { id, label, entries: [entry] });
  }
  return grouping === "project" ? orderSections([...sections.values()], sectionOrder) : [...sections.values()];
}

export function timelineRange(entries: TimelineEntry[], today: number) {
  const dated = entries.filter((entry) => entry.start !== null && entry.end !== null);
  const first = Math.min(today, ...dated.map((entry) => entry.start!)) - 7;
  const weekday = (timelineDate(first).getUTCDay() + 6) % 7;
  const start = first - weekday;
  const end = Math.max(start + 56, today + 28, ...dated.map((entry) => entry.end! + 14));
  return { start, end, days: end - start + 1 };
}

export function timelineMonths(start: number, end: number) {
  const segments: Array<{ start: number; days: number; date: Date }> = [];
  let cursor = start;
  while (cursor <= end) {
    const date = timelineDate(cursor);
    const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY_MS;
    const limit = Math.min(next, end + 1);
    segments.push({ start: cursor, days: limit - cursor, date });
    cursor = limit;
  }
  return segments;
}

export function timelinePosition(entry: TimelineEntry, start: number, dayWidth: number) {
  if (entry.start === null || entry.end === null) return null;
  return { left: (entry.start - start) * dayWidth, width: (entry.end - entry.start + 1) * dayWidth };
}
