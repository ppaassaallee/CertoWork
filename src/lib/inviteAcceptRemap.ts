import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { buildMemberIdRemapPatch } from "./taskAssignment";

async function remapByArrayContains({
  db,
  collectionName,
  workspaceId,
  pendingMemberId,
  activeMemberId,
  userId,
  email,
  idFields,
}: {
  db: Firestore;
  collectionName: string;
  workspaceId: string;
  pendingMemberId: string;
  activeMemberId: string;
  userId?: string;
  email?: string;
  idFields: string[];
}) {
  const snaps = await Promise.all(
    idFields.map((field) =>
      getDocs(query(collection(db, collectionName), where(field, "array-contains", pendingMemberId))).catch(
        () => null,
      ),
    ),
  );

  const byId = new Map<string, Record<string, unknown>>();
  for (const snap of snaps) {
    if (!snap) continue;
    for (const item of snap.docs) {
      const data = item.data() as Record<string, unknown>;
      if (String(data.workspaceId || "") !== workspaceId) continue;
      byId.set(item.id, { id: item.id, ...data });
    }
  }

  await Promise.allSettled(
    [...byId.values()].map(async (record) => {
      const patch = buildMemberIdRemapPatch(record, pendingMemberId, activeMemberId, {
        userId,
        email,
      });
      if (!patch) return;
      await updateDoc(doc(db, collectionName, String(record.id)), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    }),
  );
}

/**
 * After invite accept: rewrite pending member ids on tasks/projects to the active seat,
 * and grant the new auth userId visibility so My Work / Items queries resolve.
 */
export async function remapWorkspaceAccessAfterInviteAccept({
  db,
  workspaceId,
  pendingMemberId,
  activeMemberId,
  userId,
  email,
}: {
  db: Firestore;
  workspaceId: string;
  pendingMemberId: string;
  activeMemberId: string;
  userId?: string;
  email?: string;
}) {
  if (!workspaceId || !pendingMemberId || !activeMemberId || pendingMemberId === activeMemberId) {
    return;
  }

  await Promise.allSettled([
    remapByArrayContains({
      db,
      collectionName: "tasks",
      workspaceId,
      pendingMemberId,
      activeMemberId,
      userId,
      email,
      idFields: ["assigneeIds", "accessMemberIds"],
    }),
    remapByArrayContains({
      db,
      collectionName: "projects",
      workspaceId,
      pendingMemberId,
      activeMemberId,
      userId,
      email,
      idFields: ["teamMemberIds", "sponsorIds", "accessMemberIds"],
    }),
  ]);
}
