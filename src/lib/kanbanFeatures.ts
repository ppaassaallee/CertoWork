import { kanbanColumnForStatus, type KanbanColumnKey } from "./kanbanBoard";

export type KanbanSwimlaneBy = "none" | "assignee" | "priority" | "project";

export type KanbanChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type KanbanStatusEvent = {
  status: string;
  column?: string;
  at: string;
};

export type KanbanComment = {
  id: string;
  at: string;
  author: string;
  text: string;
};

export type KanbanAutomationRule = {
  id: string;
  whenColumn: string;
  setPriority?: string;
  setAssignee?: string;
};

export const KANBAN_SWIMLANES: Array<{ key: KanbanSwimlaneBy; label: string }> = [
  { key: "none", label: "No swimlanes" },
  { key: "assignee", label: "By assignee" },
  { key: "priority", label: "By priority" },
  { key: "project", label: "By project" },
];

const SWIMLANE_KEYS: KanbanSwimlaneBy[] = ["none", "assignee", "priority", "project"];

export function asKanbanSwimlane(value: unknown, fallback: KanbanSwimlaneBy = "none"): KanbanSwimlaneBy {
  return SWIMLANE_KEYS.includes(value as KanbanSwimlaneBy) ? (value as KanbanSwimlaneBy) : fallback;
}

export function asWipLimits(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const numeric = Number(raw);
    if (key && Number.isFinite(numeric) && numeric >= 0) next[key] = Math.round(numeric);
  }
  return next;
}

export function asColumnLabels(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const label = String(raw || "").trim();
    if (key && label) next[key] = label;
  }
  return next;
}

export function asAutomations(value: unknown): KanbanAutomationRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const rule = raw as KanbanAutomationRule;
      const whenColumn = String(rule.whenColumn || "").trim();
      if (!whenColumn) return null;
      return {
        id: String(rule.id || `rule-${whenColumn}`),
        whenColumn,
        setPriority: rule.setPriority ? String(rule.setPriority) : undefined,
        setAssignee: rule.setAssignee ? String(rule.setAssignee) : undefined,
      };
    })
    .filter(Boolean) as KanbanAutomationRule[];
}

export function encodeKanbanDroppable(columnKey: string, swimlaneKey = "") {
  return swimlaneKey ? `${columnKey}::${encodeURIComponent(swimlaneKey)}` : columnKey;
}

export function parseKanbanDroppable(droppableId: string): { columnKey: string; swimlaneKey: string } {
  const value = String(droppableId || "");
  const idx = value.indexOf("::");
  if (idx === -1) return { columnKey: value, swimlaneKey: "" };
  try {
    return { columnKey: value.slice(0, idx), swimlaneKey: decodeURIComponent(value.slice(idx + 2)) };
  } catch {
    return { columnKey: value.slice(0, idx), swimlaneKey: value.slice(idx + 2) };
  }
}

function projectTitle(project: any) {
  return String(project?.title || project?.name || "Untitled project");
}

export function swimlaneKeyFor(
  item: any,
  by: KanbanSwimlaneBy,
  projects: any[] = [],
): string {
  if (by === "assignee") {
    const names = Array.isArray(item?.assignees)
      ? item.assignees.map((name: unknown) => String(name || "").trim()).filter(Boolean)
      : [];
    const fallback = String(item?.owner || item?.assignee || "").trim();
    return names[0] || fallback || "Unassigned";
  }
  if (by === "priority") {
    const value = String(item?.priority ?? "").trim();
    if (value === "1" || value === "P1") return "1";
    if (value === "2" || value === "P2") return "2";
    if (value === "3" || value === "P3") return "3";
    return "none";
  }
  if (by === "project") {
    if (!item?.projectId) return "none";
    const project = projects.find((candidate) => candidate.id === item.projectId);
    return project ? projectTitle(project) : String(item.projectId);
  }
  return "all";
}

export function swimlaneLabel(key: string, by: KanbanSwimlaneBy) {
  if (by === "priority") {
    if (key === "1") return "P1";
    if (key === "2") return "P2";
    if (key === "3") return "P3";
    return "No priority";
  }
  if (by === "project" && (key === "none" || !key)) return "No project";
  if (by === "assignee" && (key === "Unassigned" || !key)) return "Unassigned";
  return key || "All work";
}

