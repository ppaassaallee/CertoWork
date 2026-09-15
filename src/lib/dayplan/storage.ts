import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { DAY_PLANS_COLLECTION, dayPlanId, type DayPlan, type DayFeel, type EnergyTag } from "./types";

function nowIso() { return new Date().toISOString(); }

export async function getDayPlan(userId: string, date: string): Promise<DayPlan | null> {
  const snap = await getDoc(doc(db, DAY_PLANS_COLLECTION, dayPlanId(userId, date)));
  return snap.exists() ? (snap.data() as DayPlan) : null;
}

/** Creates the plan if missing. Idempotent. */
export async function ensureDayPlan(userId: string, workspaceId: string, date: string): Promise<DayPlan> {
  const existing = await getDayPlan(userId, date);
  if (existing) return existing;
  const plan: DayPlan = {
    id: dayPlanId(userId, date), userId, workspaceId, date,
    keyItemId: null, plannedItemIds: [], clearedItemIds: [], energy: {},
    feel: null, carryForward: null, closedAt: null,
    createdAt: nowIso(), updatedAt: nowIso(),
  };
  await setDoc(doc(db, DAY_PLANS_COLLECTION, plan.id), plan, { merge: true });
  return plan;
}

/**
 * Sets the key task. Also keeps the legacy `tasks.isOneThing` flag in sync so
 * Today.tsx and analytics keep working: clears the previous key item, sets the new one.
 */
export async function setKeyItem(userId: string, workspaceId: string, date: string, itemId: string | null): Promise<void> {
  const plan = await ensureDayPlan(userId, workspaceId, date);
  const batch = writeBatch(db);
  if (plan.keyItemId && plan.keyItemId !== itemId) {
    batch.update(doc(db, "tasks", plan.keyItemId), { isOneThing: false });
  }
  if (itemId) {
    batch.update(doc(db, "tasks", itemId), { isOneThing: true });
  }
  batch.update(doc(db, DAY_PLANS_COLLECTION, plan.id), {
    keyItemId: itemId,
    plannedItemIds: itemId ? arrayUnion(itemId) : plan.plannedItemIds,
    updatedAt: nowIso(),
  });
  await batch.commit();
}

export async function addPlannedItem(userId: string, workspaceId: string, date: string, itemId: string): Promise<void> {
  const plan = await ensureDayPlan(userId, workspaceId, date);
  await updateDoc(doc(db, DAY_PLANS_COLLECTION, plan.id), {
    plannedItemIds: arrayUnion(itemId), clearedItemIds: arrayRemove(itemId), updatedAt: nowIso(),
  });
}

/** "Sacar del día" sin completar: cuenta como despejado para el score. */
export async function clearPlannedItem(userId: string, workspaceId: string, date: string, itemId: string): Promise<void> {
  const plan = await ensureDayPlan(userId, workspaceId, date);
  await updateDoc(doc(db, DAY_PLANS_COLLECTION, plan.id), {
    clearedItemIds: arrayUnion(itemId), updatedAt: nowIso(),
  });
}

export async function closeDayPlan(userId: string, workspaceId: string, date: string, input: {
  feel: DayFeel; energy: Record<string, EnergyTag>; carryForward: string | null;
}): Promise<void> {
  const plan = await ensureDayPlan(userId, workspaceId, date);
  await updateDoc(doc(db, DAY_PLANS_COLLECTION, plan.id), {
    feel: input.feel, energy: input.energy, carryForward: input.carryForward,
    closedAt: nowIso(), updatedAt: nowIso(),
  });
}
