import type { Decision, Lane, Priority } from "./vocab";
import { isDecision } from "./vocab";
import type { DeskItem, Outcome } from "./types";

export interface RunTask {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  itemType?: string;
  type?: string;
  workItemType?: string;
  priority?: string | number | null;
  dueDate?: string | null;
  projectId?: string | null;
  epicId?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  ownerId?: string | null;
  requesterId?: string | null;
  createdBy?: string;
  userId?: string;
  tags?: string[];
  gtdContext?: string | null;
  isOneThing?: boolean;
  acceptanceCriteria?: string;
  runDecision?: string;
  runOutcome?: Outcome;
  runTop3Date?: string;
  createdAt?: { toDate?: () => Date; seconds?: number } | string;
}

export interface RunProject {
  id: string;
  title?: string;
  name?: string;
}

const CLOSED = new Set(["done", "completed", "closed", "archived", "cancelled", "deleted"]);

function priorityOf(value: RunTask["priority"]): Priority {
  if (value === "P1" || value === 1 || value === "1") return "P1";
  if (value === "P2" || value === 2 || value === "2") return "P2";
  if (value === "P4" || value === 4 || value === "4") return "P4";
  if (value === "P3" || value === 3 || value === "3") return "P3";
  return "P3";
}

function createdIso(value: RunTask["createdAt"]): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
  }
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  return undefined;
}

export function classifyTask(task: RunTask): { decision: Decision; lane: Lane; inQueue: boolean } {
  const itemType = String(task.itemType || "");
  const tags = task.tags || [];
  const admin = tags.includes("admin") || task.gtdContext === "errands" || itemType === "admin";
  const explicit = typeof task.runDecision === "string" && isDecision(task.runDecision) ? task.runDecision : null;
  if (explicit) {
    return { decision: explicit, lane: explicit === "admin_batch" || admin ? "admin" : "projects", inQueue: true };
  }
  if (itemType === "decision") return { decision: "decide", lane: "projects", inQueue: true };
  if (itemType === "follow_up" || itemType === "waiting_for") return { decision: "follow_up", lane: "projects", inQueue: true };
  if (itemType === "delegated") return { decision: "delegate", lane: "projects", inQueue: true };
  if (admin) return { decision: "admin_batch", lane: "admin", inQueue: true };
  if (itemType === "next_action" || task.isOneThing) return { decision: "make", lane: "projects", inQueue: true };
  return { decision: "make", lane: admin ? "admin" : "projects", inQueue: false };
}

export function taskToDeskItem(
  task: RunTask,
  workspace: { id: string; name: string },
  projectName = "",
): DeskItem | null {
  const status = String(task.status || "open").toLowerCase();
  if (status === "deleted") return null;
  const kind = String(task.workItemType || task.type || "task");
  if (kind === "epic" || kind === "feature") return null;
  const classified = classifyTask(task);
  const closed = CLOSED.has(status);
  const outcome = task.runOutcome;
  return {
    id: task.id,
    externalId: task.id,
    workspaceId: workspace.id,
    world: workspace.name,
    type: "pbi",
    lane: classified.lane,
    decision: classified.decision,
    priority: priorityOf(task.priority),
    title: String(task.title || "Untitled"),
    context: task.description || "",
    deliverable: task.acceptanceCriteria || "",
    doneWhen: task.acceptanceCriteria || "",
    epic: projectName,
    feature: "",
    tags: task.tags || [],
    assigneeUid: task.assigneeId || task.ownerId || undefined,
    assigneeName: task.assigneeName || "",
    requesterUid: task.requesterId || undefined,
    createdBy: task.createdBy || task.userId,
    dueDate: task.dueDate || "",
    queueOrder: null,
    created: createdIso(task.createdAt),
    state: closed ? (status === "archived" ? "archived" : "done") : "open",
    outcome,
    inQueue: classified.inQueue,
    projectId: task.projectId || undefined,
  } as DeskItem & { projectId?: string };
}

export function projectTitle(projects: RunProject[], projectId?: string | null): string {
  if (!projectId) return "";
  const project = projects.find((row) => row.id === projectId);
  return String(project?.title || project?.name || "");
}
