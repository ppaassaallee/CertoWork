import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { prepareItemWrite } from "../firestorePayload";
import { checkMoveToMake, checkSetPriority, checkTop3, type CapResult } from "./caps";
import { RUN_COLLECTION } from "./store";
import type { DeskItem } from "./types";
import type { Decision, Lane, RunWorld } from "./vocab";
import { adminNeverMake } from "./intake";

function runRef(id: string) {
  return doc(db, RUN_COLLECTION, id);
}

export async function patchRunItem(id: string, patch: Record<string, unknown>) {
  await updateDoc(runRef(id), prepareItemWrite({ ...patch, updatedAt: serverTimestamp() }));
}

export async function completeRunItem(id: string, kind: "done" | "yes" | "no" | "dropped", reason?: string) {
  await patchRunItem(id, {
    status: kind === "dropped" ? "archived" : "done",
    outcome: { kind, reason, at: new Date().toISOString() },
  });
}

export async function moveRunItemToMake(items: DeskItem[], workspaceId: string, itemId: string): Promise<CapResult> {
  const result = checkMoveToMake(items, { workspace: workspaceId }, itemId);
  if (!result.ok) return result;
  await patchRunItem(itemId, { decision: "make", inQueue: true });
  return { ok: true };
}

export async function setRunItemPriority(
  items: DeskItem[],
  workspaceId: string,
  itemId: string,
  priority: "P1" | "P2" | "P3" | "P4",
): Promise<CapResult> {
  const result = checkSetPriority(items, { workspace: workspaceId }, itemId, priority);
  if (!result.ok) return result;
  await patchRunItem(itemId, { priority });
  return { ok: true };
}

export async function clearRunTop3(itemId: string) {
  await patchRunItem(itemId, { runTop3Date: "" });
}

export async function setRunTop3(currentIds: string[], itemId: string, date: string): Promise<CapResult> {
  const result = checkTop3(currentIds, itemId);
  if (!result.ok) return result;
  await patchRunItem(itemId, { runTop3Date: date });
  return { ok: true };
}

export async function delegateRunItem(id: string, to: string, date: string, mode: "captain" | "propose", context: string) {
  await patchRunItem(id, {
    decision: "delegate",
    inQueue: true,
    assigneeName: to,
    outcome: { kind: "delegated", owner: to, date, mode, context, at: new Date().toISOString() },
  });
}

export async function renegotiateRunItem(id: string, date: string) {
  await patchRunItem(id, {
    dueDate: date,
    outcome: { kind: "renegotiated", date, at: new Date().toISOString() },
  });
}

export async function createRunItem(input: {
  userId: string;
  workspaceId: string;
  title: string;
  decision: Decision;
  lane: Lane;
  world: RunWorld;
  details?: string;
  dueDate?: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: "admin-make" }> {
  if (adminNeverMake(input.lane, input.decision)) return { ok: false, reason: "admin-make" };
  const ref = await addDoc(
    collection(db, RUN_COLLECTION),
    prepareItemWrite({
      userId: input.userId,
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.details || "",
      status: "open",
      decision: input.decision,
      lane: input.lane,
      world: input.world,
      inQueue: true,
      priority: "P3",
      dueDate: input.dueDate || "",
      epic: "",
      tags: input.lane === "admin" ? ["admin"] : [],
      createdBy: input.userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  return { ok: true, id: ref.id };
}
