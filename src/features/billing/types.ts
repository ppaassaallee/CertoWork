export type InvoiceStatus = "draft" | "pending" | "sent" | "paid" | "overdue" | "cancelled";

export type Invoice = {
  id: string;
  workspaceId: string;
  number: string;
  projectId: string;
  clientId: string;
  deliveryEntity: string;
  type: "recurring" | "one-time";
  description: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  periodStart?: string;
  periodEnd?: string;
  status: InvoiceStatus;
  paidAt?: unknown | null;
  sentAt?: unknown | null;
  reminderSentAt?: unknown | null;
  reminderCount: number;
  notes?: string;
  attachments?: Array<{ name: string; url: string }>;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  clientName?: string;
  projectName?: string;
};

export type ProjectBilling = {
  projectId: string;
  workspaceId: string;
  recurringAmount: number;
  currency: string;
  billingDay: number;
  termsDays: number;
  oneTime: Array<{ label: string; amount: number; dueDate: string }>;
  autoGenerate: boolean;
  clientId: string;
  deliveryEntity: string;
  projectName?: string;
};

/** Derive overdue on read so UI is never stale. */
export function deriveInvoiceStatus(inv: Invoice, today = new Date().toISOString().slice(0, 10)): InvoiceStatus {
  if (inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") return inv.status;
  if (inv.dueDate && inv.dueDate < today && (inv.status === "pending" || inv.status === "sent" || inv.status === "overdue")) {
    return "overdue";
  }
  return inv.status;
}

export function daysOverdue(dueDate: string, today = new Date().toISOString().slice(0, 10)): number {
  const a = new Date(dueDate + "T12:00:00").getTime();
  const b = new Date(today + "T12:00:00").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}
