import {
  getFirestore,
  FieldValue,
  type Firestore,
} from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

const inputZ = z.object({
  workspaceId: z.string().min(1),
  dryRun: z.boolean().optional(),
  limit: z.number().int().positive().max(2000).optional(),
});

const BATCH_LIMIT = 400;

function hasAssignees(data: Record<string, unknown>) {
  const ids = Array.isArray(data.assigneeIds)
    ? data.assigneeIds.map((v) => String(v || "")).filter(Boolean)
    : [];
  const id = data.assigneeId != null ? String(data.assigneeId).trim() : "";
  const labels = [
    ...(Array.isArray(data.assignees) ? data.assignees : []),
    data.owner,
    data.assignee,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return ids.length > 0 || Boolean(id) || labels.length > 0;
}

/**
 * On-demand: for tasks in a workspace with createdBy set but no assignee,
 * set the creator's workspace member as the primary assignee.
 * Auth required; caller must be workspace owner or admin.
 */
export const restoreCreatorAssignees = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }
    const parsed = inputZ.safeParse(request.data || {});
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "workspaceId required");
    }
    const { workspaceId, dryRun = false, limit = 500 } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const workspaceSnap = await db.doc(`workspaces/${workspaceId}`).get();
    if (!workspaceSnap.exists) {
      throw new HttpsError("not-found", "Workspace not found");
    }
    const workspace = workspaceSnap.data() || {};
    const isOwner = workspace.ownerId === uid;
    let isAdmin = isOwner;
    if (!isAdmin) {
      const memberSnap = await db
        .collection("workspace_members")
        .where("workspaceId", "==", workspaceId)
        .where("userId", "==", uid)
        .limit(1)
        .get();
      const role = String(memberSnap.docs[0]?.data()?.role || "").toLowerCase();
      isAdmin = role === "owner" || role === "admin";
    }
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Owner or admin required");
    }

    const membersSnap = await db
      .collection("workspace_members")
      .where("workspaceId", "==", workspaceId)
      .get();
    const memberByUserId = new Map<string, { id: string; label: string }>();
    for (const doc of membersSnap.docs) {
      const data = doc.data();
      const userId = String(data.userId || "").trim();
      if (!userId) continue;
      const label =
        String(data.alias || data.displayName || data.email || "").trim() || userId;
      memberByUserId.set(userId, { id: doc.id, label });
    }

    const tasksSnap = await db
      .collection("tasks")
      .where("workspaceId", "==", workspaceId)
      .limit(limit)
      .get();

    const patches: Array<{ id: string; createdBy: string; assigneeId: string }> = [];
    const ops: Array<(batch: ReturnType<Firestore["batch"]>) => void> = [];

    for (const doc of tasksSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const createdBy = String(data.createdBy || data.userId || "").trim();
      if (!createdBy) continue;
      if (hasAssignees(data)) continue;
      const member = memberByUserId.get(createdBy);
      if (!member) continue;
      patches.push({ id: doc.id, createdBy, assigneeId: member.id });
      if (dryRun) continue;
      ops.push((batch) => {
        batch.update(doc.ref, {
          assigneeIds: [member.id],
          assignees: member.label ? [member.label] : [],
          owner: member.label || "",
          assignee: member.label || "",
          assigneeId: member.id,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }

    if (!dryRun) {
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
        await batch.commit();
      }
    }

    return {
      dryRun,
      scanned: tasksSnap.size,
      matched: patches.length,
      updated: dryRun ? 0 : ops.length,
      sample: patches.slice(0, 20),
    };
  },
);
