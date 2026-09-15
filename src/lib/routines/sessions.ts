import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { weekOfIso, type RecipeManifest } from "./manifest";
import { ROUTINE_SESSIONS_COLLECTION } from "./types";

export type RoutineSessionStatus =
  | "ready"
  | "in_progress"
  | "paused"
  | "completed"
  | "missed"
  | "expired";

export type RoutineSession = {
  id: string;
  workspaceId: string;
  userId: string;
  routineId: string;
  recipeId: string;
  weekOf: string;
  status: RoutineSessionStatus;
  stepIndex: number;
  /** Condensed mode after miss. */
  condensed?: boolean;
  prepared: Record<string, unknown>;
  answers: Record<string, unknown>;
  noteId?: string | null;
  actions?: unknown[];
  expiresAt?: string | null;
  estimatedMinutes?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export async function createRoutineSession(input: {
  workspaceId: string;
  userId: string;
  routineId: string;
  recipeId: string;
  prepared?: Record<string, unknown>;
  weekOf?: string;
  estimatedMinutes?: number;
  expiresAt?: string | null;
}): Promise<string> {
  const payload = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    routineId: input.routineId,
    recipeId: input.recipeId,
    weekOf: input.weekOf || weekOfIso(),
    status: "ready" as const,
    stepIndex: 0,
    condensed: false,
    prepared: input.prepared || {},
    answers: {},
    noteId: null,
    actions: [],
    expiresAt: input.expiresAt ?? null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, ROUTINE_SESSIONS_COLLECTION), payload);
  return ref.id;
}

export async function getRoutineSession(sessionId: string): Promise<RoutineSession | null> {
  if (!sessionId) return null;
  const snap = await getDoc(doc(db, ROUTINE_SESSIONS_COLLECTION, sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<RoutineSession, "id">) };
}

export async function listReadySessions(
  workspaceId: string,
  userId: string,
): Promise<RoutineSession[]> {
  if (!workspaceId || !userId) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, ROUTINE_SESSIONS_COLLECTION),
        where("workspaceId", "==", workspaceId),
        where("userId", "==", userId),
        where("status", "in", ["ready", "in_progress", "paused", "missed"]),
        limit(20),
      ),
    );
    return snap.docs.map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<RoutineSession, "id">),
    }));
  } catch {
    const snap = await getDocs(
      query(
        collection(db, ROUTINE_SESSIONS_COLLECTION),
        where("workspaceId", "==", workspaceId),
        where("userId", "==", userId),
        limit(40),
      ),
    );
    return snap.docs
      .map((entry) => ({ id: entry.id, ...(entry.data() as Omit<RoutineSession, "id">) }))
      .filter((row) =>
        ["ready", "in_progress", "paused", "missed"].includes(String(row.status)),
      );
  }
}

export async function listCompletedSessions(
  workspaceId: string,
  userId: string,
  recipeId?: string,
  max = 52,
): Promise<RoutineSession[]> {
  if (!workspaceId || !userId) return [];
  const constraints = [
    where("workspaceId", "==", workspaceId),
    where("userId", "==", userId),
    where("status", "==", "completed"),
  ];
  if (recipeId) constraints.push(where("recipeId", "==", recipeId));
  try {
    const snap = await getDocs(
      query(
        collection(db, ROUTINE_SESSIONS_COLLECTION),
        ...constraints,
        orderBy("weekOf", "desc"),
        limit(max),
      ),
    );
    return snap.docs.map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<RoutineSession, "id">),
    }));
  } catch {
    const snap = await getDocs(
      query(collection(db, ROUTINE_SESSIONS_COLLECTION), ...constraints, limit(max)),
    );
    return snap.docs
      .map((entry) => ({ id: entry.id, ...(entry.data() as Omit<RoutineSession, "id">) }))
      .sort((a, b) => String(b.weekOf).localeCompare(String(a.weekOf)));
  }
}

export async function getLatestWeeklyPlanSession(
  workspaceId: string,
  userId: string,
): Promise<RoutineSession | null> {
  const rows = await listCompletedSessions(workspaceId, userId, "weekly-plan", 8);
  return rows[0] || null;
}

export async function patchRoutineSession(
  sessionId: string,
  patch: Partial<
    Pick<
      RoutineSession,
      | "status"
      | "stepIndex"
      | "answers"
      | "prepared"
      | "noteId"
      | "actions"
      | "condensed"
    >
  >,
) {
  await updateDoc(doc(db, ROUTINE_SESSIONS_COLLECTION, sessionId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** Client-side expiry: WRAP unfinished past Monday → missed + condensed offer. */
export function applySessionExpiry(
  session: RoutineSession,
  manifest: RecipeManifest | null,
  now = new Date(),
): RoutineSession {
  if (manifest?.id === "close-day") {
    if (!["ready", "in_progress", "paused"].includes(session.status)) return session;
    const created =
      typeof (session.createdAt as { toDate?: () => Date })?.toDate === "function"
        ? (session.createdAt as { toDate: () => Date }).toDate()
        : typeof session.createdAt === "string"
          ? new Date(session.createdAt)
          : now;
    const deadline = new Date(created);
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(0, 0, 0, 0);
    if (now.getTime() >= deadline.getTime()) {
      return { ...session, status: "missed", condensed: true };
    }
    return session;
  }

  if (!manifest?.expiresWeekday && !session.expiresAt) return session;
  if (!["ready", "in_progress", "paused"].includes(session.status)) return session;

  let expired = false;
  if (session.expiresAt) {
    expired = new Date(session.expiresAt).getTime() < now.getTime();
  } else if (typeof manifest?.expiresWeekday === "number") {
    // Expire at end of that weekday after the session week
    const created =
      typeof (session.createdAt as { toDate?: () => Date })?.toDate === "function"
        ? (session.createdAt as { toDate: () => Date }).toDate()
        : now;
    const deadline = new Date(created);
    // Next Monday 23:59 for WRAP (expiresWeekday = 1)
    const target = manifest.expiresWeekday;
    const day = deadline.getDay();
    let add = (target - day + 7) % 7;
    if (add === 0) add = 7;
    deadline.setDate(deadline.getDate() + add);
    deadline.setHours(23, 59, 59, 999);
    expired = now.getTime() > deadline.getTime();
  }

  if (!expired) return session;
  return { ...session, status: "missed", condensed: true };
}
