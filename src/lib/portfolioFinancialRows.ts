import { financeAmount, financePriceAmount, normalizedFinancePeriods } from "./projectFinance";
import {
  financeMonthKey,
  financeMonthLabel,
  isFinanceLineBilled,
  normalizeChargeLineType,
  type ChargeLineType,
} from "./financeChargeTypes";
import {
  normalizeFinanceBillingStatus,
  normalizeFinanceVendorPayStatus,
  type FinanceBillingStatus,
  type FinanceVendorPayStatus,
} from "./financeBillingStatuses";

export const PORTFOLIO_FINANCE_COLUMNS = [
  "project",
  "projectId",
  "client",
  "product",
  "bpo",
  "externalOrInternal",
  "stage",
  "phase",
  "status",
  "type",
  "month",
  "unit",
  "units",
  "costPerUnit",
  "cost",
  "marginPct",
  "price",
  "billingStatus",
  "vendorPayStatus",
  "vendorInvoice",
  "clientInvoice",
  "source",
  "followUp",
] as const;

export type PortfolioFinanceColumn = (typeof PORTFOLIO_FINANCE_COLUMNS)[number];

export const portfolioFinanceColumnLabels: Record<PortfolioFinanceColumn, string> = {
  project: "Project",
  projectId: "Project ID",
  client: "Client",
  product: "Solution/Product",
  bpo: "BPO",
  externalOrInternal: "External or Internal",
  stage: "Stage",
  phase: "Phase",
  status: "Status",
  type: "Type",
  month: "Month",
  unit: "Unit of measure",
  units: "Units",
  costPerUnit: "Cost per unit",
  cost: "Cost",
  marginPct: "Margin %",
  price: "Price",
  billingStatus: "Billing status",
  vendorPayStatus: "Vendor pay status",
  vendorInvoice: "Vendor invoice",
  clientInvoice: "Client invoice",
  source: "Source",
  followUp: "Follow-up",
};

/** Default visible columns — Source hidden; billing fields on; follow-up action last. */
export const defaultPortfolioFinanceColumns: PortfolioFinanceColumn[] = [
  "project",
  "projectId",
  "client",
  "product",
  "bpo",
  "externalOrInternal",
  "stage",
  "phase",
  "status",
  "type",
  "month",
  "unit",
  "units",
  "costPerUnit",
  "cost",
  "marginPct",
  "price",
  "billingStatus",
  "vendorPayStatus",
  "vendorInvoice",
  "clientInvoice",
  "followUp",
];

export const PORTFOLIO_FINANCE_FILTERABLE_COLUMNS: PortfolioFinanceColumn[] = [
  "project",
  "projectId",
  "client",
  "product",
  "bpo",
  "externalOrInternal",
  "stage",
  "phase",
  "status",
  "type",
  "month",
  "unit",
  "billingStatus",
  "vendorPayStatus",
  "vendorInvoice",
  "clientInvoice",
];

export type PortfolioFinanceRow = {
  id: string;
  projectId: string;
  project: string;
  projectKey: string;
  client: string;
  product: string;
  bpo: string;
  externalOrInternal: string;
  stage: string;
  phase: string;
  status: string;
  type: ChargeLineType;
  monthKey: string;
  monthLabel: string;
  unit: string;
  units: number;
  costPerUnit: number;
  cost: number;
  marginPct: number | null;
  price: number;
  source: string;
  billed: boolean;
  financialStatus: string;
  billingStatus: FinanceBillingStatus;
  vendorPayStatus: FinanceVendorPayStatus;
  vendorInvoice: string;
  clientInvoice: string;
};

export type PortfolioFinanceColumnFilters = Partial<
  Record<PortfolioFinanceColumn, string[]>
>;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function unitLabel(unit: string) {
  const labels: Record<string, string> = {
    hour: "Hour",
    ai_minute: "Minute",
    transaction: "Interaction",
    fee: "Fee",
    license: "License",
    other: "Other",
  };
  return labels[unit] || unit || "Fee";
}

