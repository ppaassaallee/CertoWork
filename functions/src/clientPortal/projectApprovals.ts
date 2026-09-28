import type { Firestore } from "firebase-admin/firestore";
import { approvalViewZ, parseStrict } from "./schemas";
import { portalDoc } from "./paths";

function str(v: unknown, fb = "") {
  return v == null ? fb : String(v);
}

export async function projectApprovals(db: Firestore, clientId: string) {
  const snap = await db
    .collection("client_approvals")
    .where("clientId", "==", clientId)
    .limit(200)
    .get();
  const batch = db.batch();
  for (const doc of snap.docs) {
    const a = doc.data();
    const view = parseStrict(approvalViewZ, {
      id: doc.id,
      projectId: str(a.projectId),
      kind: str(a.kind, "question"),
      title: str(a.title),
      description: a.description ? str(a.description) : undefined,
      dueAt: a.dueAt ? str(a.dueAt) : undefined,
      status: str(a.status, "pending"),
      decidedBy: a.decidedBy ? str(a.decidedBy) : undefined,
      decidedAt: a.decidedAt ? str(a.decidedAt) : undefined,
      comment: a.comment ? str(a.comment) : undefined,
      requestedAt: str(a.requestedAt || a.createdAt || new Date().toISOString()),
    });
    batch.set(db.doc(portalDoc(clientId, "approvals", doc.id)), view, { merge: true });
  }
  await batch.commit();
  return { ok: true as const, count: snap.size };
}
