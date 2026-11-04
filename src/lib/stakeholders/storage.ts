import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase";

export type StakeholderRecord = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  email?: string;
  role?: string;
};

/** One-shot, route-scoped read: the map does not keep another Firestore listener alive. */
export async function listWorkspaceStakeholders(workspaceId: string): Promise<StakeholderRecord[]> {
  if (!workspaceId) return [];
  const snapshot = await getDocs(
    query(collection(db, "stakeholders"), where("workspaceId", "==", workspaceId)),
  );
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as StakeholderRecord);
}

export async function createWorkspaceStakeholder(input: {
  userId: string;
  workspaceId: string;
  name: string;
  email?: string;
  role?: string;
}): Promise<StakeholderRecord> {
  const name = input.name.trim();
  const email = input.email?.trim().toLowerCase() || "";
  const role = input.role?.trim() || "";
  if (!input.userId || !input.workspaceId || !name) throw new Error("A person needs a name and workspace.");
  const created = await addDoc(collection(db, "stakeholders"), {
    userId: input.userId,
    workspaceId: input.workspaceId,
    name,
    email,
    role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: created.id, userId: input.userId, workspaceId: input.workspaceId, name, email, role };
}
