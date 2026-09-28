import type { Firestore } from "firebase-admin/firestore";
import { documentViewZ, parseStrict } from "./schemas";
import { portalDoc } from "./paths";
import { loadClientSettings } from "./projectProject";

function str(v: unknown, fb = "") {
  return v == null ? fb : String(v);
}

function num(v: unknown, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

/** Project attachments with clientFolder → DocumentView (no durable signed URL). */
export async function projectDocuments(db: Firestore, projectId: string) {
  const projectSnap = await db.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) return { ok: false as const };
  const clientId = str(projectSnap.data()?.clientId);
  if (!clientId) return { ok: false as const };

  const { settings } = await loadClientSettings(db, clientId);
  const col = db.collection(`client_portal/${clientId}/documents`);

  if (!settings.documents) {
    const existing = await col.where("projectId", "==", projectId).get();
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return { ok: true as const, cleared: true };
  }

  const snap = await db
    .collection("attachments")
    .where("projectId", "==", projectId)
    .where("clientFolder", "==", true)
    .limit(200)
    .get()
    .catch(async () =>
      db.collection("project_documents").where("projectId", "==", projectId).where("clientFolder", "==", true).limit(200).get(),
    );

  const batch = db.batch();
  for (const doc of snap.docs) {
    const d = { id: doc.id, ...doc.data() } as Record<string, unknown>;
    const view = parseStrict(documentViewZ, {
      id: doc.id,
      projectId,
      name: str(d.name || d.title || d.fileName, "Document"),
      mime: d.mime || d.contentType ? str(d.mime || d.contentType) : undefined,
      size: d.size != null ? num(d.size) : undefined,
      publishedAt: d.publishedAt || d.createdAt ? str(d.publishedAt || d.createdAt) : undefined,
      signed: d.signed === true || d.clientSigned === true,
    });
    batch.set(db.doc(portalDoc(clientId, "documents", doc.id)), view, { merge: true });
  }
  await batch.commit();
  return { ok: true as const, count: snap.size };
}
