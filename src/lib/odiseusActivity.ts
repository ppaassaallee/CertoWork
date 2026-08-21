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

/** Best-effort activity write — never blocks the chat reply. */
export async function recordOdiseusActivitySafe(
  input: Parameters<typeof recordOdiseusActivity>[0],
) {
  try {
    await recordOdiseusActivity(input);
  } catch (error) {
    console.warn("Odiseus activity was not persisted:", error);
  }
}

export type OdiseusRunPersistInput = {
  userId: string;
  workspaceId: string;
  conversationId?: string | null;
  projectId?: string | null;
  request: string;
  status?: string;
  steps?: unknown[];
  toolCount?: number;
  artifact?: unknown;
  actionPlan?: unknown;
  outcome?: string;
};

/**
 * Persist an Odiseus run log. Returns the doc id, or null when Firestore
 * rejects the write (e.g. rules not deployed yet). Callers must still save
 * the assistant message so chat does not look like a permission failure.
 */
export async function persistOdiseusRun(
  input: OdiseusRunPersistInput,
): Promise<string | null> {
  try {
    const runRef = await addDoc(collection(db, "odiseus_runs"), {
      userId: input.userId,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId || null,
      projectId: input.projectId || null,
      request: input.request,
      status: input.status || "completed",
      steps: input.steps || [],
      toolCount: input.toolCount || 0,
      artifact: input.artifact || null,
      actionPlan: input.actionPlan || null,
      outcome: input.outcome || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return runRef.id;
  } catch (error) {
    console.warn("Odiseus run was not persisted:", error);
    return null;
  }
}
