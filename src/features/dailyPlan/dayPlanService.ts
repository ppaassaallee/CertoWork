import {
  Timestamp,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  DAY_PLANS_BUCKETS_COLLECTION,
  type DayPlan,
  type DayPlanEntry,
  type PlanBucket,
} from "./types";

export function planId(uid: string, dateKey: string): string {
  return `${uid}_${dateKey}`;
}

function planRef(uid: string, dateKey: string) {
  return doc(db, DAY_PLANS_BUCKETS_COLLECTION, planId(uid, dateKey));
}

function asPlan(id: string, data: Record<string, unknown> | undefined): DayPlan | null {
  if (!data) return null;
  return {
    id,
    uid: String(data.uid || ""),
    date: String(data.date || ""),
    entries: Array.isArray(data.entries) ? (data.entries as DayPlanEntry[]) : [],
    keyItemId: (data.keyItemId as string | null | undefined) ?? null,
    eventTags: Array.isArray(data.eventTags) ? (data.eventTags as DayPlan["eventTags"]) : [],
    plannedAt: (data.plannedAt as Timestamp | null | undefined) ?? null,
    closedAt: (data.closedAt as Timestamp | null | undefined) ?? null,
    autoClosed: Boolean(data.autoClosed),
    closingNote: (data.closingNote as string | null | undefined) ?? null,
    focusScore: typeof data.focusScore === "number" ? data.focusScore : null,
    pendingProposal: (data.pendingProposal as DayPlan["pendingProposal"]) ?? null,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  };
}

function renumberBuckets(entries: DayPlanEntry[]): DayPlanEntry[] {
  const byBucket: Record<PlanBucket, DayPlanEntry[]> = {
    fire: [],
    growth: [],
    extra: [],
  };
  for (const entry of entries) {
    const bucket = entry.bucket in byBucket ? entry.bucket : "extra";
    byBucket[bucket].push(entry);
  }
  const next: DayPlanEntry[] = [];
  for (const bucket of ["fire", "growth", "extra"] as PlanBucket[]) {
    byBucket[bucket]
      .sort((a, b) => a.order - b.order)
      .forEach((entry, order) => {
        next.push({ ...entry, bucket, order });
      });
  }
  return next;
}

export function subscribeDayPlan(
  uid: string,
  dateKey: string,
  cb: (plan: DayPlan | null) => void,
): Unsubscribe {
  return onSnapshot(planRef(uid, dateKey), (snap) => {
    cb(snap.exists() ? asPlan(snap.id, snap.data() as Record<string, unknown>) : null);
  });
}

export async function getPlansInRange(
  uid: string,
  fromKey: string,
  toKey: string,
): Promise<DayPlan[]> {
  const q = query(
    collection(db, DAY_PLANS_BUCKETS_COLLECTION),
    where("uid", "==", uid),
    where("date", ">=", fromKey),
    where("date", "<=", toKey),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => asPlan(d.id, d.data() as Record<string, unknown>))
    .filter((p): p is DayPlan => Boolean(p))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function addEntry(
  uid: string,
  dateKey: string,
  itemId: string,
  bucket: PlanBucket,
): Promise<void> {
  const ref = planRef(uid, dateKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    if (!snap.exists()) {
      const entry: DayPlanEntry = {
        itemId,
        bucket,
        order: 0,
        doneToday: false,
        doneAt: null,
        addedAt: now,
      };
      const plan: DayPlan = {
        id: planId(uid, dateKey),
        uid,
        date: dateKey,
        entries: [entry],
        plannedAt: now,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(ref, plan);
      return;
    }
    const data = snap.data() as DayPlan;
    const entries = Array.isArray(data.entries) ? [...data.entries] : [];
    if (entries.some((e) => e.itemId === itemId)) return;
    const maxOrder = entries
      .filter((e) => e.bucket === bucket)
      .reduce((max, e) => Math.max(max, e.order), -1);
    entries.push({
      itemId,
      bucket,
      order: maxOrder + 1,
      doneToday: false,
      doneAt: null,
      addedAt: now,
    });
    tx.update(ref, { entries: renumberBuckets(entries), updatedAt: now });
  });
}

export async function moveEntry(
  uid: string,
  dateKey: string,
  itemId: string,
  toBucket: PlanBucket,
  toIndex: number,
): Promise<void> {
  const ref = planRef(uid, dateKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as DayPlan;
    const entries = Array.isArray(data.entries) ? [...data.entries] : [];
    const idx = entries.findIndex((e) => e.itemId === itemId);
    if (idx < 0) return;
    const [removed] = entries.splice(idx, 1);
    const target = entries
      .filter((e) => e.bucket === toBucket)
      .sort((a, b) => a.order - b.order);
    const clamped = Math.max(0, Math.min(toIndex, target.length));
    const others = entries.filter((e) => e.bucket !== toBucket);
    const nextBucket = [...target];
    nextBucket.splice(clamped, 0, { ...removed, bucket: toBucket, order: clamped });
    const merged = renumberBuckets([...others, ...nextBucket]);
    tx.update(ref, { entries: merged, updatedAt: Timestamp.now() });
  });
}

