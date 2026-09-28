import type { Firestore } from "firebase-admin/firestore";
import { invoiceViewZ, parseStrict } from "./schemas";
import { portalDoc } from "./paths";
import { loadClientSettings } from "./projectProject";

function str(v: unknown, fb = "") {
  return v == null ? fb : String(v);
}

function num(v: unknown, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

export async function projectInvoices(db: Firestore, clientId: string) {
  const { client, settings } = await loadClientSettings(db, clientId);
  if (!client) return { ok: false as const };
  if (!settings.invoices) {
    const existing = await db.collection(`client_portal/${clientId}/invoices`).get();
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return { ok: true as const, cleared: true };
  }

  const projectIds = Array.isArray(client.projectIds)
    ? (client.projectIds as string[])
    : [];
  const batch = db.batch();
  let count = 0;

  const byProject = projectIds.length
    ? await db.collection("invoice_documents").where("projectId", "in", projectIds.slice(0, 10)).limit(100).get().catch(() => null)
    : null;
  const byClientName = await db
    .collection("invoice_documents")
    .where("clientName", "==", str(client.name))
    .limit(100)
    .get()
    .catch(() => null);

  const seen = new Set<string>();
  const docs = [...(byProject?.docs || []), ...(byClientName?.docs || [])];
  for (const doc of docs) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const inv = doc.data();
    if (inv.revoked) continue;
    // Strip internal cost/margin — never copy adminNote / settlement internals beyond status
    const view = parseStrict(invoiceViewZ, {
      id: doc.id,
      projectId: inv.projectId ? str(inv.projectId) : undefined,
      number: str(inv.invoiceNumber || inv.number || doc.id),
      amount: num(inv.amount),
      currency: str(inv.currency || "USD"),
      issueDate: inv.issueDate ? str(inv.issueDate) : undefined,
      dueDate: inv.dueDate ? str(inv.dueDate) : undefined,
      status: str(inv.status, "sent"),
      paymentStatus: inv.paymentStatus ? str(inv.paymentStatus) : undefined,
      paymentLink: inv.paymentLink ? str(inv.paymentLink) : undefined,
      approvedAt: inv.approvedAt ? str(inv.approvedAt) : undefined,
    });
    batch.set(db.doc(portalDoc(clientId, "invoices", doc.id)), view, { merge: true });
    count += 1;
  }
  await batch.commit();
  return { ok: true as const, count };
}
