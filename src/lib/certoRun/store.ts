import { isCertoRunItem } from "./item";
import { isDecision, type Decision, type Lane, type Priority, type RunWorld } from "./vocab";
import type { DeskItem, Outcome } from "./types";

/** Certo Run records are items in the existing `tasks` collection. */
export const RUN_COLLECTION = "tasks";

function priorityOf(value: unknown): Priority {
  if (value === "P1" || value === 1 || value === "1") return "P1";
  if (value === "P2" || value === 2 || value === "2") return "P2";
  if (value === "P4" || value === 4 || value === "4") return "P4";
  return "P3";
}

function stampDate(value: unknown): string {
  if (typeof value === "string" && value) {
    if (value.includes("T")) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Guatemala",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date);
      }
    }
    return value.slice(0, 10);
  }
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guatemala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
  return "";
}

function laneOf(value: unknown): Lane {
  if (value === "admin" || value === "commercial" || value === "projects" || value === "personal") return value;
  return "projects";
}

export function runDocToDeskItem(
  id: string,
  data: Record<string, unknown>,
  workspace: { id: string },
): DeskItem | null {
  if (!isCertoRunItem(data)) return null;
  const status = String(data.status || "open");
  const decision = typeof data.runDecision === "string" && isDecision(data.runDecision) ? data.runDecision : "make";
  const world = data.runWorld as RunWorld;
  return {
    id,
    externalId: id,
    workspaceId: String(data.workspaceId || workspace.id),
    world,
    type: "pbi",
    lane: decision === "admin_batch" ? "admin" : laneOf(data.runLane),
    decision,
    priority: priorityOf(data.priority),
    title: String(data.title || "Untitled"),
    context: String(data.runContext || data.context || data.description || ""),
    deliverable: String(data.runDeliverable || data.deliverable || ""),
    doneWhen: String(data.runDoneWhen || data.doneWhen || ""),
    nextStep: String(data.runNextStep || data.nextStep || ""),
    clientEntity: String(data.runClient || data.clientEntity || ""),
    health: data.runHealth === "green" || data.runHealth === "amber" || data.runHealth === "red" ? data.runHealth : "",
    unblock: String(data.runUnblock || ""),
    created: stampDate(data.createdAt) || stampDate(data.created),
    epic: String(data.epic || ""),
    feature: "",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    assigneeName: String(data.assigneeName || ""),
    dueDate: typeof data.dueDate === "string" ? data.dueDate : "",
    queueOrder: null,
    state: status === "archived" ? "archived" : status === "done" ? "done" : "open",
    outcome: data.runOutcome && typeof data.runOutcome === "object" ? (data.runOutcome as Outcome) : undefined,
    inQueue: data.runInQueue !== false,
    runTop3Date: typeof data.runTop3Date === "string" ? data.runTop3Date : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
  };
}

export function isRunDecision(value: string): value is Decision {
  return isDecision(value);
}
