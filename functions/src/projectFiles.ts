import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getCertoFirestore } from "./firestore";
import { isProjectFilePath, legacyStoragePath, projectFilePrefix } from "./projectFilePaths";

const MAX_BYTES = 50 * 1024 * 1024;
// Dedicated workload identity: never use the project's default Compute account to sign files.
const region = {
  region: "us-central1" as const,
  serviceAccount: "certo-project-files@gen-lang-client-0277783597.iam.gserviceaccount.com",
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function requireProjectAccess(
  uid: string | undefined,
  email: string | undefined,
  projectId: string,
  workspaceId: string,
) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
  if (!projectId || !workspaceId || projectId.includes("/") || workspaceId.includes("/")) {
    throw new HttpsError("invalid-argument", "Invalid project or workspace");
  }
  const db = getCertoFirestore();
  const [projectSnap, workspaceSnap, memberSnap] = await Promise.all([
    db.doc(`projects/${projectId}`).get(),
    db.doc(`workspaces/${workspaceId}`).get(),
    db.doc(`workspace_members/${workspaceId}_${uid}`).get(),
  ]);
  const project = projectSnap.data();
  const workspace = workspaceSnap.data();
  const member = memberSnap.data();
  if (!project || project.workspaceId !== workspaceId || !workspace) {
    throw new HttpsError("not-found", "Project not found");
  }
  const isOwner = workspace.ownerId === uid;
  const isMember = ["active", "accepted"].includes(String(member?.status || ""));
  if (!isOwner && !isMember) throw new HttpsError("permission-denied", "Workspace access denied");
  const ids = [uid, `${workspaceId}_${uid}`];
  const emailLower = String(email || "").trim().toLowerCase();
  const direct = [project.userId, project.createdBy, project.ownerId,
    project.projectManagerId, project.productOwnerId, project.sponsorId]
    .some((id) => ids.includes(id) || (emailLower && String(id || "").toLowerCase() === emailLower));
  const team = [project.teamMemberIds, project.sponsorIds, project.visibleToUserIds]
    .some((list) => Array.isArray(list) &&
      (ids.some((id) => list.includes(id)) ||
        (emailLower && list.some((value) => String(value).toLowerCase() === emailLower))));
  const visibleByEmail = emailLower && Array.isArray(project.visibleToEmails) &&
    project.visibleToEmails.some((value: unknown) => String(value).toLowerCase() === emailLower);
  const broad = isMember && (member?.role !== "viewer" || member?.portfolioViewer === true);
  if (!isOwner && !direct && !team && !visibleByEmail && !broad) {
    throw new HttpsError("permission-denied", "Project access denied");
  }
  return { db, project, workspace };
}

/** Browser uploads use a bounded POST policy; no durable download token is minted. */
export const createProjectFileUpload = onCall(region, async (request) => {
  const workspaceId = text(request.data?.workspaceId);
  const projectId = text(request.data?.projectId);
  const size = Number(request.data?.size);
  const contentType = text(request.data?.contentType) || "application/octet-stream";
  if (!Number.isInteger(size) || size < 1 || size > MAX_BYTES ||
    contentType.length > 150 || !/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
    throw new HttpsError("invalid-argument", "Invalid file size or type");
  }
  await requireProjectAccess(
    request.auth?.uid,
    request.auth?.token.email as string | undefined,
    projectId,
    workspaceId,
  );
  const storagePath = `${projectFilePrefix(workspaceId, projectId)}${randomUUID()}`;
  const [policy] = await getStorage().bucket().file(storagePath).generateSignedPostPolicyV4({
    expires: Date.now() + 5 * 60 * 1000,
    fields: { "Content-Type": contentType },
    conditions: [["content-length-range", 1, MAX_BYTES], ["eq", "$Content-Type", contentType]],
  });
  return { url: policy.url, fields: policy.fields, storagePath };
});

/** Every open re-evaluates membership and project rights against the named database. */
export const getProjectFileUrl = onCall(region, async (request) => {
  const documentId = text(request.data?.documentId);
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  if (!documentId || documentId.includes("/")) {
    throw new HttpsError("invalid-argument", "Invalid document");
  }
  const db = getCertoFirestore();
  const snap = await db.doc(`knowledge_items/${documentId}`).get();
  const document = snap.data();
  if (!document || document.resourceType !== "file") {
    throw new HttpsError("not-found", "File not found");
  }
  const workspaceId = text(document.workspaceId);
  const projectId = text(document.projectId);
  await requireProjectAccess(
    request.auth.uid,
    request.auth.token.email as string | undefined,
    projectId,
    workspaceId,
  );
  const bucket = getStorage().bucket();
  const storagePath = text(document.storagePath) || legacyStoragePath(text(document.url), bucket.name);
  if (!isProjectFilePath(storagePath, workspaceId, projectId)) {
    throw new HttpsError("permission-denied", "Invalid file path");
  }
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "File not found");
  const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 10 * 60 * 1000 });
  return { url };
});
