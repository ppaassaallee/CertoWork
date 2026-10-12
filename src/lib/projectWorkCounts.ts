import { localDateKey } from "./workspaceDisplay";
import { isCompletedWorkStatus } from "./workStatuses";

export type ProjectWorkCounts = {
  items: number;
  subtasks: number;
  openItems: number;
  doneItems: number;
  openSubtasks: number;
  doneSubtasks: number;
  overdueItems: number;
  blockedItems: number;
};

const REMOVED = new Set(["archived", "deleted"]);

export function isSubtaskRecord(task: { workItemType?: string; itemType?: string; taskType?: string; type?: string } | null | undefined) {
  const kind = String(task?.workItemType || task?.itemType || task?.taskType || task?.type || "").toLowerCase();
  return kind === "subtask" || kind.includes("subtask") || kind.includes("sub_task");
}

function dueDay(task: { dueDate?: unknown; targetDate?: unknown }) {
  const raw = task?.dueDate || task?.targetDate || "";
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
}

type CountedTask = {
  status?: string | null;
  deletedAt?: unknown;
  workItemType?: string;
  itemType?: string;
  taskType?: string;
  type?: string;
  dueDate?: unknown;
  targetDate?: unknown;
};

/** One selector for header and sidebar: items vs subtasks, open vs done. Deleted rows are excluded. */
export function projectWorkCounts(tasks: CountedTask[] = [], now = new Date()): ProjectWorkCounts {
  const today = localDateKey(now);
  const counts: ProjectWorkCounts = {
    items: 0,
    subtasks: 0,
    openItems: 0,
    doneItems: 0,
    openSubtasks: 0,
    doneSubtasks: 0,
    overdueItems: 0,
    blockedItems: 0,
  };
  for (const task of tasks) {
    const status = String(task?.status || "").toLowerCase();
    if (REMOVED.has(status) || task?.deletedAt) continue;
    const subtask = isSubtaskRecord(task);
    const done = isCompletedWorkStatus(status);
    if (subtask) {
      counts.subtasks += 1;
      if (done) counts.doneSubtasks += 1;
      else counts.openSubtasks += 1;
    } else {
      counts.items += 1;
      if (done) counts.doneItems += 1;
      else counts.openItems += 1;
    }
    if (!done && status === "blocked") counts.blockedItems += 1;
    const due = dueDay(task);
    if (!done && due && due < today) counts.overdueItems += 1;
  }
  return counts;
}
