export type FinancePeriodKind = "build" | "monthly";
export type FinanceDirection = "cost" | "revenue";

export type FinanceEntry = {
  id: string;
  direction: FinanceDirection;
  description: string;
  category: string;
  unit: string;
  plannedQty: number;
  actualQty: number;
  plannedRate?: number;
  rate: number;
  accountingMonth?: string;
  transactionDate?: string;
  financialStatus?: string;
  referenceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  invoiceStatus?: string;
  costStatus?: string;
  paymentStatus?: string;
  settledAmount?: number;
  settledDate?: string;
};

export type FinancePeriod = {
  id: string;
  kind: FinancePeriodKind;
  label: string;
  month?: number;
  year?: number;
  status: string;
  currency: string;
  billingStatus?: string;
  collectionStatus?: string;
  sourceTemplateId?: string;
  entries: FinanceEntry[];
};

export function financeId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function inferredCategory(entry: any) {
  const value =
    `${entry?.category || ""} ${entry?.description || entry?.dimension || ""}`.toLowerCase();
  if (value.includes("support")) return "support";
  if (value.includes("implement")) return "implementation";
  if (value.includes("license")) return "license";
  if (
    value.includes("infra") ||
    value.includes("hosting") ||
    value.includes("cloud")
  )
    return "infrastructure";
  if (value.includes("vendor")) return "vendor";
  if (value.includes("revenue") || value.includes("invoice")) return "revenue";
  return "development";
}

export function normalizedFinancePeriods(project: any): FinancePeriod[] {
  if (!Array.isArray(project?.financePeriods)) return [];
  return project.financePeriods.map((period: any) => ({
    id: String(period.id || financeId("period")),
    kind: period.kind === "monthly" ? "monthly" : "build",
    label: String(
      period.label ||
        (period.kind === "monthly" ? "Monthly operations" : "Build V1"),
    ),
    month: Number(period.month || 0) || undefined,
    year: Number(period.year || 0) || undefined,
    status: String(period.status || "planned"),
    currency: String(period.currency || project.currency || "USD"),
    billingStatus: String(period.billingStatus || "not_billed"),
    collectionStatus: String(period.collectionStatus || "unpaid"),
    sourceTemplateId: String(period.sourceTemplateId || "") || undefined,
    entries: Array.isArray(period.entries)
      ? period.entries.map((entry: any) => ({
          id: String(entry.id || financeId("entry")),
          direction: entry.direction === "revenue" ? "revenue" : "cost",
          description: String(
            entry.description || entry.dimension || "Financial item",
          ),
          category: String(entry.category || inferredCategory(entry)),
          unit: String(entry.unit || "fee"),
          plannedQty: Number(entry.plannedQty ?? entry.quantity ?? 0),
          actualQty: Number(entry.actualQty ?? entry.actualQuantity ?? 0),
          plannedRate: Number(
            entry.plannedRate ??
              entry.budgetRate ??
              entry.rate ??
              entry.unitRate ??
              0,
          ),
          rate: Number(entry.rate ?? entry.unitRate ?? 0),
          accountingMonth: String(
            entry.accountingMonth ||
              (period.year && period.month
                ? `${period.year}-${String(period.month).padStart(2, "0")}`
                : ""),
          ),
          transactionDate: String(
            entry.transactionDate ||
              entry.issueDate ||
              entry.settledDate ||
              (period.year && period.month
                ? `${period.year}-${String(period.month).padStart(2, "0")}-01`
                : ""),
          ),
          financialStatus: String(
            entry.financialStatus ||
              (entry.paymentStatus === "paid"
                ? "paid"
                : entry.invoiceStatus === "disputed" ||
                    entry.costStatus === "disputed"
                  ? "disputed"
                  : entry.invoiceStatus === "invoiced" ||
                      entry.costStatus === "incurred"
                    ? "billed"
                    : "not_billed"),
          ),
          referenceNumber: String(
            entry.referenceNumber || entry.invoiceNumber || "",
          ),
          issueDate: String(entry.issueDate || ""),
          dueDate: String(entry.dueDate || ""),
          invoiceStatus: String(
            entry.invoiceStatus ||
              (entry.direction === "revenue" &&
              ["issued", "partial", "paid", "overdue"].includes(
                String(entry.paymentStatus),
              )
                ? "invoiced"
                : entry.paymentStatus === "void"
                  ? "void"
                  : "not_billed"),
          ),
          costStatus: String(
            entry.costStatus ||
              (entry.direction === "revenue"
                ? "planned"
                : entry.paymentStatus || "planned"),
          ),
          paymentStatus: String(
            entry.direction === "revenue"
              ? entry.paymentStatus === "partial"
                ? "partial"
                : entry.paymentStatus === "paid"
                  ? "paid"
                  : entry.paymentStatus === "overdue"
                    ? "overdue"
                    : "unpaid"
              : entry.paymentStatus || "planned",
          ),
          settledAmount: Number(entry.settledAmount ?? entry.paidAmount ?? 0),
          settledDate: String(entry.settledDate || entry.paidDate || ""),
        }))
      : [],
  }));
}

