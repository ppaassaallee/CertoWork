import { financeAmount, financePriceAmount, normalizedFinancePeriods } from "./projectFinance";
import {
  financeMonthKey,
  financeMonthLabel,
  isFinanceLineBilled,
  normalizeChargeLineType,
  type ChargeLineType,
} from "./financeChargeTypes";

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
  "source",
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
  source: "Source",
};

export const defaultPortfolioFinanceColumns: PortfolioFinanceColumn[] = [
  ...PORTFOLIO_FINANCE_COLUMNS,
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
};

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
        });
      }
    }
  }
  return rows.sort((left, right) => {
    const byClient = left.client.localeCompare(right.client);
    if (byClient) return byClient;
    const byMonth = left.monthKey.localeCompare(right.monthKey);
    if (byMonth) return byMonth;
    const byProduct = left.product.localeCompare(right.product);
    if (byProduct) return byProduct;
    return left.project.localeCompare(right.project);
  });
}

export type PortfolioFinanceGroupBy = "month" | "client" | "product";

export function groupPortfolioFinanceRows(
  rows: PortfolioFinanceRow[],
  groupBy: PortfolioFinanceGroupBy,
) {
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
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, items]) => ({
      key,
      label:
        groupBy === "month"
          ? financeMonthLabel(key)
          : key || "—",
      rows: items,
      cost: items.reduce((sum, row) => sum + row.cost, 0),
      price: items.reduce((sum, row) => sum + row.price, 0),
    }));
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
  },
) {
  const search = clean(filters.search).toLowerCase();
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
    if (!search) return true;
    const haystack =
      `${row.project} ${row.projectKey} ${row.client} ${row.product} ${row.bpo} ${row.type} ${row.source}`.toLowerCase();
    return haystack.includes(search);
  });
}
