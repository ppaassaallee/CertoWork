import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";

export const KANBAN_PRESENCE_COLLECTION = "kanban_board_presence";
export const PRESENCE_TTL_MS = 45_000;

export type KanbanPresence = {
  id: string;
  userId: string;
  workspaceId: string;
  surface: string;
  displayName: string;
  seenAtMs: number;
};

export function presenceDocId(workspaceId: string, userId: string, surface: string) {
  return `${workspaceId}_${userId}_${surface.replace(/[^a-zA-Z0-9_-]/g, "_")}`.slice(0, 128);
}

export function isPresenceFresh(seenAtMs: number, now = Date.now(), ttlMs = PRESENCE_TTL_MS) {
  return Number.isFinite(seenAtMs) && now - seenAtMs < ttlMs;
}

export async function heartbeatKanbanPresence(input: {
  workspaceId: string;
  userId: string;
  surface: string;
  displayName: string;
}) {
  if (!input.workspaceId || !input.userId) return;
  const id = presenceDocId(input.workspaceId, input.userId, input.surface);
  await setDoc(
    doc(db, KANBAN_PRESENCE_COLLECTION, id),
    {
      userId: input.userId,
      workspaceId: input.workspaceId,
      surface: input.surface,
      displayName: input.displayName || "Teammate",
      seenAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenKanbanPresence(
  workspaceId: string,
  surface: string,
  onChange: (viewers: KanbanPresence[]) => void,
) {
  if (!workspaceId) return () => undefined;
  const q = query(
    collection(db, KANBAN_PRESENCE_COLLECTION),
    where("workspaceId", "==", workspaceId),
    where("surface", "==", surface),
  );
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const viewers = snap.docs
      .map((entry) => {
        const data = entry.data() || {};
        return {
          id: entry.id,
          userId: String(data.userId || ""),
          workspaceId: String(data.workspaceId || ""),
          surface: String(data.surface || ""),
          displayName: String(data.displayName || "Teammate"),
          seenAtMs: Number(data.seenAtMs) || 0,
        };
      })
      .filter((viewer) => viewer.userId && isPresenceFresh(viewer.seenAtMs, now));
    onChange(viewers);
  }, () => onChange([]));
}
