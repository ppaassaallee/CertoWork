import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { prepareItemWrite, prepareTaskCreatePayload } from "../firestorePayload";
import { checkMoveToMake, checkSetPriority, checkTop3, type CapResult } from "./caps";
import type { DeskItem } from "./types";
import type { Decision, Lane } from "./vocab";
import { adminNeverMake } from "./intake";

function taskRef(id: string) {
  return doc(db, "tasks", id);
}

export async function patchTask(id: string, patch: Record<string, unknown>) {
  await updateDoc(taskRef(id), prepareItemWrite({ ...patch, updatedAt: serverTimestamp() }));
}

export async function completeTask(id: string, kind: "done" | "yes" | "no" | "dropped", reason?: string) {
  await patchTask(id, {
    status: kind === "dropped" ? "archived" : "done",
    completedAt: serverTimestamp(),
    runOutcome: { kind, reason, at: new Date().toISOString() },
  });
}

export async function moveTaskToMake(items: DeskItem[], workspaceId: string, taskId: string): Promise<CapResult> {
  const result = checkMoveToMake(items, { workspace: workspaceId }, taskId);
  if (!result.ok) return result;
  await patchTask(taskId, { runDecision: "make", itemType: "next_action" });
  return { ok: true };
}

export async function setTaskPriority(
  items: DeskItem[],
  workspaceId: string,
  taskId: string,
  priority: "P1" | "P2" | "P3" | "P4",
): Promise<CapResult> {
  const result = checkSetPriority(items, { workspace: workspaceId }, taskId, priority);
  if (!result.ok) return result;
  await patchTask(taskId, { priority });
  return { ok: true };
}

export async function clearTaskTop3(taskId: string) {
  await patchTask(taskId, { runTop3Date: "" });
}

export async function setTaskTop3(currentIds: string[], taskId: string, date: string): Promise<CapResult> {
  const result = checkTop3(currentIds, taskId);
  if (!result.ok) return result;
  await patchTask(taskId, { runTop3Date: date });
  return { ok: true };
}

export async function delegateTask(id: string, to: string, date: string, mode: "captain" | "propose", context: string) {
  await patchTask(id, {
    runDecision: "delegate",
    itemType: "delegated",
    assigneeName: to,
    runOutcome: { kind: "delegated", owner: to, date, mode, context, at: new Date().toISOString() },
  });
}

export async function renegotiateTask(id: string, date: string) {
  await patchTask(id, {
    dueDate: date,
    runOutcome: { kind: "renegotiated", date, at: new Date().toISOString() },
  });
}

const ITEM_TYPE: Record<Decision, string> = {
  make: "next_action",
  decide: "decision",
  delegate: "delegated",
  follow_up: "follow_up",
  admin_batch: "admin",
};

export async function createRunTask(input: {
  userId: string;
  workspaceId: string;
  title: string;
  decision: Decision;
  lane: Lane;
  details?: string;
  dueDate?: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: "admin-make" }> {
  if (adminNeverMake(input.lane, input.decision)) return { ok: false, reason: "admin-make" };
  const ref = await addDoc(
    collection(db, "tasks"),
    prepareTaskCreatePayload({
      userId: input.userId,
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.details || "",
      status: "open",
      itemType: ITEM_TYPE[input.decision],
      runDecision: input.decision,
      priority: "P3",
      dueDate: input.dueDate || null,
      createdBy: input.userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      acceptanceCriteria: "",
      tags: input.lane === "admin" ? ["admin"] : [],
    }),
  );
  return { ok: true, id: ref.id };
}
