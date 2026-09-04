export type FinancePeriodKind = "build" | "monthly";
export type FinanceDirection = "cost" | "revenue";

export type FinanceEntry = {
  id: string;
  direction: FinanceDirection;
  description: string;
  category: string;
  costType?: string;
  allocationStage?: string;
  serviceSolution?: string;
  unit: string;
  plannedQty: number;
  actualQty: number;
  plannedRate?: number;
  rate: number;
  plannedPriceRate?: number;
  priceRate?: number;
  vendor?: string;
  assignee?: string;
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

export function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value))
    return value.map((item) => stripUndefinedValues(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)]),
    ) as T;
  }
  return value;
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
          costType: String(entry.costType || entry.type || "") || undefined,
          allocationStage:
            String(entry.allocationStage || entry.stage || entry.statge || "") ||
            undefined,
          serviceSolution:
            String(entry.serviceSolution || entry.service || entry.solution || "") ||
            undefined,
          unit: String(entry.unit || "fee"),
          plannedQty: Number(entry.plannedQty ?? entry.quantity ?? 0),
          actualQty: Number(entry.actualQty ?? entry.actualQuantity ?? 0),
          plannedRate: Number(
            entry.plannedRate ??
              entry.budgetRate ??
              entry.rate ??
              entry.unitRate ??
              entry["Budget Unit Cost"] ??
              0,
          ),
          rate: Number(
            entry.rate ??
              entry.unitRate ??
              entry.actualRate ??
              entry["Actual Unit Cost"] ??
              entry.plannedRate ??
              0,
          ),
          plannedPriceRate: Number(
            entry.plannedPriceRate ??
              entry.budgetPriceRate ??
              entry.priceRate ??
              entry.unitPrice ??
              entry["Budget Unit Price"] ??
              0,
          ),
          priceRate: Number(
            entry.priceRate ??
              entry.actualPriceRate ??
              entry.unitPrice ??
              entry.plannedPriceRate ??
              entry["Actual Unit Price"] ??
              0,
          ),
          vendor: String(entry.vendor || "") || undefined,
          assignee:
            String(entry.assignee || entry.assigneeName || entry.owner || "") ||
            undefined,
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

export function financePriceAmount(entry: FinanceEntry, actual = true) {
  if (entry.direction === "revenue") return financeAmount(entry, actual);
  const quantity = actual ? entry.actualQty : entry.plannedQty;
  const rate = actual
    ? entry.priceRate
    : (entry.plannedPriceRate ?? entry.priceRate);
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
  const actualCost = costs.reduce(
    (sum, entry) => sum + financeAmount(entry),
    0,
  );
  const plannedCost = costs.reduce(
    (sum, entry) => sum + financeAmount(entry, false),
    0,
  );
  const actualRevenue = active.reduce(
    (sum, entry) => sum + financePriceAmount(entry),
    0,
  );
  const plannedRevenue = active.reduce(
    (sum, entry) => sum + financePriceAmount(entry, false),
    0,
  );
  const invoiced = active
    .filter(
      (entry) =>
        financePriceAmount(entry) > 0 &&
        (Boolean(entry.referenceNumber) ||
          ["billed", "paid", "disputed"].includes(
            String(entry.financialStatus),
          ) ||
          ["invoiced", "open", "paid", "uncollectible"].includes(
            String(entry.invoiceStatus),
          )),
    )
    .reduce((sum, entry) => sum + financePriceAmount(entry), 0);
  const collected = active
    .filter((entry) => financePriceAmount(entry) > 0)
    .reduce(
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

export function financeCapacityAllocations(periods: FinancePeriod[]) {
  const hourEntries = periods
    .flatMap((period) =>
      period.entries.map((entry) => ({
        ...entry,
        periodKind: period.kind,
        periodLabel: period.label,
        periodMonth: period.month,
        periodYear: period.year,
      })),
    )
    .filter(
      (entry) =>
        entry.direction === "cost" &&
        entry.unit === "hour" &&
        entry.costStatus !== "void",
    );

  const byAssignee = new Map<
    string,
    { plannedHours: number; actualHours: number; plannedCost: number; actualCost: number }
  >();
  const byStage = new Map<
    string,
    { plannedHours: number; actualHours: number; plannedCost: number; actualCost: number }
  >();

  hourEntries.forEach((entry) => {
    const assignee = entry.assignee || "Unassigned";
    const stage = entry.allocationStage || entry.periodLabel || "Unstaged";
    const plannedCost = financeAmount(entry, false);
    const actualCost = financeAmount(entry);
    const add = (
      map: Map<
        string,
        { plannedHours: number; actualHours: number; plannedCost: number; actualCost: number }
      >,
      key: string,
    ) => {
      const current =
        map.get(key) || {
          plannedHours: 0,
          actualHours: 0,
          plannedCost: 0,
          actualCost: 0,
        };
      map.set(key, {
        plannedHours: current.plannedHours + Number(entry.plannedQty || 0),
        actualHours: current.actualHours + Number(entry.actualQty || 0),
        plannedCost: current.plannedCost + plannedCost,
        actualCost: current.actualCost + actualCost,
      });
    };
    add(byAssignee, assignee);
    add(byStage, stage);
  });

  const sortDesc = (
    rows: Array<{
      name: string;
      plannedHours: number;
      actualHours: number;
      plannedCost: number;
      actualCost: number;
    }>,
  ) =>
    rows.sort(
      (left, right) =>
        right.plannedHours + right.actualHours - (left.plannedHours + left.actualHours),
    );

  return {
    byAssignee: sortDesc(
      [...byAssignee.entries()].map(([name, value]) => ({ name, ...value })),
    ),
    byStage: sortDesc(
      [...byStage.entries()].map(([name, value]) => ({ name, ...value })),
    ),
  };
}
