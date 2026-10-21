import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
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
import { PORTAL_MEMBERS, PORTAL_EVENTS, CLIENT_APPROVALS, portalDoc } from "./paths";
import { CERTO_FIRESTORE_DATABASE, getCertoFirestore } from "../firestore";
import { isPublishedDocumentPath } from "./documentAccess";

const region = { region: "us-central1" as const };
// Firebase clients authenticate inside each callable. Cloud Run must allow the
// initial HTTPS request through, including the magic-link precheck before login.
const publicPortalHttps = { ...region, invoker: "public" as const };

function requireAuth(uid?: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
}

export const portalLoginPrecheck = onCall(publicPortalHttps, async (request) => {
  const email = String(request.data?.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "email-required");
  }
  const db = getCertoFirestore();
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
  };
});

export const portalEnsureClaims = onCall(publicPortalHttps, async (request) => {
  requireAuth(request.auth?.uid);
  const uid = request.auth!.uid;
  const email = String(request.auth!.token.email || "").toLowerCase();
  const db = getCertoFirestore();
  const snap = await db.collection(PORTAL_MEMBERS).where("email", "==", email).limit(1).get();
  if (snap.empty) throw new HttpsError("permission-denied", "not-a-portal-member");
  const doc = snap.docs[0];
  const member = doc.data();
  if (member.status === "revoked") throw new HttpsError("permission-denied", "revoked");
  const clientIds = Array.isArray(member.clientIds) ? member.clientIds : [];
  const canonicalRef = db.doc(`${PORTAL_MEMBERS}/${uid}`);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(canonicalRef);
    if (existing.exists && String(existing.data()?.email || "").toLowerCase() !== email) {
      throw new HttpsError("permission-denied", "member-uid-conflict");
    }
    tx.set(canonicalRef, {
      ...member,
      uid,
      status: "active",
      lastSeenAt: new Date().toISOString(),
    }, { merge: true });
    if (doc.ref.path !== canonicalRef.path) tx.delete(doc.ref);
  });
  await getAuth().setCustomUserClaims(uid, {
    portal: true,
    workspaceId: member.workspaceId || null,
    clientIds,
  });
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
  const result = await publishUpdate(getCertoFirestore(), updateId, request.auth!.uid);
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
  const db = getCertoFirestore();
  const memberSnap = await db.doc(`${PORTAL_MEMBERS}/${request.auth!.uid}`).get();
  const member = memberSnap.data();
  if (member?.status !== "active" ||
    !Array.isArray(member.clientIds) || !member.clientIds.includes(clientId)) {
    throw new HttpsError("permission-denied", "portal-member");
  }
  const viewSnap = await db.doc(`client_portal/${clientId}/documents/${docId}`).get();
  if (!viewSnap.exists) throw new HttpsError("not-found", "document");
  const projectId = String(viewSnap.data()?.projectId || "");
  if (!projectId) throw new HttpsError("permission-denied", "project-document");
  const [clientSnap, projectSnap, attachmentSnap, projectDocumentSnap] = await Promise.all([
    db.doc(`clients/${clientId}`).get(),
    db.doc(`projects/${projectId}`).get(),
    db.doc(`attachments/${docId}`).get(),
    db.doc(`project_documents/${docId}`).get(),
  ]);
  const client = clientSnap.data();
  const project = projectSnap.data();
  if (!projectId || !client || client.portalEnabled === false ||
    client.settings?.documents === false ||
    !Array.isArray(client.projectIds) || !client.projectIds.includes(projectId) ||
    !project || project.clientId !== clientId) {
    throw new HttpsError("permission-denied", "project-document");
  }
  const source = attachmentSnap.exists ? attachmentSnap.data() : projectDocumentSnap.data();
  if (!source || source.projectId !== projectId || source.clientFolder !== true) {
    throw new HttpsError("permission-denied", "document-source");
  }
  // Never accept a caller-provided path or a long-lived URL. The source record
  // is the only authority for which object this published document represents.
  const storagePath = String(source.storagePath || "");
  const workspaceId = String(project.workspaceId || "");
  if (storagePath && !isPublishedDocumentPath(storagePath, workspaceId, projectId)) {
    throw new HttpsError("permission-denied", "document-path");
  }
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