export async function removeEntry(
  uid: string,
  dateKey: string,
  itemId: string,
): Promise<void> {
  const ref = planRef(uid, dateKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as DayPlan;
    const entries = (Array.isArray(data.entries) ? data.entries : []).filter(
      (e) => e.itemId !== itemId,
    );
    tx.update(ref, { entries: renumberBuckets(entries), updatedAt: Timestamp.now() });
  });
}

export async function setDoneToday(
  uid: string,
  dateKey: string,
  itemId: string,
  done: boolean,
): Promise<void> {
  const ref = planRef(uid, dateKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as DayPlan;
    const now = Timestamp.now();
    const entries = (Array.isArray(data.entries) ? data.entries : []).map((e) =>
      e.itemId === itemId
        ? { ...e, doneToday: done, doneAt: done ? now : null }
        : e,
    );
    tx.update(ref, { entries, updatedAt: now });
  });
}

export async function addEntries(
  uid: string,
  dateKey: string,
  list: Array<{ itemId: string; bucket: PlanBucket }>,
): Promise<void> {
  if (!list.length) return;
  const ref = planRef(uid, dateKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    let entries: DayPlanEntry[] = snap.exists()
      ? [...((snap.data() as DayPlan).entries || [])]
      : [];
    const existing = new Set(entries.map((e) => e.itemId));
    for (const row of list) {
      if (existing.has(row.itemId)) continue;
      const maxOrder = entries
        .filter((e) => e.bucket === row.bucket)
        .reduce((max, e) => Math.max(max, e.order), -1);
      entries.push({
        itemId: row.itemId,
        bucket: row.bucket,
        order: maxOrder + 1,
        doneToday: false,
        doneAt: null,
        addedAt: now,
      });
      existing.add(row.itemId);
    }
    entries = renumberBuckets(entries);
    if (!snap.exists()) {
      tx.set(ref, {
        id: planId(uid, dateKey),
        uid,
        date: dateKey,
        entries,
        plannedAt: now,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
      } satisfies DayPlan);
    } else {
      tx.update(ref, { entries, updatedAt: now });
    }
  });
}

export async function updatePlanFields(
  uid: string,
  dateKey: string,
  partial: Partial<
    Pick<
      DayPlan,
      | "closedAt"
      | "closingNote"
      | "focusScore"
      | "eventTags"
      | "pendingProposal"
      | "autoClosed"
      | "keyItemId"
    >
  >,
): Promise<void> {
  const ref = planRef(uid, dateKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    if (!snap.exists()) {
      tx.set(ref, {
        id: planId(uid, dateKey),
        uid,
        date: dateKey,
        entries: [],
        plannedAt: now,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
        ...partial,
      } satisfies DayPlan);
      return;
    }
    tx.update(ref, { ...partial, updatedAt: now });
  });
}

export async function setTimeBlock(
  uid: string,
  dateKey: string,
  itemId: string,
  block: import("./types").TimeBlock | null,
): Promise<void> {
  const ref = planRef(uid, dateKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as DayPlan;
    const entries = (data.entries || []).map((e) =>
      e.itemId === itemId ? { ...e, timeBlock: block } : e,
    );
    tx.update(ref, { entries, updatedAt: Timestamp.now() });
  });
}

/** Key task lives on legacy `day_plans` via setKeyItem — not implemented here. */
