import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/** Sequential INV-NNNN per workspace via counters/{workspaceId}. */
export const allocateInvoiceNumber = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  const workspaceId = String(request.data?.workspaceId || "");
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId required");
  const db = getFirestore();
  const counterRef = db.doc(`counters/${workspaceId}`);
  const number = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists ? Number(snap.data()?.invoiceSeq || 0) : 0) + 1;
    tx.set(counterRef, { invoiceSeq: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return `INV-${String(next).padStart(4, "0")}`;
  });
  return { number };
});

/** Daily 00:10 — flip pending/sent past dueDate to overdue. */
export const flipOverdueInvoices = onSchedule(
  { schedule: "10 0 * * *", region: "us-central1", timeZone: "UTC" },
  async () => {
    const db = getFirestore();
    const today = new Date().toISOString().slice(0, 10);
    const snap = await db
      .collection("invoices")
      .where("status", "in", ["pending", "sent"])
      .limit(500)
      .get();
    const batch = db.batch();
    let n = 0;
    for (const docSnap of snap.docs) {
      const due = String(docSnap.data().dueDate || "");
      if (due && due < today) {
        batch.update(docSnap.ref, {
          status: "overdue",
          updatedAt: FieldValue.serverTimestamp(),
        });
        n += 1;
      }
    }
    if (n) await batch.commit();
  },
);

/** Monthly day-1 + on-demand generation from projectBilling. */
export const generateProjectInvoices = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  const workspaceId = String(request.data?.workspaceId || "");
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId required");
  const db = getFirestore();
  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);

  const billingSnap = await db
    .collection("projectBilling")
    .where("workspaceId", "==", workspaceId)
    .where("autoGenerate", "==", true)
    .get();

  let created = 0;
  for (const b of billingSnap.docs) {
    const data = b.data() as {
      recurringAmount?: number;
      currency?: string;
      billingDay?: number;
      termsDays?: number;
      clientId?: string;
      deliveryEntity?: string;
      projectId?: string;
      projectName?: string;
    };
    const projectId = data.projectId || b.id;
    const existing = await db
      .collection("invoices")
      .where("workspaceId", "==", workspaceId)
      .where("projectId", "==", projectId)
      .where("periodStart", "==", periodStart)
      .limit(1)
      .get();
    if (!existing.empty) continue;

    const counterRef = db.doc(`counters/${workspaceId}`);
    const number = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const next = (snap.exists ? Number(snap.data()?.invoiceSeq || 0) : 0) + 1;
      tx.set(counterRef, { invoiceSeq: next }, { merge: true });
      return `INV-${String(next).padStart(4, "0")}`;
    });

    const billingDay = Math.min(28, Math.max(1, data.billingDay || 1));
    const terms = data.termsDays ?? 30;
    const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), billingDay));
    due.setUTCDate(due.getUTCDate() + terms);
    const dueDate = due.toISOString().slice(0, 10);

    await db.collection("invoices").add({
      workspaceId,
      number,
      projectId,
      clientId: data.clientId || "",
      deliveryEntity: data.deliveryEntity || "",
      type: "recurring",
      description: `Monthly recurring · ${data.projectName || projectId}`,
      amount: Number(data.recurringAmount) || 0,
      currency: data.currency || "USD",
      issueDate: periodStart,
      dueDate,
      periodStart,
      periodEnd,
      status: "draft",
      reminderCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });
    created += 1;
  }
  return { created, periodStart };
});
