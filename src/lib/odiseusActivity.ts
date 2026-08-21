import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/** Persist a human-readable Odiseus activity row (no LLM traces). */
export async function recordOdiseusActivity(input: {
  workspaceId: string;
  userId: string;
  conversationId?: string | null;
  projectId?: string | null;
  runId?: string | null;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  approvalRequired?: boolean;
  approvedBy?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await addDoc(collection(db, "odiseus_activity"), {
    workspaceId: input.workspaceId,
    userId: input.userId,
    conversationId: input.conversationId || null,
    projectId: input.projectId || null,
    runId: input.runId || null,
    action: input.action,
    summary: input.summary,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    approvalRequired: Boolean(input.approvalRequired),
    approvedBy: input.approvedBy || null,
    metadata: input.metadata || null,
    createdAt: serverTimestamp(),
  });
}
