/** Billing / payment status chips for portfolio Financials analyst sheet. */

export const FINANCE_BILLING_STATUSES = [
  "not_billed",
  "billed",
  "paid",
  "disputed",
] as const;

export type FinanceBillingStatus = (typeof FINANCE_BILLING_STATUSES)[number];

export const FINANCE_VENDOR_PAY_STATUSES = [
  "unpaid",
  "partial",
  "paid",
  "overdue",
] as const;

export type FinanceVendorPayStatus = (typeof FINANCE_VENDOR_PAY_STATUSES)[number];

export const financeBillingStatusLabels: Record<FinanceBillingStatus, string> = {
  not_billed: "Not billed",
  billed: "Billed",
  paid: "Paid",
  disputed: "Disputed",
};

export const financeVendorPayStatusLabels: Record<FinanceVendorPayStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

export const FINANCE_BILLING_STATUS_COLORS: Record<
  FinanceBillingStatus,
  { bg: string; fg: string; border: string }
> = {
  not_billed: {
    bg: "color-mix(in srgb, #8a93a3 14%, var(--surface-0, #fff))",
    fg: "#4b5563",
    border: "color-mix(in srgb, #8a93a3 35%, var(--border, #d0d5dd))",
  },
  billed: {
    bg: "color-mix(in srgb, #2f6fed 14%, var(--surface-0, #fff))",
    fg: "#1d4fbf",
    border: "color-mix(in srgb, #2f6fed 35%, var(--border, #d0d5dd))",
  },
  paid: {
    bg: "color-mix(in srgb, #1f9d63 16%, var(--surface-0, #fff))",
    fg: "#0f6b42",
    border: "color-mix(in srgb, #1f9d63 35%, var(--border, #d0d5dd))",
  },
  disputed: {
    bg: "color-mix(in srgb, #c44b2f 14%, var(--surface-0, #fff))",
    fg: "#9a2f1a",
    border: "color-mix(in srgb, #c44b2f 35%, var(--border, #d0d5dd))",
  },
};

export const FINANCE_VENDOR_PAY_STATUS_COLORS: Record<
  FinanceVendorPayStatus,
  { bg: string; fg: string; border: string }
> = {
  unpaid: {
    bg: "color-mix(in srgb, #c47a12 14%, var(--surface-0, #fff))",
    fg: "#8a5400",
    border: "color-mix(in srgb, #c47a12 35%, var(--border, #d0d5dd))",
  },
  partial: {
    bg: "color-mix(in srgb, #7a3af0 12%, var(--surface-0, #fff))",
    fg: "#5b23c7",
    border: "color-mix(in srgb, #7a3af0 32%, var(--border, #d0d5dd))",
  },
  paid: {
    bg: "color-mix(in srgb, #1f9d63 16%, var(--surface-0, #fff))",
    fg: "#0f6b42",
    border: "color-mix(in srgb, #1f9d63 35%, var(--border, #d0d5dd))",
  },
  overdue: {
    bg: "color-mix(in srgb, #c44b2f 14%, var(--surface-0, #fff))",
    fg: "#9a2f1a",
    border: "color-mix(in srgb, #c44b2f 35%, var(--border, #d0d5dd))",
  },
};

function token(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeFinanceBillingStatus(value: unknown): FinanceBillingStatus {
  const raw = token(value);
  if (raw === "billed" || raw === "invoiced" || raw === "incurred") return "billed";
  if (raw === "paid" || raw === "settled") return "paid";
  if (raw === "disputed" || raw === "exception" || raw === "rejected") return "disputed";
  return "not_billed";
}

export function normalizeFinanceVendorPayStatus(value: unknown): FinanceVendorPayStatus {
  const raw = token(value);
  if (raw === "paid" || raw === "settled") return "paid";
  if (raw === "partial") return "partial";
  if (raw === "overdue" || raw === "late") return "overdue";
  return "unpaid";
}

/** Keep invoice/cost/payment fields in sync when billing status changes. */
export function financeBillingStatusPatch(financialStatus: FinanceBillingStatus) {
  return {
    financialStatus,
    invoiceStatus:
      financialStatus === "not_billed"
        ? "not_billed"
        : financialStatus === "disputed"
          ? "disputed"
          : financialStatus === "paid"
            ? "paid"
            : "invoiced",
    costStatus:
      financialStatus === "paid"
        ? "paid"
        : financialStatus === "billed"
          ? "incurred"
          : financialStatus === "disputed"
            ? "disputed"
            : "planned",
    paymentStatus:
      financialStatus === "paid"
        ? "paid"
        : financialStatus === "disputed"
          ? "unpaid"
          : "unpaid",
  };
}

export function parseFinanceLineId(lineId: string) {
  const parts = String(lineId || "").split(":");
  if (parts.length < 3) return null;
  const [projectId, periodId, ...entryParts] = parts;
  const entryId = entryParts.join(":");
  if (!projectId || !periodId || !entryId) return null;
  return { projectId, periodId, entryId };
}

export const FINANCE_LINE_TASK_SOURCE = "finance_line";

export function isFinanceLineTask(task: any) {
  return (
    String(task?.source || "") === FINANCE_LINE_TASK_SOURCE ||
    Boolean(String(task?.sourceFinanceLineId || task?.financeLineId || "").trim())
  );
}

export function financeLineIdFromTask(task: any) {
  return String(task?.sourceFinanceLineId || task?.financeLineId || "").trim();
}
