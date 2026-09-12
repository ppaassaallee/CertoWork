import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { computeNextRunAt } from "./schedule";
import {
  emptyRoutineStats,
  ROUTINE_RUNS_COLLECTION,
  ROUTINES_COLLECTION,
  type RoutineCompileResult,
  type RoutineScope,
  type RoutineSpec,
  type RoutineStatus,
} from "./types";

export async function listRoutinesForWorkspace(
  workspaceId: string,
  userId?: string,
): Promise<RoutineSpec[]> {
  if (!workspaceId) return [];
  const constraints = [where("workspaceId", "==", workspaceId)];
  if (userId) constraints.push(where("userId", "==", userId));
  const snap = await getDocs(query(collection(db, ROUTINES_COLLECTION), ...constraints, limit(200)));
  return snap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Omit<RoutineSpec, "id">) }))
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

export async function listRoutinesForScope(
  workspaceId: string,
  scope: Pick<RoutineScope, "entityType" | "entityId">,
): Promise<RoutineSpec[]> {
  if (!workspaceId) return [];
  const constraints = [
    where("workspaceId", "==", workspaceId),
    where("scope.entityType", "==", scope.entityType),
  ];
  if (scope.entityId) {
    constraints.push(where("scope.entityId", "==", scope.entityId));
  } else {
    constraints.push(where("scope.entityId", "==", null));
  }
  const snap = await getDocs(query(collection(db, ROUTINES_COLLECTION), ...constraints));
  return snap.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<RoutineSpec, "id">) }));
}

export async function listRoutineRuns(routineId: string, max = 30) {
  if (!routineId) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, ROUTINE_RUNS_COLLECTION),
        where("routineId", "==", routineId),
        orderBy("startedAt", "desc"),
        limit(max),
      ),
    );
    return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  } catch {
    // Index may be missing — fall back without orderBy.
    const snap = await getDocs(
      query(collection(db, ROUTINE_RUNS_COLLECTION), where("routineId", "==", routineId), limit(max)),
    );
    return snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((left: any, right: any) => String(right.startedAt || "").localeCompare(String(left.startedAt || "")));
  }
}

function nextRunIsoFromSpec(spec: {
  trigger?: RoutineCompileResult["spec"]["trigger"] | RoutineSpec["trigger"];
}): string | null {
  const trigger = spec.trigger;
  if (!trigger || trigger.kind !== "schedule") return null;
  const next = computeNextRunAt(trigger.cron, trigger.timezone || "UTC");
  return next ? next.toISOString() : null;
}

export async function saveRoutineDraft(input: {
  workspaceId: string;
  ownerUserId: string;
  compiled: RoutineCompileResult;
  activate?: boolean;
}): Promise<string> {
  const { spec } = input.compiled;
  const activate = Boolean(input.activate);
  const nextRunAt = activate ? nextRunIsoFromSpec(spec) : null;
  const payload = {
    ...spec,
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    userId: input.ownerUserId,
    status: (activate ? "active" : "draft") as RoutineStatus,
    stats: emptyRoutineStats(),
    nextRunAt,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, ROUTINES_COLLECTION), payload);
  return ref.id;
}

export async function setRoutineStatus(
  routineId: string,
  status: RoutineStatus,
  spec?: Pick<RoutineSpec, "trigger">,
) {
  const patch: {
    status: RoutineStatus;
    updatedAt: ReturnType<typeof serverTimestamp>;
    nextRunAt?: string | null;
  } = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "active") {
    patch.nextRunAt = nextRunIsoFromSpec(spec || { trigger: undefined });
  }
  if (status === "paused" || status === "draft") {
    patch.nextRunAt = null;
  }
  await updateDoc(doc(db, ROUTINES_COLLECTION, routineId), patch);
}

export async function activateRoutine(routine: RoutineSpec) {
  const nextRunAt = nextRunIsoFromSpec(routine);
  await updateDoc(doc(db, ROUTINES_COLLECTION, routine.id), {
    status: "active",
    nextRunAt,
    updatedAt: serverTimestamp(),
  });
}

export async function pauseRoutine(routineId: string) {
  await updateDoc(doc(db, ROUTINES_COLLECTION, routineId), {
    status: "paused",
    nextRunAt: null,
    updatedAt: serverTimestamp(),
  });
}

/** User-initiated: grant writeOthers so blocked external deliverables can proceed. */
export async function allowRoutineWriteOthers(routineId: string) {
  await updateDoc(doc(db, ROUTINES_COLLECTION, routineId), {
    "permissions.writeOthers": "always",
    updatedAt: serverTimestamp(),
  });
}

export async function recordManualRoutineRun(input: {
  routine: RoutineSpec;
  workspaceId: string;
  userId: string;
  outputText: string;
  steps: Array<{ kind: string; label: string }>;
}) {
  const startedAt = new Date().toISOString();
  const finishedAt = new Date().toISOString();
  const runRef = await addDoc(collection(db, ROUTINE_RUNS_COLLECTION), {
    routineId: input.routine.id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    triggerType: "manual",
    startedAt,
    finishedAt,
    status: "completed",
    steps: input.steps.map((step, index) => ({ t: index, ...step })),
    output: { text: input.outputText },
    actions: [],
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 },
    chainDepth: 0,
    createdAt: serverTimestamp(),
  });
  const nextRunAt =
    input.routine.trigger.kind === "schedule"
      ? nextRunIsoFromSpec(input.routine)
      : input.routine.nextRunAt || null;
  await updateDoc(doc(db, ROUTINES_COLLECTION, input.routine.id), {
    lastRunAt: finishedAt,
    lastRunStatus: "completed",
    nextRunAt,
    updatedAt: serverTimestamp(),
    "stats.runs30d": Number(input.routine.stats?.runs30d || 0) + 1,
    "stats.success30d": Number(input.routine.stats?.success30d || 0) + 1,
  });
  return runRef.id;
}
