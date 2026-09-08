import { normalizedFinancePeriods, stripUndefinedValues, type FinanceEntry } from "./projectFinance";
import { parseFinanceLineId } from "./financeBillingStatuses";

/** Patch a single finance line on a project document (returns next financePeriods). */
export function patchProjectFinanceLine(
  project: any,
  lineId: string,
  patch: Partial<FinanceEntry>,
) {
  const parsed = parseFinanceLineId(lineId);
  if (!parsed) return null;
  if (String(project?.id) !== parsed.projectId) return null;
  const periods = normalizedFinancePeriods(project);
  const next = periods.map((period) => {
    if (period.id !== parsed.periodId) return period;
    return {
      ...period,
      entries: period.entries.map((entry) =>
        entry.id === parsed.entryId ? { ...entry, ...patch } : entry,
      ),
    };
  });
  return stripUndefinedValues(next);
}

export function financeLineFollowUpTitle(row: {
  project: string;
  monthLabel?: string;
  type?: string;
  client?: string;
}) {
  const bits = [
    "Follow up",
    row.type || "finance line",
    row.project,
    row.monthLabel,
  ].filter(Boolean);
  return bits.join(" · ").slice(0, 140);
}

export function financeLineFollowUpDescription(row: {
  id: string;
  project: string;
  client?: string;
  product?: string;
  monthLabel?: string;
  type?: string;
  cost?: number;
  price?: number;
  billingStatus?: string;
  vendorPayStatus?: string;
  vendorInvoice?: string;
  clientInvoice?: string;
}) {
  return [
    `Finance follow-up for ${row.project}.`,
    row.client ? `Client: ${row.client}` : "",
    row.product ? `Product: ${row.product}` : "",
    row.monthLabel ? `Period: ${row.monthLabel}` : "",
    row.type ? `Type: ${row.type}` : "",
    typeof row.cost === "number" ? `Cost: $${row.cost}` : "",
    typeof row.price === "number" ? `Price: $${row.price}` : "",
    row.billingStatus ? `Billing: ${row.billingStatus}` : "",
    row.vendorPayStatus ? `Vendor pay: ${row.vendorPayStatus}` : "",
    row.vendorInvoice ? `Vendor invoice: ${row.vendorInvoice}` : "",
    row.clientInvoice ? `Client invoice: ${row.clientInvoice}` : "",
    `Finance line: ${row.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}
