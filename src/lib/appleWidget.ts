import { dateKey, isClosed, localDateKey } from "./workspaceDisplay";
import { normalizeTimeSector } from "./operatingModel";
import { createShareToken } from "./projectStatusReport";

export const APPLE_WIDGET_COLLECTION = "widget_tokens";

export type AppleWidgetTask = {
  id: string;
  title: string;
  project?: string;
};

export type AppleWidgetSnapshot = {
  workspaceName: string;
  dateLabel: string;
  dateKey: string;
  mustDos: AppleWidgetTask[];
  shouldDos: AppleWidgetTask[];
  pendingApprovals: number;
  odysseusLine: string;
  updatedAt: number;
};

export function createAppleWidgetToken() {
  return createShareToken();
}

export function widgetPublicPath(token: string) {
  return `/widget/${encodeURIComponent(token)}`;
}

export function widgetApiPath(token: string) {
  return `/api/widget/${encodeURIComponent(token)}`;
}

export function priorityRank(value: unknown, isOneThing = false) {
  if (isOneThing) return 1;
  const numeric = Number(value);
  if (numeric === 1 || numeric === 2 || numeric === 3) return numeric;
  const normalized = String(value || "").trim().toUpperCase();
  if (["1", "P1", "HIGH", "URGENT", "CRITICAL"].includes(normalized)) return 1;
  if (["2", "P2", "MEDIUM"].includes(normalized)) return 2;
  if (["3", "P3", "LOW"].includes(normalized)) return 3;
  return 9;
}

export function isTodayTask(task: any, today = localDateKey(new Date())) {
  if (isClosed(task?.status)) return false;
  if (Boolean(task?.isOneThing)) return true;
  if (dateKey(task?.dueDate) === today) return true;
  return normalizeTimeSector(task?.timeSector) === "today";
}

function taskTitle(task: any) {
  return String(task?.title || task?.name || "Untitled").trim() || "Untitled";
}

function projectTitle(task: any, projects: any[]) {
  const project = projects.find((item) => item.id === task?.projectId);
  return project ? String(project.title || project.name || "").trim() : "";
}

export function buildAppleWidgetSnapshot({
  tasks = [],
  projects = [],
  pendingApprovals = 0,
  workspaceName = "Certo Work",
  now = new Date(),
}: {
  tasks?: any[];
  projects?: any[];
  pendingApprovals?: number;
  workspaceName?: string;
  now?: Date;
}): AppleWidgetSnapshot {
  const today = localDateKey(now);
  const dated = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const todayTasks = tasks
    .filter((task) => isTodayTask(task, today))
    .sort((left, right) => {
      const rank =
        priorityRank(left?.priority, Boolean(left?.isOneThing)) -
        priorityRank(right?.priority, Boolean(right?.isOneThing));
      if (rank !== 0) return rank;
      return taskTitle(left).localeCompare(taskTitle(right));
    });
  const toItem = (task: any): AppleWidgetTask => ({
    id: String(task.id || taskTitle(task)),
    title: taskTitle(task),
    project: projectTitle(task, projects) || undefined,
  });
  const mustFromPriority = todayTasks
    .filter((task) => priorityRank(task?.priority, Boolean(task?.isOneThing)) === 1)
    .slice(0, 2)
    .map(toItem);
  const mustDos =
    mustFromPriority.length > 0 ? mustFromPriority : todayTasks.slice(0, 2).map(toItem);
  const mustIds = new Set(mustDos.map((item) => item.id));
  const remaining = todayTasks.filter((task) => !mustIds.has(String(task.id || taskTitle(task))));
  const shouldFromPriority = remaining
    .filter((task) => priorityRank(task?.priority, Boolean(task?.isOneThing)) === 2)
    .slice(0, 8)
    .map(toItem);
  const shouldDos =
    shouldFromPriority.length > 0 ? shouldFromPriority : remaining.slice(0, 8).map(toItem);
  const pending = Math.max(0, Number(pendingApprovals) || 0);
  const odysseusLine =
    pending > 0
      ? `${pending} change${pending === 1 ? "" : "s"} waiting for you`
      : mustDos.length > 0
        ? "Protect the two must-dos. Everything else can move."
        : "No must-dos yet. Capture the next action.";
  return {
    workspaceName: String(workspaceName || "Certo Work").slice(0, 80),
    dateLabel: dated,
    dateKey: today,
    mustDos,
    shouldDos,
    pendingApprovals: pending,
    odysseusLine,
    updatedAt: now.getTime(),
  };
}
