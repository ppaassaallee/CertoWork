import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getCertoFirestore } from "./firestore";

const options = { region: "us-central1" as const };
type Role = "admin" | "member" | "viewer";

async function requireApprover(uid: string | undefined, workspaceId: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  const approverUid = process.env.BETA_APPROVER_UID?.trim();
  if (!approverUid) {
    throw new HttpsError("failed-precondition", "Beta approver is not configured");
  }
  if (uid !== approverUid || !workspaceId || workspaceId.includes("/")) {
    throw new HttpsError("permission-denied", "Not the beta approver");
  }
  const db = getCertoFirestore();
  const [workspaceSnap, memberSnap] = await Promise.all([
    db.doc(`workspaces/${workspaceId}`).get(),
    db.doc(`workspace_members/${workspaceId}_${uid}`).get(),
  ]);
  const workspace = workspaceSnap.data();
  const member = memberSnap.data();
  if (!workspace || (workspace.ownerId !== uid &&
    !(member?.userId === uid && member?.workspaceId === workspaceId &&
      ["active", "accepted"].includes(member?.status) && member?.role === "admin"))) {
    throw new HttpsError("permission-denied", "Workspace administrator required");
  }
  return { db, workspace };
}

export const listBetaAccessRequests = onCall(options, async (request) => {
  const workspaceId = String(request.data?.workspaceId || "");
  const { db } = await requireApprover(request.auth?.uid, workspaceId);
  const snapshot = await db.collection("access_requests")
    .where("status", "==", "pending").limit(100).get();
  return { requests: snapshot.docs.map((doc) => {
    const row = doc.data();
    return {
      id: doc.id, userId: row.userId, email: row.email,
      emailLower: row.emailLower, displayName: row.displayName,
      provider: row.provider, status: row.status,
      requestedAt: row.requestedAt?.toDate?.()?.toISOString() || null,
    };
  }) };
});

export const decideBetaAccessRequest = onCall(options, async (request) => {
  const workspaceId = String(request.data?.workspaceId || "");
  const requestId = String(request.data?.requestId || "");
  const decision = request.data?.decision;
  const role = request.data?.role as Role;
  if (!requestId || requestId.includes("/") || !["approve", "reject"].includes(decision) ||
    (decision === "approve" && !["admin", "member", "viewer"].includes(role))) {
    throw new HttpsError("invalid-argument", "Invalid beta access decision");
  }
  const { db } = await requireApprover(request.auth?.uid, workspaceId);
  const requestRef = db.doc(`access_requests/${requestId}`);
  const workspaceRef = db.doc(`workspaces/${workspaceId}`);
  const memberRef = db.doc(`workspace_members/${workspaceId}_${requestId}`);
  const actorMemberRef = db.doc(`workspace_members/${workspaceId}_${request.auth!.uid}`);
  let accountEmail = "";
  if (decision === "approve") {
    const account = await getAuth().getUser(requestId);
    if (!account.emailVerified || account.disabled) {
      throw new HttpsError("failed-precondition", "Applicant must verify their email first");
    }
    accountEmail = String(account.email || "").toLowerCase();
  }
  await db.runTransaction(async (tx) => {
    const [requestSnap, workspaceSnap, actorMemberSnap] = await Promise.all([
      tx.get(requestRef), tx.get(workspaceRef), tx.get(actorMemberRef),
    ]);
    const row = requestSnap.data();
    const workspace = workspaceSnap.data();
    const actor = actorMemberSnap.data();
    if (!workspace || (workspace.ownerId !== request.auth!.uid &&
      !(actor?.userId === request.auth!.uid && actor?.workspaceId === workspaceId &&
        ["active", "accepted"].includes(actor?.status) && actor?.role === "admin"))) {
      throw new HttpsError("permission-denied", "Workspace administrator required");
    }
    if (!row || row.status !== "pending" || row.userId !== requestId || !workspace) {
      throw new HttpsError("failed-precondition", "Request is no longer pending");
    }
    const now = FieldValue.serverTimestamp();
    if (decision === "reject") {
      tx.update(requestRef, { status: "rejected", rejectedBy: request.auth!.uid,
        rejectedAt: now, updatedAt: now });
      return;
    }
    const email = String(row.emailLower || row.email || "").trim().toLowerCase();
    if (!email || !email.includes("@") || email !== accountEmail) {
      throw new HttpsError("failed-precondition", "Request has no valid email");
    }
    const members = Array.isArray(workspace.members) ? workspace.members : [];
    tx.update(workspaceRef, {
      members: [...new Set([...members.map((value: unknown) => String(value).toLowerCase()), email])],
      roles: { ...(workspace.roles || {}), [email]: role }, updatedAt: now,
    });
    tx.set(memberRef, {
      id: `${workspaceId}_${requestId}`, workspaceId, userId: requestId,
      email, emailLower: email, displayName: String(row.displayName || ""),
      role, status: "active", portfolioViewer: role !== "viewer",
      approvedBy: request.auth!.uid, approvedAt: now,
      createdAt: now, updatedAt: now,
    }, { merge: true });
    tx.update(requestRef, {
      status: "approved", approvedBy: request.auth!.uid,
      approvedWorkspaceId: workspaceId, approvedRole: role, updatedAt: now,
    });
  });
  return { ok: true };
});
