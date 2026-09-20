import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
  orderBy,
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { app, db } from "../../lib/firebase";
import { deriveInvoiceStatus, type Invoice, type InvoiceStatus } from "./types";

export async function listInvoices(workspaceId: string): Promise<Invoice[]> {
  try {
    const q = query(
      collection(db, "invoices"),
      where("workspaceId", "==", workspaceId),
      orderBy("dueDate", "asc"),
      limit(200),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = { id: d.id, ...(d.data() as Omit<Invoice, "id">) };
      return { ...raw, status: deriveInvoiceStatus(raw) };
    });
  } catch {
    // Fallback without composite index
    try {
      const snap = await getDocs(
        query(collection(db, "invoices"), where("workspaceId", "==", workspaceId), limit(200)),
      );
      return snap.docs
        .map((d) => {
          const raw = { id: d.id, ...(d.data() as Omit<Invoice, "id">) };
          return { ...raw, status: deriveInvoiceStatus(raw) };
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    } catch {
      return [];
    }
  }
}

export async function allocateNumber(workspaceId: string): Promise<string> {
  try {
    const fn = httpsCallable(getFunctions(app, "us-central1"), "allocateInvoiceNumber");
    const res = await fn({ workspaceId });
    return String((res.data as { number?: string })?.number || `INV-TEMP-${Date.now()}`);
  } catch {
    return `INV-DRAFT-${Date.now().toString(36).toUpperCase()}`;
  }
}

export async function createInvoice(
  partial: Omit<Invoice, "id" | "number" | "reminderCount" | "createdAt" | "updatedAt"> & {
    number?: string;
  },
): Promise<string> {
  const number = partial.number || (await allocateNumber(partial.workspaceId));
  const ref = await addDoc(collection(db, "invoices"), {
    ...partial,
    number,
    reminderCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  extra: Record<string, unknown> = {},
) {
  await updateDoc(doc(db, "invoices", id), {
    status,
    updatedAt: serverTimestamp(),
    ...extra,
    ...(status === "paid" ? { paidAt: serverTimestamp() } : {}),
    ...(status === "sent" ? { sentAt: serverTimestamp() } : {}),
  });
}

export async function markReminderSent(id: string, count: number) {
  await updateDoc(doc(db, "invoices", id), {
    reminderSentAt: serverTimestamp(),
    reminderCount: count + 1,
    updatedAt: serverTimestamp(),
  });
}

export function filterByTab(invoices: Invoice[], tab: string, today = new Date().toISOString().slice(0, 10)) {
  const in14 = new Date();
  in14.setDate(in14.getDate() + 14);
  const until = in14.toISOString().slice(0, 10);
  switch (tab) {
    case "upcoming":
      return invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.dueDate >= today && i.dueDate <= until);
    case "pending":
      return invoices.filter((i) => i.status === "pending" || i.status === "sent" || i.status === "draft");
    case "overdue":
      return invoices.filter((i) => i.status === "overdue");
    case "paid":
      return invoices.filter((i) => i.status === "paid");
    default:
      return invoices;
  }
}

export function outstandingSum(invoices: Invoice[]) {
  return invoices
    .filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft")
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
}
