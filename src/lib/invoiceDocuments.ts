import { financeAmount, normalizedFinancePeriods } from "./projectFinance";

/** Ariba-inspired invoice processing statuses. */
export const INVOICE_STATUSES = [
  "billed",
  "sent",
  "pending_approval",
  "approved",
  "paid",
  "rejected",
  "void",
  "exception",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_PAYMENT_STATUSES = [
  "unpaid",
  "partial",
  "paid",
  "overdue",
] as const;
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export const INVOICE_EXCEPTION_CODES = [
  "price_mismatch",
  "quantity_mismatch",
  "missing_receipt",
  "missing_po",
  "duplicate",
  "tax",
  "other",
] as const;
export type InvoiceExceptionCode = (typeof INVOICE_EXCEPTION_CODES)[number];

export const INVOICE_QUEUE_FILTERS = [
  "ready",
  "open",
  "billed",
  "sent",
  "pending_approval",
  "approved",
  "paid",
  "rejected",
  "exception",
  "overdue",
  "void",
  "all",
] as const;
export type InvoiceQueueFilter = (typeof INVOICE_QUEUE_FILTERS)[number];

export type InvoiceDocument = {
  id: string;
  userId?: string;
  workspaceId?: string;
  createdBy?: string;
  shareToken?: string;
  projectId?: string;
  periodId?: string;
  entryId?: string;
  title?: string;
  description?: string;
  clientName?: string;
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  status?: InvoiceStatus | string;
  paymentStatus?: InvoicePaymentStatus | string;
  exceptionCode?: InvoiceExceptionCode | string | null;
  exceptionNote?: string;
  rejectionReason?: string;
  adminNote?: string;
  clientNote?: string;
  remittanceRef?: string;
  settledAmount?: number;
  settledDate?: string;
  revoked?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  clientUpdatedAt?: unknown;
};

export type PendingInvoiceLine = {
  projectId: string;
  projectTitle: string;
  clientName: string;
  periodId: string;
  periodLabel: string;
  entryId: string;
  title: string;
  amount: number;
  currency: string;
  dueDate: string;
  issueDate: string;
  invoiceNumber: string;
  accountingMonth: string;
};

export function isInvoiceStatus(value?: string | null): value is InvoiceStatus {
  return INVOICE_STATUSES.includes(String(value || "") as InvoiceStatus);
}

export function invoiceStatusLabel(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (value === "billed") return "Billed";
  if (value === "sent") return "Sent";
  if (value === "pending_approval") return "Pending approval";
  if (value === "approved") return "Approved";
  if (value === "paid") return "Paid";
  if (value === "rejected") return "Rejected";
  if (value === "void") return "Void";
  if (value === "exception") return "Problem";
  return "Unknown";
}

export function invoicePaymentLabel(status?: string | null) {
  const value = String(status || "unpaid").toLowerCase();
  if (value === "paid") return "Paid";
  if (value === "partial") return "Partial";
  if (value === "overdue") return "Overdue";
  return "Unpaid";
}

export function invoiceExceptionLabel(code?: string | null) {
  const value = String(code || "").toLowerCase();
  if (value === "price_mismatch") return "Price mismatch";
  if (value === "quantity_mismatch") return "Quantity mismatch";
  if (value === "missing_receipt") return "Missing receipt";
  if (value === "missing_po") return "Missing PO";
  if (value === "duplicate") return "Duplicate invoice";
  if (value === "tax") return "Tax exception";
  if (value === "other") return "Other";
  return "Exception";
}

export function invoicePortalPath(token: string) {
  return `/invoice/${encodeURIComponent(token)}`;
}

export function nextInvoiceNumber(existing: string[], at = new Date()) {
  const stamp = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${stamp}-`;
  const used = existing
    .map((value) => String(value || "").toUpperCase())
    .filter((value) => value.startsWith(prefix))
    .map((value) => Number(value.slice(prefix.length)))
    .filter((value) => Number.isFinite(value));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function isOpenInvoice(status?: string | null) {
  return ["billed", "sent", "pending_approval", "approved", "exception"].includes(
    String(status || "").toLowerCase(),
  );
}

export function isTerminalInvoice(status?: string | null) {
  return ["paid", "void"].includes(String(status || "").toLowerCase());
}

export function isInvoiceOverdue(
  invoice: Pick<InvoiceDocument, "dueDate" | "status" | "paymentStatus">,
  now = new Date(),
) {
  if (!invoice.dueDate || isTerminalInvoice(invoice.status) || invoice.status === "rejected") {
    return false;
  }
  if (String(invoice.paymentStatus || "") === "paid") return false;
  const due = Date.parse(String(invoice.dueDate).slice(0, 10));
  if (!Number.isFinite(due)) return false;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return due < today;
}

export function financeActionsForStatus(status?: string | null): InvoiceStatus[] {
  const value = isInvoiceStatus(status) ? status : "billed";
  if (value === "billed") return ["sent", "exception", "void"];
  if (value === "sent") return ["pending_approval", "approved", "rejected", "exception", "void"];
  if (value === "pending_approval") return ["approved", "rejected", "exception", "void"];
  if (value === "approved") return ["paid", "exception", "void"];
  if (value === "exception") return ["sent", "pending_approval", "approved", "rejected", "void"];
  if (value === "rejected") return ["billed", "void"];
  return [];
}

export function clientActionsForStatus(status?: string | null): InvoiceStatus[] {
  if (!["sent", "pending_approval", "approved", "exception"].includes(String(status || ""))) {
    return [];
  }
  return ["paid", "rejected", "exception"];
}

export function canTransitionInvoice(
  from?: string | null,
  to?: string | null,
  actor: "finance" | "client" = "finance",
) {
  if (!isInvoiceStatus(to)) return false;
  const allowed =
    actor === "client" ? clientActionsForStatus(from) : financeActionsForStatus(from);
  return allowed.includes(to);
}

export function paymentStatusForInvoice(
  status: InvoiceStatus,
  settledAmount = 0,
  amount = 0,
  overdue = false,
): InvoicePaymentStatus {
  if (status === "paid") return "paid";
  if (status === "void" || status === "rejected") return "unpaid";
  if (settledAmount > 0 && amount > 0 && settledAmount < amount) return "partial";
  if (overdue) return "overdue";
  return "unpaid";
}

export function financeEntryPatchForInvoice(invoice: InvoiceDocument) {
  const status = isInvoiceStatus(invoice.status) ? invoice.status : "billed";
  if (status === "void") {
    return {
      invoiceStatus: "void",
      financialStatus: "not_billed",
      paymentStatus: "void",
      referenceNumber: invoice.invoiceNumber || "",
    };
  }
  if (status === "paid") {
    return {
      invoiceStatus: "invoiced",
      financialStatus: "paid",
      paymentStatus: "paid",
      settledAmount: Number(invoice.settledAmount || invoice.amount || 0),
      settledDate: invoice.settledDate || new Date().toISOString().slice(0, 10),
      referenceNumber: invoice.invoiceNumber || "",
    };
  }
  if (status === "rejected" || status === "exception") {
    return {
      invoiceStatus: "disputed",
      financialStatus: "disputed",
      paymentStatus: invoice.paymentStatus === "partial" ? "partial" : "unpaid",
      referenceNumber: invoice.invoiceNumber || "",
    };
  }
  return {
    invoiceStatus: "invoiced",
    financialStatus: "billed",
    paymentStatus:
      Number(invoice.settledAmount || 0) > 0 &&
      Number(invoice.settledAmount || 0) < Number(invoice.amount || 0)
        ? "partial"
        : "unpaid",
    referenceNumber: invoice.invoiceNumber || "",
    issueDate: invoice.issueDate || "",
    dueDate: invoice.dueDate || "",
  };
}

export function pendingInvoiceLines(
  projects: Array<Record<string, unknown>>,
  invoices: InvoiceDocument[] = [],
): PendingInvoiceLine[] {
  const pushed = new Set(
    invoices
      .filter((invoice) => invoice.projectId && invoice.entryId && invoice.status !== "void")
      .map((invoice) => `${invoice.projectId}:${invoice.entryId}`),
  );
  return projects.flatMap((project) => {
    const projectId = String(project.id || "");
    const projectTitle = String(project.title || project.name || "Untitled project");
    const clientName = String(project.clientEntity || project.client || "Internal");
    const currency = String(project.currency || "USD");
    return normalizedFinancePeriods(project).flatMap((period) =>
      period.entries
        .filter((entry) => entry.direction === "revenue")
        .filter((entry) => entry.invoiceStatus !== "void" && entry.paymentStatus !== "void")
        .filter((entry) => entry.paymentStatus !== "paid")
        .filter((entry) => !pushed.has(`${projectId}:${entry.id}`))
        .map((entry) => ({
          projectId,
          projectTitle,
          clientName,
          periodId: period.id,
          periodLabel: period.label,
          entryId: entry.id,
          title: entry.description || "Invoice",
          amount: financeAmount(entry),
          currency: period.currency || currency,
          dueDate: entry.dueDate || "",
          issueDate: entry.issueDate || entry.transactionDate || "",
          invoiceNumber: entry.referenceNumber || "",
          accountingMonth: entry.accountingMonth || "",
        })),
    );
  });
}

export function invoiceQueueCounts(
  invoices: InvoiceDocument[],
  pendingCount: number,
  now = new Date(),
) {
  const open = invoices.filter((invoice) => isOpenInvoice(invoice.status));
  return {
    ready: pendingCount,
    open: open.length,
    billed: invoices.filter((invoice) => invoice.status === "billed").length,
    sent: invoices.filter((invoice) => invoice.status === "sent").length,
    pending_approval: invoices.filter((invoice) => invoice.status === "pending_approval").length,
    approved: invoices.filter((invoice) => invoice.status === "approved").length,
    paid: invoices.filter((invoice) => invoice.status === "paid").length,
    rejected: invoices.filter((invoice) => invoice.status === "rejected").length,
    exception: invoices.filter((invoice) => invoice.status === "exception").length,
    overdue: invoices.filter((invoice) => isInvoiceOverdue(invoice, now)).length,
    void: invoices.filter((invoice) => invoice.status === "void").length,
    all: invoices.length,
  };
}

export function filterInvoiceQueue(
  invoices: InvoiceDocument[],
  filter: InvoiceQueueFilter,
  now = new Date(),
) {
  if (filter === "ready") return [];
  if (filter === "all") return invoices;
  if (filter === "open") return invoices.filter((invoice) => isOpenInvoice(invoice.status));
  if (filter === "overdue") return invoices.filter((invoice) => isInvoiceOverdue(invoice, now));
  return invoices.filter((invoice) => String(invoice.status || "") === filter);
}

export function applyInvoiceToFinancePeriods(
  project: Record<string, unknown> | null | undefined,
  invoice: InvoiceDocument,
) {
  const patch = financeEntryPatchForInvoice(invoice);
  return normalizedFinancePeriods(project).map((period) =>
    period.id === invoice.periodId
      ? {
          ...period,
          entries: period.entries.map((entry) =>
            entry.id === invoice.entryId ? { ...entry, ...patch } : entry,
          ),
        }
      : period,
  );
}
