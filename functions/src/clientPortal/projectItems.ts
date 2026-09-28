import type { Firestore } from "firebase-admin/firestore";
import { itemViewZ, parseStrict } from "./schemas";
import { portalDoc } from "./paths";
import { loadClientSettings } from "./projectProject";

function str(v: unknown, fb = "") {
  return v == null ? fb : String(v);
}

export async function projectItems(db: Firestore, projectId: string) {
  const projectSnap = await db.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) return { ok: false as const };
  const project = projectSnap.data() || {};
  const clientId = str(project.clientId);
  if (!clientId) return { ok: false as const };

  const { settings } = await loadClientSettings(db, clientId);
  if (!settings.clientVisibleItems && !settings.requests) {
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

  const tasksSnap = await db.collection("tasks").where("projectId", "==", projectId).limit(500).get();
  const batch = db.batch();
  let written = 0;
  for (const doc of tasksSnap.docs) {
    const t = { id: doc.id, ...doc.data() } as Record<string, unknown>;
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
      status: str(t.customerStatus || t.status || t.ticketStatus, "open"),
      dueDate: t.dueDate ? str(t.dueDate) : undefined,
      lastPublicUpdate: t.lastPublicUpdate ? str(t.lastPublicUpdate) : undefined,
      kind: isTicket ? "request" : "work",
      requestNumber: t.key || t.requestNumber ? str(t.key || t.requestNumber) : undefined,
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