export function financeAmount(entry: FinanceEntry, actual = true) {
  const quantity = actual ? entry.actualQty : entry.plannedQty;
  const rate = actual ? entry.rate : (entry.plannedRate ?? entry.rate);
  return Number(quantity || 0) * Number(rate || 0);
}

export function financeSummary(periods: FinancePeriod[]) {
  const entries = periods.flatMap((period) => period.entries);
  const active = entries.filter((entry) =>
    entry.direction === "revenue"
      ? entry.invoiceStatus !== "void"
      : entry.costStatus !== "void",
  );
  const costs = active.filter((entry) => entry.direction === "cost");
  const revenue = active.filter((entry) => entry.direction === "revenue");
  const actualCost = costs.reduce(
    (sum, entry) => sum + financeAmount(entry),
    0,
  );
  const plannedCost = costs.reduce(
    (sum, entry) => sum + financeAmount(entry, false),
    0,
  );
  const actualRevenue = revenue.reduce(
    (sum, entry) => sum + financeAmount(entry),
    0,
  );
  const plannedRevenue = revenue.reduce(
    (sum, entry) => sum + financeAmount(entry, false),
    0,
  );
  const invoiced = revenue
    .filter(
      (entry) =>
        Boolean(entry.referenceNumber) ||
        ["billed", "paid", "disputed"].includes(
          String(entry.financialStatus),
        ) ||
        ["invoiced", "open", "paid", "uncollectible"].includes(
          String(entry.invoiceStatus),
        ),
    )
    .reduce((sum, entry) => sum + financeAmount(entry), 0);
  const collected = revenue.reduce(
    (sum, entry) => sum + Number(entry.settledAmount || 0),
    0,
  );
  return {
    actualCost,
    plannedCost,
    actualRevenue,
    plannedRevenue,
    invoiced,
    collected,
    outstanding: Math.max(0, invoiced - collected),
    margin: actualRevenue - actualCost,
  };
}

export function projectFinancialRollup(project: any) {
  const periods = normalizedFinancePeriods(project);
  const allCostEntries = periods
    .flatMap((period) => period.entries)
    .filter(
      (entry) => entry.direction === "cost" && entry.costStatus !== "void",
    );
  const hourEntries = allCostEntries.filter((entry) => entry.unit === "hour");
  const buildSummary = financeSummary(
    periods.filter((period) => period.kind === "build"),
  );
  const monthlyPeriods = periods
    .filter((period) => period.kind === "monthly")
    .sort(
      (left, right) =>
        (right.year || 0) * 100 +
        (right.month || 0) -
        ((left.year || 0) * 100 + (left.month || 0)),
    );
  const latestMonthly = monthlyPeriods[0]
    ? financeSummary([monthlyPeriods[0]])
    : null;
  return {
    periods,
    plannedHours: hourEntries.reduce(
      (sum, entry) => sum + Number(entry.plannedQty || 0),
      0,
    ),
    actualHours: hourEntries.reduce(
      (sum, entry) => sum + Number(entry.actualQty || 0),
      0,
    ),
    plannedCost: allCostEntries.reduce(
      (sum, entry) => sum + financeAmount(entry, false),
      0,
    ),
    actualCost: allCostEntries.reduce(
      (sum, entry) => sum + financeAmount(entry),
      0,
    ),
    buildCost: buildSummary.actualCost || buildSummary.plannedCost,
    latestMonthlyCost: latestMonthly
      ? latestMonthly.actualCost || latestMonthly.plannedCost
      : 0,
  };
}