export function uniqueSwimlanes(items: any[], by: KanbanSwimlaneBy, projects: any[] = []) {
  if (by === "none") return [{ key: "", label: "All work" }];
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = swimlaneKeyFor(item, by, projects);
    if (!seen.has(key)) seen.set(key, swimlaneLabel(key, by));
  }
  if (by === "assignee" && !seen.has("Unassigned")) seen.set("Unassigned", "Unassigned");
  if (by === "project" && !seen.has("none")) seen.set("none", "No project");
  if (by === "priority") {
    return ["1", "2", "3", "none"]
      .filter((key) => seen.has(key) || key === "none")
      .map((key) => ({ key, label: swimlaneLabel(key, by) }));
  }
  return [...seen.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function checklistItems(item: any): KanbanChecklistItem[] {
  if (!Array.isArray(item?.checklist)) return [];
  return item.checklist
    .map((entry: any, index: number) => ({
      id: String(entry?.id || `check-${index}`),
      text: String(entry?.text || "").trim(),
      done: Boolean(entry?.done),
    }))
    .filter((entry: KanbanChecklistItem) => entry.text);
}

export function checklistProgress(items: KanbanChecklistItem[]) {
  const total = items.length;
  const done = items.filter((entry) => entry.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function subtaskProgress(item: any, allTasks: any[]) {
  const parentId = String(item?.id || "");
  const children = (allTasks || []).filter((candidate) => String(candidate?.parentId || "") === parentId);
  const done = children.filter((candidate) => {
    const status = String(candidate?.status || "").toLowerCase();
    return status === "done" || status === "completed" || status === "cancelled";
  }).length;
  return { done, total: children.length, percent: children.length ? Math.round((done / children.length) * 100) : 0 };
}

export function estimateLabel(item: any) {
  const points = Number(item?.storyPoints);
  const hours = Number(item?.estimateHours);
  const parts: string[] = [];
  if (Number.isFinite(points) && points > 0) parts.push(`${points} pts`);
  if (Number.isFinite(hours) && hours > 0) parts.push(`${hours}h`);
  return parts.join(" · ");
}

export function loggedHoursValue(item: any) {
  const value = Number(item?.loggedHours);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function isWipOver(count: number, limit?: number | null) {
  return Number(limit) > 0 && count > Number(limit);
}

export function isWipAtCapacity(count: number, limit?: number | null) {
  return Number(limit) > 0 && count >= Number(limit);
}

export function wipTone(count: number, limit?: number | null): "ok" | "limit" | "over" {
  if (!(Number(limit) > 0)) return "ok";
  if (count > Number(limit)) return "over";
  if (count >= Number(limit)) return "limit";
  return "ok";
}

export function canAcceptWipDrop(
  sourceColumn: string,
  destColumn: string,
  destCount: number,
  limit?: number | null,
) {
  if (!destColumn || destColumn === "calendar" || sourceColumn === destColumn) return true;
  return !isWipAtCapacity(destCount, limit);
}

export function wipCaption(count: number, limit?: number | null) {
  return Number(limit) > 0 ? `${count}/${limit}` : String(count);
}

export function nowIso(at = new Date()) {
  return at.toISOString();
}

export function appendStatusHistory(
  item: any,
  nextStatus: string,
  column: string,
  at = nowIso(),
): KanbanStatusEvent[] {
  const previous = Array.isArray(item?.statusHistory) ? item.statusHistory : [];
  const next: KanbanStatusEvent = { status: nextStatus, column, at };
  const last = previous[previous.length - 1];
  if (last && last.status === nextStatus && last.column === column) return previous;
  return [...previous.slice(-40), next];
}

export function applyKanbanAutomations(
  item: any,
  columnKey: string,
  rules: KanbanAutomationRule[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const rule of rules) {
    if (rule.whenColumn !== columnKey) continue;
    if (rule.setPriority) patch.priority = rule.setPriority === "none" ? null : rule.setPriority;
    if (rule.setAssignee) {
      patch.assignee = rule.setAssignee;
      patch.owner = rule.setAssignee;
      const names = Array.isArray(item?.assignees) ? [...item.assignees] : [];
      if (!names.includes(rule.setAssignee)) patch.assignees = [rule.setAssignee, ...names];
    }
  }
  return patch;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    const next = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(next.getTime()) ? null : next;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function cycleTimeMs(item: any) {
  const completed = toDate(item?.completedAt);
  if (!completed) return null;
  const history = Array.isArray(item?.statusHistory) ? item.statusHistory : [];
  const startedEvent = history.find((entry: KanbanStatusEvent) => {
    const column = entry.column || kanbanColumnForStatus(entry.status);
    return column === "doing" || entry.status === "in_progress" || entry.status === "in_review";
  });
  const started = toDate(startedEvent?.at) || toDate(item?.startDate) || toDate(item?.createdAt);
  if (!started || completed.getTime() < started.getTime()) return null;
  return completed.getTime() - started.getTime();
}

export function leadTimeMs(item: any) {
  const completed = toDate(item?.completedAt);
  const created = toDate(item?.createdAt);
  if (!completed || !created || completed.getTime() < created.getTime()) return null;
  return completed.getTime() - created.getTime();
}

export function formatDuration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const hours = ms / 3_600_000;
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  const days = hours / 24;
  return `${days >= 10 ? Math.round(days) : days.toFixed(1)}d`;
}

export function formatDurationLong(ms: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const hours = ms / 3_600_000;
  if (hours < 24) return `${Math.max(1, Math.round(hours))} hours`;
  const days = hours / 24;
  const value = days >= 10 ? String(Math.round(days)) : days.toFixed(1);
  return `${value} days`;
}

export function averageDuration(values: Array<number | null>) {
  const present = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!present.length) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function createdAt(item: any) {
  return toDate(item?.createdAt) || toDate(item?.updatedAt);
}

function columnOnDay(item: any, dayEnd: Date): KanbanColumnKey | null {
  const created = createdAt(item);
  if (created && created.getTime() > dayEnd.getTime()) return null;
  const history = Array.isArray(item?.statusHistory) ? [...item.statusHistory] : [];
  const atOrBefore = history
    .filter((entry: KanbanStatusEvent) => {
      const at = toDate(entry.at);
      return at && at.getTime() <= dayEnd.getTime();
    })
    .sort((left: KanbanStatusEvent, right: KanbanStatusEvent) => String(left.at).localeCompare(String(right.at)));
  if (atOrBefore.length) {
    const last = atOrBefore[atOrBefore.length - 1];
    return (last.column as KanbanColumnKey) || kanbanColumnForStatus(last.status);
  }
  const completed = toDate(item?.completedAt);
  if (completed && completed.getTime() <= dayEnd.getTime()) return "done";
  const started = toDate(item?.startDate);
  const current = String(item?.status || "").toLowerCase();
  if (current === "done" || current === "cancelled") {
    if (started && started.getTime() <= dayEnd.getTime()) return "doing";
    return "backlog";
  }
  if (started && started.getTime() <= dayEnd.getTime()) {
    if (current === "blocked") return "blocked";
    return "doing";
  }
  if (current === "blocked") return "blocked";
  if (current === "in_progress" || current === "in_review") return "doing";
  return kanbanColumnForStatus(current);
}

export type CumulativeFlowPoint = {
  date: string;
  backlog: number;
  doing: number;
  blocked: number;
  done: number;
};

export function cumulativeFlowSeries(items: any[], days = 14, now = new Date()): CumulativeFlowPoint[] {
  const points: CumulativeFlowPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setHours(23, 59, 59, 999);
    day.setDate(day.getDate() - offset);
    const point: CumulativeFlowPoint = {
      date: day.toISOString().slice(0, 10),
      backlog: 0,
      doing: 0,
      blocked: 0,
      done: 0,
    };
    for (const item of items) {
      const column = columnOnDay(item, day);
      if (!column) continue;
      point[column] += 1;
    }
    points.push(point);
  }
  return points;
}

export function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calendarWeekDays(anchor = new Date()) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const weekday = start.getDay();
  start.setDate(start.getDate() - ((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: dateKey(date),
      label: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      date,
    };
  });
}

export function itemDueKey(item: any) {
  const raw = item?.dueDate || item?.targetDate || item?.occurrenceDate;
  if (!raw) return "";
  const parsed = toDate(raw);
  return parsed ? dateKey(parsed) : String(raw).slice(0, 10);
}

export function extractUrls(text: string) {
  return [...String(text || "").matchAll(/https?:\/\/[^\s)]+/g)].map((match) => match[0]);
}

export function mentionNames(text: string) {
  return [...String(text || "").matchAll(/@([A-Za-z][\w-]*)/g)].map((match) => match[1]);
}

export function newChecklistItem(text: string, existing: KanbanChecklistItem[] = []): KanbanChecklistItem {
  return {
    id: `check-${Date.now()}-${existing.length}`,
    text: text.trim(),
    done: false,
  };
}

export function swimlaneMovePatch(
  by: KanbanSwimlaneBy,
  swimlaneKey: string,
  projects: any[] = [],
): Record<string, unknown> {
  if (!swimlaneKey || by === "none") return {};
  if (by === "assignee") {
    if (swimlaneKey === "Unassigned") {
      return { assignee: "", owner: "", assignees: [], assigneeIds: [] };
    }
    return { assignee: swimlaneKey, owner: swimlaneKey, assignees: [swimlaneKey] };
  }
  if (by === "priority") {
    return { priority: swimlaneKey === "none" ? null : swimlaneKey };
  }
  if (by === "project") {
    if (swimlaneKey === "none") return { projectId: null };
    const project = projects.find((candidate) => projectTitle(candidate) === swimlaneKey);
    return project ? { projectId: project.id } : {};
  }
  return {};
}

export type KanbanActivityEntry = {
  id: string;
  at: string;
  kind: "system" | "comment";
  text: string;
  author?: string;
};

export function activityThread(item: any): KanbanActivityEntry[] {
  const history = Array.isArray(item?.statusHistory) ? item.statusHistory : [];
  const comments = Array.isArray(item?.comments) ? item.comments : [];
  const events: KanbanActivityEntry[] = [
    ...history.map((entry: KanbanStatusEvent, index: number) => ({
      id: `sys-${entry.at}-${index}`,
      at: String(entry.at || ""),
      kind: "system" as const,
      text: `Card moved to ${entry.column || entry.status}`,
    })),
    ...comments.map((entry: KanbanComment) => ({
      id: String(entry.id || entry.at),
      at: String(entry.at || ""),
      kind: "comment" as const,
      text: String(entry.text || ""),
      author: entry.author,
    })),
  ];
  return events.sort((left, right) => left.at.localeCompare(right.at));
}

export function stackedAreaLayers(series: CumulativeFlowPoint[], width = 320, height = 120) {
  const max = Math.max(1, ...series.map((point) => point.backlog + point.doing + point.blocked + point.done));
  const last = Math.max(1, series.length - 1);
  const xAt = (index: number) => (index / last) * width;
  const yAt = (value: number) => height - (value / max) * height;
  const band = (lower: number[], upper: number[]) => {
    const top = upper.map((value, index) => `${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`).join(" ");
    const bottom = [...lower].reverse().map((_, index) => {
      const idx = lower.length - 1 - index;
      return `${xAt(idx).toFixed(1)},${yAt(lower[idx]).toFixed(1)}`;
    }).join(" ");
    return `${top} ${bottom}`;
  };
  const zeros = series.map(() => 0);
  const done = series.map((point) => point.done);
  const blocked = series.map((point, index) => done[index] + point.blocked);
  const doing = series.map((point, index) => blocked[index] + point.doing);
  const backlog = series.map((point, index) => doing[index] + point.backlog);
  return {
    width,
    height,
    done: band(zeros, done),
    blocked: band(done, blocked),
    doing: band(blocked, doing),
    backlog: band(doing, backlog),
  };
}

export function commentMentionsViewer(text: string, aliases: string[]) {
  const mentioned = mentionNames(text).map((name) => name.toLowerCase());
  return aliases.some((alias) => mentioned.includes(String(alias || "").toLowerCase()));
}

export function mentionSegments(text: string): Array<{ text: string; mention: boolean }> {
  return String(text || "")
    .split(/(@[A-Za-z][\w-]*)/g)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, mention: part.startsWith("@") }));
}

export function itemMentionsViewer(item: any, aliases: string[]) {
  const stored = Array.isArray(item?.mentionedNames)
    ? item.mentionedNames.map((name: unknown) => `@${name}`).join(" ")
    : "";
  const comments = Array.isArray(item?.comments)
    ? item.comments.map((entry: KanbanComment) => String(entry?.text || "")).join(" ")
    : "";
  return commentMentionsViewer(`${stored} ${comments}`, aliases);
}

export function checklistCaption(items: KanbanChecklistItem[]) {
  const { done, total } = checklistProgress(items);
  if (!total) return "";
  return `${done}/${total} completed`;
}