function monthSortKey(monthKey: string) {
  if (/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  if (monthKey === "build") return "0000-00";
  return `9999-${monthKey}`;
}

export function portfolioFinanceCellValue(
  row: PortfolioFinanceRow,
  column: PortfolioFinanceColumn,
): string {
  switch (column) {
    case "project":
      return row.project;
    case "projectId":
      return row.projectKey;
    case "client":
      return row.client;
    case "product":
      return row.product;
    case "bpo":
      return row.bpo;
    case "externalOrInternal":
      return row.externalOrInternal;
    case "stage":
      return row.stage;
    case "phase":
      return row.phase;
    case "status":
      return row.status;
    case "type":
      return row.type;
    case "month":
      return row.monthLabel;
    case "unit":
      return row.unit;
    case "units":
      return String(row.units);
    case "costPerUnit":
      return String(row.costPerUnit);
    case "cost":
      return String(row.cost);
    case "marginPct":
      return row.marginPct == null ? "—" : String(row.marginPct);
    case "price":
      return String(row.price);
    case "billingStatus":
      return row.billingStatus;
    case "vendorPayStatus":
      return row.vendorPayStatus;
    case "vendorInvoice":
      return row.vendorInvoice || "—";
    case "clientInvoice":
      return row.clientInvoice || "—";
    case "source":
      return row.source;
    case "followUp":
      return "";
    default:
      return "";
  }
}

export function buildPortfolioFinanceRows(projects: any[]): PortfolioFinanceRow[] {
  const rows: PortfolioFinanceRow[] = [];
  for (const project of projects) {
    const periods = normalizedFinancePeriods(project);
    const projectTitle =
      clean(project.title) || clean(project.name) || clean(project.shortTitle) || "Untitled project";
    const client = clean(project.clientEntity || project.client) || "Internal";
    const bpo = clean(project.deliveryEntity || project.bpo) || "Internal";
    const product =
      clean(project.technology || project.serviceLine || project.category) || "—";
    const externalOrInternal =
      clean(project.externalOrInternal) ||
      (clean(project.workCategory).toLowerCase().includes("internal")
        ? "Internal"
        : "External");
    const stage = clean(project.sourceStage || project.deliveryStage || project.phase) || "—";
    const phase = clean(project.phase || project.deliveryPhase) || "—";
    const status = clean(project.sourceStatus || project.status) || "—";
    const projectKey = clean(project.projectKey || project.excel?.projectId) || "—";

    for (const period of periods) {
      for (const entry of period.entries) {
        if (entry.direction === "revenue") continue;
        const units = Number(entry.actualQty ?? entry.plannedQty ?? 0);
        const costPerUnit = Number(entry.rate || 0);
        const cost = financeAmount(entry);
        const price = financePriceAmount(entry);
        const marginPct =
          price > 0 ? Math.round(((price - cost) / price) * 10000) / 10000 : null;
        const monthKey = financeMonthKey(entry, period);
        rows.push({
          id: `${project.id}:${period.id}:${entry.id}`,
          projectId: String(project.id),
          project: projectTitle,
          projectKey,
          client,
          product: clean(entry.serviceSolution) || product,
          bpo,
          externalOrInternal,
          stage: clean(entry.allocationStage) || stage,
          phase: clean(entry.phase) || phase,
          status,
          type: normalizeChargeLineType(entry),
          monthKey,
          monthLabel: financeMonthLabel(monthKey),
          unit: unitLabel(String(entry.unit || "fee")),
          units,
          costPerUnit,
          cost,
          marginPct,
          price,
          source: clean(entry.referenceNumber || entry.description) || "—",
          billed: isFinanceLineBilled(entry),
          financialStatus: clean(entry.financialStatus) || "not_billed",
          billingStatus: normalizeFinanceBillingStatus(entry.financialStatus),
          vendorPayStatus: normalizeFinanceVendorPayStatus(entry.paymentStatus),
          vendorInvoice:
            clean(entry.vendorInvoice) || clean(entry.referenceNumber) || "",
          clientInvoice: clean(entry.clientInvoice) || "",
        });
      }
    }
  }
  return rows.sort((left, right) => {
    const byMonth = monthSortKey(left.monthKey).localeCompare(monthSortKey(right.monthKey));
    if (byMonth) return byMonth;
    const byProject = left.project.localeCompare(right.project);
    if (byProject) return byProject;
    return left.product.localeCompare(right.product);
  });
}

export type PortfolioFinanceGroupBy = "month" | "client" | "product" | "monthProject";

export function groupPortfolioFinanceRows(
  rows: PortfolioFinanceRow[],
  groupBy: PortfolioFinanceGroupBy,
) {
  if (groupBy === "monthProject") {
    return groupPortfolioFinanceByMonthThenProject(rows).flatMap((month) =>
      month.projects.map((project) => ({
        key: `${month.key}::${project.key}`,
        label: `${month.label} · ${project.label}`,
        rows: project.rows,
        cost: project.cost,
        price: project.price,
      })),
    );
  }
  const groups = new Map<string, PortfolioFinanceRow[]>();
  for (const row of rows) {
    const key =
      groupBy === "client"
        ? row.client
        : groupBy === "product"
          ? row.product
          : row.monthKey;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) =>
      groupBy === "month"
        ? monthSortKey(left).localeCompare(monthSortKey(right))
        : left.localeCompare(right),
    )
    .map(([key, items]) => ({
      key,
      label: groupBy === "month" ? financeMonthLabel(key) : key || "—",
      rows: items,
      cost: items.reduce((sum, row) => sum + row.cost, 0),
      price: items.reduce((sum, row) => sum + row.price, 0),
    }));
}

