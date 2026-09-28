import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { projectProject, refreshPortalMeta } from "./projectProject";
import { projectItems } from "./projectItems";
import { projectDocuments } from "./projectDocuments";
import { projectInvoices } from "./projectInvoices";
import { projectApprovals } from "./projectApprovals";
import { projectThreads } from "./projectThreads";
import { publishUpdate } from "./publishUpdate";
import { writeActivity } from "./writeActivity";
import { PORTAL_MEMBERS, PORTAL_EVENTS, CLIENT_APPROVALS } from "./paths";

const region = { region: "us-central1" as const };

function requireAuth(uid?: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
}

export const portalLoginPrecheck = onCall(region, async (request) => {
  const email = String(request.data?.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "email-required");
  }
  const db = getFirestore();
  const snap = await db.collection(PORTAL_MEMBERS).where("email", "==", email).limit(1).get();
  if (snap.empty) {
    return { ok: false, reason: "not-invited" as const };
  }
  const member = snap.docs[0].data();
  if (member.status === "revoked") {
    return { ok: false, reason: "revoked" as const };
  }
  return {
    ok: true,
    clientIds: member.clientIds || [],
    locale: member.locale || "es",
  };
});

export const portalEnsureClaims = onCall(region, async (request) => {
  requireAuth(request.auth?.uid);
  const uid = request.auth!.uid;
  const email = String(request.auth!.token.email || "").toLowerCase();
  const db = getFirestore();
  const snap = await db.collection(PORTAL_MEMBERS).where("email", "==", email).limit(1).get();
  if (snap.empty) throw new HttpsError("permission-denied", "not-a-portal-member");
  const doc = snap.docs[0];
  const member = doc.data();
  if (member.status === "revoked") throw new HttpsError("permission-denied", "revoked");
  const clientIds = Array.isArray(member.clientIds) ? member.clientIds : [];
  await getAuth().setCustomUserClaims(uid, {
    portal: true,
    workspaceId: member.workspaceId || null,
    clientIds,
  });
  await doc.ref.set(
    {
      uid,
      status: "active",
      lastSeenAt: new Date().toISOString(),
    },
    { merge: true },
  );
  for (const clientId of clientIds) {
    await projectThreads(db, clientId).catch(() => null);
  }
  return { ok: true, clientIds };
});

export const publishPortalUpdate = onCall(region, async (request) => {
  requireAuth(request.auth?.uid);
  if (request.auth!.token.portal === true) {
    throw new HttpsError("permission-denied", "portal-cannot-publish");
  }
  const updateId = String(request.data?.updateId || "");
  if (!updateId) throw new HttpsError("invalid-argument", "updateId");
  const result = await publishUpdate(getFirestore(), updateId, request.auth!.uid);
  if (!result.ok) throw new HttpsError("failed-precondition", result.reason || "publish-failed");
  return result;
});

