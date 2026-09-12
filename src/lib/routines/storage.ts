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
import { db } from "../firebase";
import {
  emptyRoutineStats,
  ROUTINES_COLLECTION,
  type RoutineCompileResult,
  type RoutineScope,
  type RoutineSpec,
  type RoutineStatus,
} from "./types";

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

export async function saveRoutineDraft(input: {
  workspaceId: string;
  ownerUserId: string;
  compiled: RoutineCompileResult;
}): Promise<string> {
  const { spec } = input.compiled;
  const payload = {
    ...spec,
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    userId: input.ownerUserId,
    status: "draft" as RoutineStatus,
    stats: emptyRoutineStats(),
    nextRunAt: null,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, ROUTINES_COLLECTION), payload);
  return ref.id;
}

export async function setRoutineStatus(routineId: string, status: RoutineStatus) {
  await updateDoc(doc(db, ROUTINES_COLLECTION, routineId), {
    status,
    updatedAt: serverTimestamp(),
  });
}
