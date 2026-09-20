import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Signal, SignalAction, SignalKind } from "./types";

export async function listOpenSignals(workspaceId: string, uid: string): Promise<Signal[]> {
  try {
    const q = query(
      collection(db, "signals", workspaceId, "items"),
      where("uid", "==", uid),
    );
    const snap = await getDocs(q);
    const now = Date.now();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Signal, "id">) }))
      .filter((s) => {
        if (s.dismissedAt) return false;
        const until = s.snoozedUntil as { toMillis?: () => number } | string | null | undefined;
        if (!until) return true;
        const ms = typeof until === "string" ? new Date(until).getTime() : until.toMillis?.() || 0;
        return ms <= now;
      });
  } catch {
    return [];
  }
}

export async function upsertSignal(opts: {
  workspaceId: string;
  uid: string;
  kind: SignalKind;
  title: string;
  body: string;
  severity: Signal["severity"];
  entityKey: string;
  actions: SignalAction[];
}): Promise<void> {
  const existing = await listOpenSignals(opts.workspaceId, opts.uid);
  if (existing.some((s) => s.entityKey === opts.entityKey && s.kind === opts.kind)) return;
  await addDoc(collection(db, "signals", opts.workspaceId, "items"), {
    uid: opts.uid,
    workspaceId: opts.workspaceId,
    kind: opts.kind,
    title: opts.title,
    body: opts.body,
    severity: opts.severity,
    entityKey: opts.entityKey,
    actions: opts.actions,
    createdAt: serverTimestamp(),
    dismissedAt: null,
    snoozedUntil: null,
  });
}

export async function dismissSignal(workspaceId: string, id: string) {
  await updateDoc(doc(db, "signals", workspaceId, "items", id), {
    dismissedAt: serverTimestamp(),
  });
}

export async function snoozeSignal(workspaceId: string, id: string, days = 7) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  await updateDoc(doc(db, "signals", workspaceId, "items", id), {
    snoozedUntil: until.toISOString(),
  });
}