export const createPortalRequest = onCall(publicPortalHttps, async (request) => {
  requireAuth(request.auth?.uid);
  if (request.auth!.token.portal !== true) {
    throw new HttpsError("permission-denied", "portal-only");
  }
  const clientId = String(request.data?.clientId || "");
  const serviceAreaId = String(request.data?.serviceAreaId || "").trim();
  const title = String(request.data?.title || "").trim();
  const description = String(request.data?.description || "").trim();
  const requestKind = String(request.data?.requestKind || "request");
  const clientIds: string[] = Array.isArray(request.auth!.token.clientIds)
    ? (request.auth!.token.clientIds as string[])
    : [];
  if (!clientId || !clientIds.includes(clientId) || !serviceAreaId || !title || !description ||
    title.length > 160 || description.length > 8000 ||
    !["request", "incident", "feedback"].includes(requestKind)) {
    throw new HttpsError("invalid-argument", "fields");
  }
  const db = getCertoFirestore();
  const memberSnap = await db.doc(`${PORTAL_MEMBERS}/${request.auth!.uid}`).get();
  const member = memberSnap.data();
  if (!member || member.status !== "active" || !Array.isArray(member.clientIds) ||
    !member.clientIds.includes(clientId)) {
    throw new HttpsError("permission-denied", "portal-member");
  }
  const clientSnap = await db.doc(`clients/${clientId}`).get();
  const client = clientSnap.data();
  const area = (Array.isArray(client?.serviceAreas) ? client.serviceAreas : [])
    .find((entry: Record<string, unknown>) => entry.id === serviceAreaId && entry.enabled === true);
  if (!client || client.portalEnabled === false || client.settings?.requests === false ||
    !area || !Array.isArray(area.requestKinds) || !area.requestKinds.includes(requestKind)) {
    throw new HttpsError("permission-denied", "service-area");
  }
  const projectId = String(area.projectId || "");
  const project = await db.doc(`projects/${projectId}`).get();
  if (!project.exists || String(project.data()?.clientId) !== clientId ||
    !Array.isArray(client.projectIds) || !client.projectIds.includes(projectId)) {
    throw new HttpsError("permission-denied", "project");
  }
  const projectData = project.data() || {};
  const workspaceId = String(projectData.workspaceId || client.workspaceId || "");
  const ownerId = String(projectData.userId || projectData.ownerId || projectData.createdBy || "");
  if (!workspaceId || !ownerId) throw new HttpsError("failed-precondition", "project-owner");
  const email = String(member.email || request.auth!.token.email || "").toLowerCase();
  const taskRef = db.collection("tasks").doc();
  const requestNumber = `REQ-${taskRef.id.slice(0, 8).toUpperCase()}`;
  const writes = db.batch();
  writes.set(taskRef, {
    userId: ownerId,
    createdBy: ownerId,
    workspaceId,
    projectId,
    clientId,
    serviceAreaId,
    serviceAreaName: String(area.name || "").slice(0, 80),
    requestKind,
    key: requestNumber,
    title,
    description,
    type: "ticket",
    workItemType: "ticket",
    kind: "ticket",
    status: "backlog",
    ticketStatus: "new",
    customerStatus: "Received",
    requesterEmail: email,
    requesterId: request.auth!.uid,
    requesterName: String(member.name || request.auth!.token.name || email).slice(0, 120),
    projectManagerId: projectData.projectManagerId || null,
    productOwnerId: projectData.productOwnerId || null,
    assigneeIds: [],
    relatedWorkIds: [],
    source: "request_portal",
    sourceType: "form",
    channel: "portal",
    clientVisible: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  writes.set(db.doc(`user_notifications/request_${taskRef.id}`), {
    userId: ownerId, workspaceId, type: "request", taskId: taskRef.id, taskTitle: title,
    preview: description.slice(0, 140), fromName: String(member.name || email),
    read: false, createdAt: FieldValue.serverTimestamp(),
  });
  writes.set(db.doc(portalDoc(clientId, "items", taskRef.id)), {
    id: taskRef.id, projectId, title, description, status: "Received", ticketStatus: "new",
    kind: "request", requestNumber, requestKind, serviceAreaId,
    createdAt: new Date().toISOString(),
  });
  await writes.commit();
  await Promise.allSettled([
    writeActivity(db, { clientId, id: `request_${taskRef.id}`, kind: "request", title,
      body: description.slice(0, 280), projectId }),
    db.collection(PORTAL_EVENTS).add({ clientId, uid: request.auth!.uid,
      at: new Date().toISOString(), kind: "request_created", refId: taskRef.id }),
  ]);
  return { ok: true, taskId: taskRef.id, requestNumber };
});

export const replyPortalRequest = onCall(publicPortalHttps, async (request) => {
  requireAuth(request.auth?.uid);
  if (request.auth!.token.portal !== true) throw new HttpsError("permission-denied", "portal-only");
  const clientId = String(request.data?.clientId || "");
  const ticketId = String(request.data?.ticketId || "");
  const body = String(request.data?.body || "").trim();
  if (!clientId || !ticketId || !body || body.length > 4000) throw new HttpsError("invalid-argument", "fields");
  const db = getCertoFirestore();
  const member = (await db.doc(`${PORTAL_MEMBERS}/${request.auth!.uid}`).get()).data();
  if (!member || member.status !== "active" || !Array.isArray(member.clientIds) || !member.clientIds.includes(clientId)) {
    throw new HttpsError("permission-denied", "portal-member");
  }
  const taskRef = db.doc(`tasks/${ticketId}`);
  const task = (await taskRef.get()).data();
  if (!task || task.clientId !== clientId || task.workItemType !== "ticket" || task.clientVisible !== true ||
    task.ticketStatus === "closed") throw new HttpsError("permission-denied", "ticket");
  const now = new Date().toISOString();
  const conversationId = `task_${ticketId}`;
  const convRef = db.doc(`conversations/${conversationId}`);
  let createdConversation = false;
  try {
    await convRef.create({
      workspaceId: task.workspaceId, type: "item_thread", title: String(task.title || "Request").slice(0, 120),
      anchor: { type: "task", id: ticketId, label: String(task.title || "Request") },
      participantIds: [task.userId], agentIds: [], guestIds: [], isPrivate: false, status: "active",
      lastMessageAt: null, messageCount: 0, pinnedMessageIds: [], createdBy: task.userId,
      createdAt: now, updatedAt: now,
    });
    createdConversation = true;
  } catch (error) {
    const code = (error as { code?: number | string }).code;
    if (code !== 6 && code !== "already-exists") throw error;
  }
  if (createdConversation) {
    await db.doc(`conversation_participants/${conversationId}_${task.userId}`).set({
      id: `${conversationId}_${task.userId}`, workspaceId: task.workspaceId, conversationId,
      kind: "user", userId: task.userId, displayName: "Project team", roleInChat: "owner",
      status: "active", unreadCount: 0, joinedAt: now, addedBy: task.userId,
    });
  }
  const messageRef = db.collection("conversation_messages").doc();
  const replyWrites = db.batch();
  replyWrites.set(messageRef, {
    workspaceId: task.workspaceId, conversationId, threadId: null,
    senderType: "guest", senderId: request.auth!.uid,
    senderName: String(member.name || member.email || "Client").slice(0, 120),
    kind: "text", text: body, mentions: { userIds: [], agentIds: [], itemIds: [], projectIds: [], recordRefs: [] },
    attachments: [], card: null, reactions: {}, visibility: "external", channel: "app",
    status: "sent", replyCount: 0, model: null, searchText: body.toLowerCase(),
    createdAt: now, updatedAt: now,
  });
  replyWrites.set(db.doc(`user_notifications/request_reply_${messageRef.id}`), {
    userId: task.userId, workspaceId: task.workspaceId, type: "request_reply",
    taskId: ticketId, taskTitle: String(task.title || "Request"),
    preview: body.slice(0, 140), fromName: String(member.name || member.email || "Client"),
    read: false, createdAt: FieldValue.serverTimestamp(),
  });
  replyWrites.set(taskRef, {
    status: "blocked", ticketStatus: "waiting", waitingReason: "Waiting for engineering",
    customerStatus: "Waiting on our side", updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await replyWrites.commit();
  return { ok: true, messageId: messageRef.id };
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
  const db = getCertoFirestore();
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
  { ...region, database: CERTO_FIRESTORE_DATABASE, document: `${CLIENT_APPROVALS}/{approvalId}` },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const before = event.data?.before?.data();
    const data = after.data()!;
    if (before?.status === data.status) return;
    if (data.status !== "accepted" && data.status !== "rejected") return;
    const db = getCertoFirestore();
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
  { ...region, database: CERTO_FIRESTORE_DATABASE, document: "projects/{projectId}" },
  async (event) => {
    const projectId = event.params.projectId;
    const db = getCertoFirestore();
    await projectProject(db, projectId).catch(() => null);
    await projectItems(db, projectId).catch(() => null);
    await projectDocuments(db, projectId).catch(() => null);
  },
);

export const onTaskWriteForPortal = onDocumentWritten(
  { ...region, database: CERTO_FIRESTORE_DATABASE, document: "tasks/{taskId}" },
  async (event) => {
    const after = event.data?.after?.data();
    const previousProjectId = String(event.data?.before?.data()?.projectId || "");
    const projectId = String(after?.projectId || "");
    const db = getCertoFirestore();
    if (previousProjectId && previousProjectId !== projectId) {
      await projectItems(db, previousProjectId, event.params.taskId);
    }
    if (projectId) await projectItems(db, projectId, event.params.taskId);
  },
);

export const onClientSettingsWrite = onDocumentWritten(
  { ...region, database: CERTO_FIRESTORE_DATABASE, document: "clients/{clientId}" },
  async (event) => {
    const clientId = event.params.clientId;
    const db = getCertoFirestore();
    const client = event.data?.after?.data();
    const previous = event.data?.before?.data();
    if (client && previous) {
      const changed = Object.keys({ ...previous, ...client }).filter((key) =>
        JSON.stringify(previous[key]) !== JSON.stringify(client[key]));
      if (changed.length && changed.every((key) => key === "serviceAreas" || key === "updatedAt")) {
        await refreshPortalMeta(db, clientId);
        return;
      }
    }
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
