import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { isWorkspaceOwnerOrAdmin } from "./workspaceAdmin";

const inputZ = z.object({
  workspaceId: z.string().min(1),
});

/**
 * Fail closed. Start clean and other maintenance tools call this before any delete.
 * A missing deploy means the client cannot wipe data.
 */
export const assertWorkspaceAdmin = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }
    const parsed = inputZ.safeParse(request.data || {});
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "workspaceId required");
    }
    const { workspaceId } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();
    const workspaceSnap = await db.doc(`workspaces/${workspaceId}`).get();
    if (!workspaceSnap.exists) {
      throw new HttpsError("not-found", "Workspace not found");
    }
    const workspace = workspaceSnap.data() || {};
    const isOwner = workspace.ownerId === uid;
    let role = "";
    if (!isOwner) {
      const memberSnap = await db
        .collection("workspace_members")
        .where("workspaceId", "==", workspaceId)
        .where("userId", "==", uid)
        .limit(1)
        .get();
      role = String(memberSnap.docs[0]?.data()?.role || "");
    }
    if (!isWorkspaceOwnerOrAdmin({ isOwner, role })) {
      throw new HttpsError("permission-denied", "Owner or admin required");
    }
    return { ok: true };
  },
);