export const getPortalDocumentUrl = onCall(region, async (request) => {
  requireAuth(request.auth?.uid);
  if (request.auth!.token.portal !== true) {
    throw new HttpsError("permission-denied", "portal-only");
  }
  const clientId = String(request.data?.clientId || "");
  const docId = String(request.data?.documentId || "");
  const clientIds: string[] = Array.isArray(request.auth!.token.clientIds)
    ? (request.auth!.token.clientIds as string[])
    : [];
  if (!clientId || !clientIds.includes(clientId)) {
    throw new HttpsError("permission-denied", "client");
  }
  const db = getFirestore();
  const viewSnap = await db.doc(`client_portal/${clientId}/documents/${docId}`).get();
  if (!viewSnap.exists) throw new HttpsError("not-found", "document");
  const storagePath = String(
    request.data?.storagePath || viewSnap.data()?.storagePath || "",
  );
  if (!storagePath) {
    return { url: null, expiresAt: null };
  }
  const bucket = getStorage().bucket();
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  await db.collection(PORTAL_EVENTS).add({
    clientId,
    uid: request.auth!.uid,
    at: new Date().toISOString(),
    kind: "download",
    refId: docId,
  });
  return { url, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
});

export const createPortalRequest = onCall(region, async (request) => {
  requireAuth(request.auth?.uid);
  if (request.auth!.token.portal !== true) {
    throw new HttpsError("permission-denied", "portal-only");
  }
  const clientId = String(request.data?.clientId || "");
  const projectId = String(request.data?.projectId || "");
  const title = String(request.data?.title || "").trim();
  const description = String(request.data?.description || "").trim();
  const clientIds: string[] = Array.isArray(request.auth!.token.clientIds)
    ? (request.auth!.token.clientIds as string[])
    : [];
  if (!clientId || !clientIds.includes(clientId) || !projectId || !title) {
    throw new HttpsError("invalid-argument", "fields");
  }
  const db = getFirestore();
  const project = await db.doc(`projects/${projectId}`).get();
  if (!project.exists || String(project.data()?.clientId) !== clientId) {
    throw new HttpsError("permission-denied", "project");
  }
  const email = String(request.auth!.token.email || "").toLowerCase();
  const taskRef = await db.collection("tasks").add({
    workspaceId: project.data()?.workspaceId || request.auth!.token.workspaceId,
    projectId,
    title,
    description,
    kind: "ticket",
    ticketStatus: "new",
    customerStatus: "Received",
    requesterEmail: email,
    channel: "portal",
    clientVisible: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeActivity(db, {
    clientId,
    id: `request_${taskRef.id}`,
    kind: "request",
    title,
    body: description.slice(0, 280),
    projectId,
  });
  await projectItems(db, projectId);
  await db.collection(PORTAL_EVENTS).add({
    clientId,
    uid: request.auth!.uid,
    at: new Date().toISOString(),
    kind: "request_created",
    refId: taskRef.id,
  });
  return { ok: true, taskId: taskRef.id };
});

export const portalAsk = onCall(region, async (request) => {
  requireAuth(request.auth?.uid);
  if (request.auth!.token.portal !== true) {
    throw new HttpsError("permission-denied", "portal-only");
  }
  const clientId = String(request.data?.clientId || "");
  const projectId = String(request.data?.projectId || "");
  const question = String(request.data?.question || "").trim();
  const clientIds: string[] = Array.isArray(request.auth!.token.clientIds)
    ? (request.auth!.token.clientIds as string[])
    : [];
  if (!clientId || !clientIds.includes(clientId) || !projectId || !question) {
    throw new HttpsError("invalid-argument", "fields");
  }
  const db = getFirestore();
  const uid = request.auth!.uid;
  const day = new Date().toISOString().slice(0, 10);
  const rateRef = db.doc(`portal_ask_rate/${uid}_${day}`);
  const rateSnap = await rateRef.get();
  const count = Number(rateSnap.data()?.count || 0);
  if (count >= 30) throw new HttpsError("resource-exhausted", "daily-limit");
  await rateRef.set({ count: count + 1, day, uid }, { merge: true });

  const [updates, timeline, items, docs, invoices, approvals, meta] = await Promise.all([
    db.collection(`client_portal/${clientId}/updates`).where("projectId", "==", projectId).limit(20).get(),
    db.doc(`client_portal/${clientId}/timeline/${projectId}`).get(),
    db.collection(`client_portal/${clientId}/items`).where("projectId", "==", projectId).limit(50).get(),
    db.collection(`client_portal/${clientId}/documents`).where("projectId", "==", projectId).limit(30).get(),
    db.collection(`client_portal/${clientId}/invoices`).where("projectId", "==", projectId).limit(30).get(),
    db.collection(`client_portal/${clientId}/approvals`).where("projectId", "==", projectId).limit(30).get(),
    db.doc(`client_portal/${clientId}/meta/portal`).get(),
  ]);

  const costDetail = Boolean(
    (await db.doc(`clients/${clientId}`).get()).data()?.settings?.costDetail,
  );
  const qLower = question.toLowerCase();
  if (!costDetail && /(cost|costo|margin|margen|hours|horas|budget|presupuesto)/i.test(qLower)) {
    const answer =
      meta.data()?.locale === "en"
        ? "Cost and hours detail is not available in your portal."
        : "El detalle de costos y horas no está disponible en tu portal.";
    await db.collection(PORTAL_EVENTS).add({
      clientId,
      uid,
      at: new Date().toISOString(),
      kind: "ask",
      refId: projectId,
      meta: { question, answer, blocked: "costDetail" },
    });
    return { answer, citations: [] as string[] };
  }

  const contextParts: string[] = [];
  updates.docs.forEach((d) => {
    const u = d.data();
    contextParts.push(`Update ${u.title}: ${u.summary}`);
  });
  if (timeline.exists) {
    const itemsT = timeline.data()?.items || [];
    contextParts.push(
      `Timeline: ${itemsT.map((i: { title: string; status: string }) => `${i.title} (${i.status})`).join("; ")}`,
    );
  }
  items.docs.forEach((d) => {
    const it = d.data();
    contextParts.push(`Item ${it.title}: ${it.status}`);
  });
  docs.docs.forEach((d) => contextParts.push(`Document: ${d.data().name}`));
  invoices.docs.forEach((d) => {
    const inv = d.data();
    contextParts.push(`Invoice ${inv.number}: ${inv.status} ${inv.amount} ${inv.currency}`);
  });
  approvals.docs.forEach((d) => {
    const a = d.data();
    contextParts.push(`Approval ${a.title}: ${a.status}`);
  });

  const locale = meta.data()?.locale === "en" ? "en" : "es";
  const summaryBits = contextParts.slice(0, 12).join("\n");
  const answer =
    locale === "en"
      ? `Based on your portal for this project:\n${summaryBits || "No projected updates yet."}\n\n(Regarding: ${question})`
      : `Según tu portal para este proyecto:\n${summaryBits || "Aún no hay actualizaciones proyectadas."}\n\n(Sobre: ${question})`;

  await db.collection(PORTAL_EVENTS).add({
    clientId,
    uid,
    at: new Date().toISOString(),
    kind: "ask",
    refId: projectId,
    meta: { question, answer: answer.slice(0, 2000) },
  });

  return {
    answer,
    citations: contextParts.slice(0, 8),
  };
});

export const onApprovalDecided = onDocumentWritten(
  { ...region, document: `${CLIENT_APPROVALS}/{approvalId}` },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const before = event.data?.before?.data();
    const data = after.data()!;
    if (before?.status === data.status) return;
    if (data.status !== "accepted" && data.status !== "rejected") return;
    const db = getFirestore();
    const clientId = String(data.clientId || "");
    if (!clientId) return;
    await projectApprovals(db, clientId);
    await writeActivity(db, {
      clientId,
      id: `approval_${after.id}_${data.status}`,
      kind: "approval",
      title: `${data.title}: ${data.status}`,
      projectId: data.projectId,
    });
    if (data.status === "accepted" && data.refs?.milestoneId) {
      await db.doc(`milestones/${data.refs.milestoneId}`).set(
        { acceptedByClientAt: new Date().toISOString(), clientStatus: "accepted" },
        { merge: true },
      );
    }
    const client = await db.doc(`clients/${clientId}`).get();
    if (
      data.status === "accepted" &&
      data.kind === "checkpoint" &&
      client.data()?.settings?.csatAfterCheckpoint
    ) {
      const csatId = `csat_${after.id}`;
      await db.doc(`client_portal/${clientId}/csat/${csatId}`).set(
        {
          id: csatId,
          projectId: data.projectId,
          checkpointId: data.refs?.milestoneId || after.id,
          askedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    await refreshPortalMeta(db, clientId);
  },
);

export const onProjectWriteForPortal = onDocumentWritten(
  { ...region, document: "projects/{projectId}" },
  async (event) => {
    const projectId = event.params.projectId;
    const db = getFirestore();
    await projectProject(db, projectId).catch(() => null);
    await projectItems(db, projectId).catch(() => null);
    await projectDocuments(db, projectId).catch(() => null);
  },
);

export const onTaskWriteForPortal = onDocumentWritten(
  { ...region, document: "tasks/{taskId}" },
  async (event) => {
    const after = event.data?.after?.data();
    const projectId = String(after?.projectId || event.data?.before?.data()?.projectId || "");
    if (!projectId) return;
    await projectItems(getFirestore(), projectId).catch(() => null);
  },
);

export const onClientSettingsWrite = onDocumentWritten(
  { ...region, document: "clients/{clientId}" },
  async (event) => {
    const clientId = event.params.clientId;
    const db = getFirestore();
    const client = event.data?.after?.data();
    const projectIds: string[] = Array.isArray(client?.projectIds) ? client!.projectIds : [];
    for (const projectId of projectIds.slice(0, 40)) {
      await projectProject(db, projectId).catch(() => null);
      await projectItems(db, projectId).catch(() => null);
      await projectDocuments(db, projectId).catch(() => null);
    }
    await projectInvoices(db, clientId).catch(() => null);
    await projectApprovals(db, clientId).catch(() => null);
    await projectThreads(db, clientId).catch(() => null);
    await refreshPortalMeta(db, clientId).catch(() => null);
  },
);

export {
  projectProject,
  projectItems,
  projectDocuments,
  projectInvoices,
  projectApprovals,
  projectThreads,
  publishUpdate,
  writeActivity,
};
