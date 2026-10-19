import type { Firestore } from "firebase-admin/firestore";
import { itemViewZ, parseStrict } from "./schemas";
import { portalDoc } from "./paths";
import { loadClientSettings } from "./projectProject";

function str(v: unknown, fb = "") {
  return v == null ? fb : String(v);
}

export async function projectItems(db: Firestore, projectId: string, taskId?: string) {
  const projectSnap = await db.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) return { ok: false as const };
  const project = projectSnap.data() || {};
  const clientId = str(project.clientId);
  if (!clientId) return { ok: false as const };

  const { settings } = await loadClientSettings(db, clientId);
  if (!settings.clientVisibleItems && !settings.requests) {
    if (taskId) {
      await db.doc(portalDoc(clientId, "items", taskId)).delete();
      return { ok: true as const, cleared: true };
    }
    const existing = await db.collection(`client_portal/${clientId}/items`).where("projectId", "==", projectId).get();
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return { ok: true as const, cleared: true };
  }

  const membersSnap = await db
    .collection("portal_members")
    .where("clientIds", "array-contains", clientId)
    .limit(100)
    .get()
    .catch(() => null);
  const memberEmails = new Set(
    (membersSnap?.docs || []).map((d) => str(d.data().email).toLowerCase()).filter(Boolean),
  );

  const taskDocs = taskId
    ? [(await db.doc(`tasks/${taskId}`).get())].filter((snap) => snap.exists)
    : (await db.collection("tasks").where("projectId", "==", projectId).limit(500).get()).docs;
  const batch = db.batch();
  if (taskId && taskDocs.length === 0) {
    batch.delete(db.doc(portalDoc(clientId, "items", taskId)));
    await batch.commit();
    return { ok: true as const, written: 0 };
  }
  let written = 0;
  for (const doc of taskDocs) {
    const t = { id: doc.id, ...doc.data() } as Record<string, unknown>;
    if (str(t.projectId) !== projectId) {
      batch.delete(db.doc(portalDoc(clientId, "items", doc.id)));
      continue;
    }
    const requester = str(t.requesterEmail).toLowerCase();
    const isTicket = Boolean(t.ticketStatus || requester);
    const visible =
      t.clientVisible === true || (isTicket && requester && memberEmails.has(requester));
    if (!visible) {
      batch.delete(db.doc(portalDoc(clientId, "items", doc.id)));
      continue;
    }
    if (isTicket && !settings.requests) {
      batch.delete(db.doc(portalDoc(clientId, "items", doc.id)));
      continue;
    }
    if (!isTicket && !settings.clientVisibleItems) {
      batch.delete(db.doc(portalDoc(clientId, "items", doc.id)));
      continue;
    }
    const sla =
      t.sla && typeof t.sla === "object" ? (t.sla as Record<string, unknown>) : null;
    const view = parseStrict(itemViewZ, {
      id: doc.id,
      projectId,
      title: str(t.title || t.name, "Item"),
      description: isTicket && t.source === "request_portal" ? str(t.description).slice(0, 8000) : undefined,
      status: str(t.customerStatus || t.status || t.ticketStatus, "open"),
      ticketStatus: isTicket ? str(t.ticketStatus || "new") : undefined,
      dueDate: t.dueDate ? str(t.dueDate) : undefined,
      lastPublicUpdate: t.lastPublicUpdate ? str(t.lastPublicUpdate) : undefined,
      kind: isTicket ? "request" : "work",
      requestNumber: t.key || t.requestNumber ? str(t.key || t.requestNumber) : undefined,
      requestKind: t.requestKind === "incident" || t.requestKind === "feedback" ? t.requestKind : isTicket ? "request" : undefined,
      serviceAreaId: t.serviceAreaId ? str(t.serviceAreaId) : undefined,
      createdAt: t.createdAt && typeof t.createdAt === "object" && "toDate" in t.createdAt && typeof t.createdAt.toDate === "function"
        ? (t.createdAt.toDate() as Date).toISOString() : undefined,
      sla: sla
        ? {
            dueAt: sla.dueAt || sla.nextUpdateDueAt ? str(sla.dueAt || sla.nextUpdateDueAt) : undefined,
            breached: Boolean(sla.breached),
          }
        : undefined,
    });
    batch.set(db.doc(portalDoc(clientId, "items", doc.id)), view, { merge: true });
    written += 1;
  }
  await batch.commit();
  return { ok: true as const, written };
}