export type PortfolioFinanceProjectBreak = {
  key: string;
  label: string;
  rows: PortfolioFinanceRow[];
  cost: number;
  price: number;
};

export type PortfolioFinanceMonthBreak = {
  key: string;
  label: string;
  projects: PortfolioFinanceProjectBreak[];
  cost: number;
  price: number;
  lineCount: number;
};

/** Excel-style outline: chronological month → project, with cost/price totals. */
export function groupPortfolioFinanceByMonthThenProject(
  rows: PortfolioFinanceRow[],
): PortfolioFinanceMonthBreak[] {
  const months = new Map<string, Map<string, PortfolioFinanceRow[]>>();
  for (const row of rows) {
    const byProject = months.get(row.monthKey) || new Map<string, PortfolioFinanceRow[]>();
    const key = row.projectId || row.project;
    const list = byProject.get(key) || [];
    list.push(row);
    byProject.set(key, list);
    months.set(row.monthKey, byProject);
  }

  return [...months.entries()]
    .sort(([left], [right]) => monthSortKey(left).localeCompare(monthSortKey(right)))
    .map(([monthKey, projects]) => {
      const projectBreaks = [...projects.entries()]
        .map(([projectKey, items]) => {
          const sorted = [...items].sort((a, b) => a.project.localeCompare(b.project));
          return {
            key: projectKey,
            label: sorted[0]?.project || "—",
            rows: sorted,
            cost: sorted.reduce((sum, row) => sum + row.cost, 0),
            price: sorted.reduce((sum, row) => sum + row.price, 0),
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label));
      return {
        key: monthKey,
        label: financeMonthLabel(monthKey),
        projects: projectBreaks,
        cost: projectBreaks.reduce((sum, project) => sum + project.cost, 0),
        price: projectBreaks.reduce((sum, project) => sum + project.price, 0),
        lineCount: projectBreaks.reduce((sum, project) => sum + project.rows.length, 0),
      };
    });
}

export function uniquePortfolioFinanceValues(
  rows: PortfolioFinanceRow[],
  column: PortfolioFinanceColumn,
) {
  return [
    ...new Set(rows.map((row) => portfolioFinanceCellValue(row, column) || "—")),
  ].sort((left, right) => left.localeCompare(right));
}

export function filterPortfolioFinanceRows(
  rows: PortfolioFinanceRow[],
  filters: {
    search?: string;
    client?: string;
    bpo?: string;
    product?: string;
    month?: string;
    type?: string;
    billed?: "all" | "billed" | "unbilled";
    columnFilters?: PortfolioFinanceColumnFilters;
  },
) {
  const search = clean(filters.search).toLowerCase();
  const columnFilters = filters.columnFilters || {};
  return rows.filter((row) => {
    if (filters.client && filters.client !== "all" && row.client !== filters.client) {
      return false;
    }
    if (filters.bpo && filters.bpo !== "all" && row.bpo !== filters.bpo) return false;
    if (filters.product && filters.product !== "all" && row.product !== filters.product) {
      return false;
    }
    if (filters.month && filters.month !== "all" && row.monthKey !== filters.month) {
      return false;
    }
    if (filters.type && filters.type !== "all" && row.type !== filters.type) return false;
    if (filters.billed === "billed" && !row.billed) return false;
    if (filters.billed === "unbilled" && row.billed) return false;
    for (const column of PORTFOLIO_FINANCE_COLUMNS) {
      const selected = columnFilters[column];
      if (!selected || selected.length === 0) continue;
      const value = portfolioFinanceCellValue(row, column) || "—";
      if (!selected.includes(value)) return false;
    }
    if (!search) return true;
    const haystack =
      `${row.project} ${row.projectKey} ${row.client} ${row.product} ${row.bpo} ${row.type} ${row.source} ${row.vendorInvoice} ${row.clientInvoice}`.toLowerCase();
    return haystack.includes(search);
  });
}

export function ensureProjectFinanceColumn(
  columns: PortfolioFinanceColumn[],
): PortfolioFinanceColumn[] {
  const known = new Set<string>(PORTFOLIO_FINANCE_COLUMNS);
  const cleaned = columns.filter(
    (column): column is PortfolioFinanceColumn =>
      known.has(column) && column !== "project" && column !== "followUp",
  );
  // Drop Source unless the user explicitly kept it in stored prefs after this change.
  const withoutLegacySource =
    cleaned.includes("billingStatus") || cleaned.includes("vendorPayStatus")
      ? cleaned
      : cleaned.filter((column) => column !== "source");
  const withBilling = [...withoutLegacySource];
  for (const required of [
    "billingStatus",
    "vendorPayStatus",
    "vendorInvoice",
    "clientInvoice",
  ] as const) {
    if (!withBilling.includes(required)) withBilling.push(required);
  }
  return ["project", ...withBilling, "followUp"];
}
