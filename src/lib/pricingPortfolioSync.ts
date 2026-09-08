import { financeId, stripUndefinedValues, type FinanceEntry, type FinancePeriod } from "./projectFinance";
import {
  mapProductPhase,
  mapSourceHealth,
  mapSourceStatus,
} from "./portfolioMasterImport";
import { normalizeDeliveryStage } from "./projectDelivery";
import type { ProductPhase } from "./workClassification";

export const PRICING_PORTFOLIO_IMPORT_KEY = "pricing-2026-transactions";
export const PRICING_PORTFOLIO_SOURCE = "Pricing_Data_Portafolio_IA_2026.xlsx";
export const PRICING_MATCH_THRESHOLD = 0.8;

export type PricingTransaction = {
  sourceRow: number;
  title?: string | null;
  chargeType?: string | null;
  month?: string | null;
  unitOfMeasure?: string | null;
  units?: number | null;
  costPerUnit?: number | null;
  cost?: number | null;
  marginPct?: number | null;
  price?: number | null;
  source?: string | null;
  solution?: string | null;
};

export type PricingProjectRow = {
  projectId: string;
  title: string;
  titles?: string[];
  client?: string | null;
  solution?: string | null;
  bpo?: string | null;
  externalOrInternal?: string | null;
  stage?: string | null;
  phase?: string | null;
  status?: string | null;
  transactions: PricingTransaction[];
};

export type PricingPortfolioFile = {
  source: string;
  sheet: string;
  projectCount: number;
  transactionCount: number;
  projects: PricingProjectRow[];
};

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "";
}

function token(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactToken(value: unknown) {
  return token(value).replace(/\s+/g, "");
}

/** Strip leading "X " markers used for unmatched Pure AI projects. */
export function stripUnmatchedPrefix(title: unknown) {
  return clean(title).replace(/^x\s+/i, "").trim();
}

export function withUnmatchedPrefix(title: unknown) {
  const base = stripUnmatchedPrefix(title) || "Untitled project";
  return `X ${base}`;
}

export function hasUnmatchedPrefix(title: unknown) {
  return /^x\s+/i.test(clean(title));
}

function bigrams(text: string) {
  const value = compactToken(text);
  if (value.length < 2) return value ? new Set([value]) : new Set<string>();
  const grams = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) grams.add(value.slice(i, i + 2));
  return grams;
}

/** Dice coefficient on character bigrams — stable for multilingual titles. */
export function titleSimilarity(a: unknown, b: unknown) {
  const left = token(a);
  const right = token(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const compactLeft = compactToken(left);
  const compactRight = compactToken(right);
  if (compactLeft === compactRight) return 1;
  if (compactLeft.includes(compactRight) || compactRight.includes(compactLeft)) {
    const shorter = Math.min(compactLeft.length, compactRight.length);
    const longer = Math.max(compactLeft.length, compactRight.length);
    return Math.max(0.85, shorter / longer);
  }
  const aGrams = bigrams(left);
  const bGrams = bigrams(right);
  if (!aGrams.size || !bGrams.size) return 0;
  let overlap = 0;
  for (const gram of aGrams) if (bGrams.has(gram)) overlap += 1;
  return (2 * overlap) / (aGrams.size + bGrams.size);
}

function monthParts(value?: string | null) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), label: `${match[1]}-${match[2]}` };
}

export function mapPricingUnit(unitOfMeasure?: string | null) {
  const value = token(unitOfMeasure);
  if (value === "hour") return "hour";
  if (value === "minute") return "ai_minute";
  if (value === "interaction") return "transaction";
  if (value === "project" || value === "month" || value === "ftes") return "fee";
  return "other";
}

export function mapChargeType(chargeType?: string | null, externalOrInternal?: string | null) {
  const charge = token(chargeType);
  void externalOrInternal;
  if (charge.includes("build")) {
    return {
      costType: "Build",
      allocationStage: "Build",
      category: "development",
      kind: "build" as const,
    };
  }
  if (charge.includes("maintenance") || charge.includes("support")) {
    return {
      costType: "Maintenance and Support",
      allocationStage: "Support",
      category: "support",
      kind: "monthly" as const,
    };
  }
  if (charge.includes("token") || charge.includes("surcharge")) {
    return {
      costType: "Ops Consumptions",
      allocationStage: "Operations",
      category: "infrastructure",
      kind: "monthly" as const,
    };
  }
  // Consumption and fallback
  return {
    costType: "Ops Consumptions",
    allocationStage: "Operations",
    category: "usage",
    kind: "monthly" as const,
  };
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

/**
 * Use Excel values as-is. Do not invent cost from formulas when Cost / Cost per
 * unit are blank — blank rules in the sheet often explain odd zeros.
 */
export function transactionQuantities(tx: PricingTransaction) {
  const units = asNumber(tx.units);
  const costPerUnit = asNumber(tx.costPerUnit);
  const cost = asNumber(tx.cost);
  const price = asNumber(tx.price);

  const qty = units == null ? (costPerUnit != null || cost != null ? 1 : 0) : units;
  let rate = 0;
  if (costPerUnit != null) rate = costPerUnit;
  else if (cost != null && qty) rate = cost / qty;

  let priceRate = 0;
  if (price != null && qty) priceRate = price / qty;

  return {
    qty,
    rate: roundMoney(rate),
    priceRate: roundMoney(priceRate),
    cost,
    price,
  };
}

export function buildFinancePeriodsFromTransactions(
  transactions: PricingTransaction[],
  options?: { currency?: string; externalOrInternal?: string | null },
): FinancePeriod[] {
  const currency = options?.currency || "USD";
  const byPeriod = new Map<string, FinancePeriod>();

  for (const tx of transactions) {
    const mapped = mapChargeType(tx.chargeType, options?.externalOrInternal);
    const month = monthParts(tx.month);
    const periodKey =
      mapped.kind === "build" || !month
        ? mapped.kind === "build"
          ? "build"
          : `unscheduled:${clean(tx.chargeType)}`
        : `monthly:${month.label}`;

    let period = byPeriod.get(periodKey);
    if (!period) {
      period = {
        id: financeId("period"),
        kind: mapped.kind === "build" ? "build" : "monthly",
        label:
          mapped.kind === "build"
            ? "Build fee"
            : month
              ? month.label
              : clean(tx.chargeType) || "Unscheduled",
        month: month?.month,
        year: month?.year,
        status: "actual",
        currency,
        billingStatus: "not_billed",
        collectionStatus: "unpaid",
        entries: [],
      };
      byPeriod.set(periodKey, period);
    }

    const qty = transactionQuantities(tx);
    const descriptionParts = [
      clean(tx.chargeType) || "Cost line",
      month?.label,
      clean(tx.solution),
    ].filter(Boolean);

    const entry: FinanceEntry = stripUndefinedValues({
      id: financeId("entry"),
      direction: "cost" as const,
      description: descriptionParts.join(" · "),
      category: mapped.category,
      costType: mapped.costType,
      allocationStage: mapped.allocationStage,
      serviceSolution: clean(tx.solution) || undefined,
      unit: mapPricingUnit(tx.unitOfMeasure),
      plannedQty: qty.qty,
      actualQty: qty.qty,
      plannedRate: qty.rate,
      rate: qty.rate,
      plannedPriceRate: qty.priceRate,
      priceRate: qty.priceRate,
      accountingMonth: month?.label || undefined,
      transactionDate: month ? `${month.label}-01` : undefined,
      financialStatus: "not_billed",
      invoiceStatus: "not_billed",
      costStatus: qty.cost == null ? "planned" : "incurred",
      paymentStatus: "planned",
      referenceNumber: tx.sourceRow ? `pricing-row-${tx.sourceRow}` : undefined,
    });
    period.entries.push(entry);
  }

  return [...byPeriod.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "build" ? -1 : 1;
    const ay = a.year || 0;
    const by = b.year || 0;
    if (ay !== by) return ay - by;
    return (a.month || 0) - (b.month || 0);
  });
}

export type CertoProjectMatchInput = {
  id: string;
  title?: string | null;
  name?: string | null;
  shortTitle?: string | null;
  projectKey?: string | null;
  importKey?: string | null;
  clientEntity?: string | null;
  client?: string | null;
  deliveryEntity?: string | null;
  bpo?: string | null;
  technology?: string | null;
  serviceLine?: string | null;
  excel?: { projectName?: string | null; proyecto?: string | null } | null;
};

export type PricingMatch = {
  pricing: PricingProjectRow;
  projectId: string | null;
  confidence: number;
  reason: string;
};

function candidateTitles(project: CertoProjectMatchInput) {
  return [
    stripUnmatchedPrefix(project.title),
    stripUnmatchedPrefix(project.name),
    stripUnmatchedPrefix(project.shortTitle),
    stripUnmatchedPrefix(project.excel?.projectName),
    stripUnmatchedPrefix(project.excel?.proyecto),
  ].filter(Boolean);
}

function pricingTitles(row: PricingProjectRow) {
  return unique([row.title, ...(row.titles || [])].map(stripUnmatchedPrefix).filter(Boolean));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function bestTitleScore(pricing: PricingProjectRow, project: CertoProjectMatchInput) {
  let best = 0;
  for (const left of pricingTitles(pricing)) {
    for (const right of candidateTitles(project)) {
      best = Math.max(best, titleSimilarity(left, right));
    }
  }
  return best;
}

function entityBonus(pricing: PricingProjectRow, project: CertoProjectMatchInput) {
  let bonus = 0;
  const pClient = token(pricing.client);
  const cClient = token(project.clientEntity || project.client);
  if (pClient && cClient && (pClient === cClient || pClient.includes(cClient) || cClient.includes(pClient))) {
    bonus += 0.05;
  }
  const pBpo = token(pricing.bpo);
  const cBpo = token(project.deliveryEntity || project.bpo);
  if (pBpo && cBpo && (pBpo === cBpo || pBpo.includes(cBpo) || cBpo.includes(pBpo))) {
    bonus += 0.05;
  }
  const pSol = token(pricing.solution);
  const cSol = token(project.technology || project.serviceLine);
  if (pSol && cSol && (pSol === cSol || pSol.includes(cSol) || cSol.includes(pSol))) {
    bonus += 0.03;
  }
  return bonus;
}

/**
 * 1:1 greedy match. Exact projectKey / title first, then fuzzy ≥ threshold
 * (default 80%) with a small client/BPO/solution bonus capped at 1.
 */
export function matchPricingProjects(
  pricingProjects: PricingProjectRow[],
  certoProjects: CertoProjectMatchInput[],
  threshold = PRICING_MATCH_THRESHOLD,
): {
  matched: PricingMatch[];
  unmatchedPricing: PricingProjectRow[];
  unmatchedCertoIds: string[];
} {
  const usedCerto = new Set<string>();
  const matched: PricingMatch[] = [];

  const exactKey = new Map<string, CertoProjectMatchInput>();
  for (const project of certoProjects) {
    const key = compactToken(project.projectKey);
    if (key) exactKey.set(key, project);
  }

  const remaining = [...pricingProjects];

  // Pass 1: exact Project ID ↔ projectKey
  for (let i = remaining.length - 1; i >= 0; i -= 1) {
    const pricing = remaining[i];
    const hit = exactKey.get(compactToken(pricing.projectId));
    if (hit && !usedCerto.has(hit.id)) {
      matched.push({
        pricing,
        projectId: hit.id,
        confidence: 1,
        reason: "projectKey",
      });
      usedCerto.add(hit.id);
      remaining.splice(i, 1);
    }
  }

  // Pass 2: exact normalized title
  for (let i = remaining.length - 1; i >= 0; i -= 1) {
    const pricing = remaining[i];
    const pricingNames = new Set(pricingTitles(pricing).map(compactToken));
    const hit = certoProjects.find((project) => {
      if (usedCerto.has(project.id)) return false;
      return candidateTitles(project).some((title) => pricingNames.has(compactToken(title)));
    });
    if (hit) {
      matched.push({
        pricing,
        projectId: hit.id,
        confidence: 1,
        reason: "exact-title",
      });
      usedCerto.add(hit.id);
      remaining.splice(i, 1);
    }
  }

  // Pass 3: fuzzy ≥ threshold, highest first
  type Scored = { pricing: PricingProjectRow; project: CertoProjectMatchInput; score: number };
  const scored: Scored[] = [];
  for (const pricing of remaining) {
    for (const project of certoProjects) {
      if (usedCerto.has(project.id)) continue;
      const score = Math.min(1, bestTitleScore(pricing, project) + entityBonus(pricing, project));
      if (score >= threshold) scored.push({ pricing, project, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const stillOpen = new Set(remaining.map((row) => row.projectId));
  for (const item of scored) {
    if (!stillOpen.has(item.pricing.projectId) || usedCerto.has(item.project.id)) continue;
    matched.push({
      pricing: item.pricing,
      projectId: item.project.id,
      confidence: item.score,
      reason: "fuzzy-title",
    });
    usedCerto.add(item.project.id);
    stillOpen.delete(item.pricing.projectId);
  }

  const unmatchedPricing = remaining.filter((row) => stillOpen.has(row.projectId));
  const unmatchedCertoIds = certoProjects
    .filter((project) => !usedCerto.has(project.id))
    .map((project) => project.id);

  return { matched, unmatchedPricing, unmatchedCertoIds };
}

export function buildPricingProjectPayload(
  row: PricingProjectRow,
  context: {
    userId: string;
    email?: string | null;
    workspaceId: string;
    shareUserIds?: string[];
    shareMemberIds?: string[];
    shareEmails?: string[];
    shareLabels?: string[];
  },
) {
  const title = clean(row.title) || clean(row.projectId) || "Untitled project";
  const bpo = clean(row.bpo) || "Internal";
  const client = clean(row.client) || "Internal";
  const technology = clean(row.solution);
  const phase = clean(row.phase);
  const sourceStatus = clean(row.status) || clean(row.stage);
  const health = mapSourceHealth(sourceStatus);
  const status = mapSourceStatus(sourceStatus, row.phase);
  const deliveryStage = normalizeDeliveryStage({
    phase,
    status: sourceStatus,
    deliveryStage: undefined,
  });
  const financePeriods = buildFinancePeriodsFromTransactions(row.transactions, {
    externalOrInternal: row.externalOrInternal,
  });
  const visibleToUserIds = unique([context.userId, ...(context.shareUserIds || [])].map(String));
  const visibleToEmails = unique(
    [context.email, ...(context.shareEmails || [])].map((value) => clean(value).toLowerCase()).filter(Boolean),
  );

  const costTotal = financePeriods
    .flatMap((period) => period.entries)
    .reduce((sum, entry) => sum + Number(entry.actualQty || 0) * Number(entry.rate || 0), 0);

  return stripUndefinedValues({
    userId: context.userId,
    workspaceId: context.workspaceId,
    createdBy: context.userId,
    ownerId: context.userId,
    visibility: (context.shareUserIds || []).length ? "shared" : "private",
    visibleToUserIds,
    visibleToEmails,
    sharedWithUserIds: unique((context.shareUserIds || []).map(String)),
    teamMemberIds: unique((context.shareMemberIds || []).map(String)),
    teamMembers: unique((context.shareLabels || []).map(String)),
    title,
    name: title,
    shortTitle: title,
    normalizedTitle: title.toLowerCase().replace(/\s+/g, " "),
    bpo,
    deliveryEntity: bpo,
    client,
    clientEntity: client,
    technology,
    category: technology,
    serviceLine: technology,
    phase,
    productPhase: mapProductPhase(row.phase) as ProductPhase,
    workCategory:
      token(row.externalOrInternal) === "internal" ? "Internal" : "Client Delivery",
    projectType: "delivery",
    methodology: "hybrid",
    sourceStatus,
    sourceStage: clean(row.stage),
    externalOrInternal: clean(row.externalOrInternal),
    projectKey: clean(row.projectId).slice(0, 64) || undefined,
    importKey: `pricing|${compactToken(row.projectId)}`,
    deliveryStage,
    status,
    health,
    healthOverride: health,
    financePeriods,
    currency: "USD",
    totalUsd: Math.round(costTotal * 100) / 100,
    excel: {
      projectName: title,
      bpo,
      cliente: client,
      tecnologia: technology,
      fase: phase,
      estado: sourceStatus,
      projectId: clean(row.projectId),
    },
    source: PRICING_PORTFOLIO_SOURCE,
    importedFrom: PRICING_PORTFOLIO_IMPORT_KEY,
    pricingImportKey: PRICING_PORTFOLIO_IMPORT_KEY,
  });
}

export function buildPricingProjectUpdate(row: PricingProjectRow) {
  const title = clean(row.title) || clean(row.projectId) || "Untitled project";
  const bpo = clean(row.bpo) || "Internal";
  const client = clean(row.client) || "Internal";
  const technology = clean(row.solution);
  const phase = clean(row.phase);
  const sourceStatus = clean(row.status) || clean(row.stage);
  const health = mapSourceHealth(sourceStatus);
  const status = mapSourceStatus(sourceStatus, row.phase);
  const deliveryStage = normalizeDeliveryStage({
    phase,
    status: sourceStatus,
    deliveryStage: undefined,
  });
  const financePeriods = buildFinancePeriodsFromTransactions(row.transactions, {
    externalOrInternal: row.externalOrInternal,
  });
  const costTotal = financePeriods
    .flatMap((period) => period.entries)
    .reduce((sum, entry) => sum + Number(entry.actualQty || 0) * Number(entry.rate || 0), 0);

  return stripUndefinedValues({
    title,
    name: title,
    shortTitle: title,
    normalizedTitle: title.toLowerCase().replace(/\s+/g, " "),
    bpo,
    deliveryEntity: bpo,
    client,
    clientEntity: client,
    technology,
    category: technology,
    serviceLine: technology,
    phase,
    productPhase: mapProductPhase(row.phase),
    workCategory:
      token(row.externalOrInternal) === "internal" ? "Internal" : "Client Delivery",
    sourceStatus,
    sourceStage: clean(row.stage),
    externalOrInternal: clean(row.externalOrInternal),
    projectKey: clean(row.projectId).slice(0, 64) || undefined,
    deliveryStage,
    status,
    health,
    healthOverride: health,
    financePeriods,
    currency: "USD",
    totalUsd: Math.round(costTotal * 100) / 100,
    excel: {
      projectName: title,
      bpo,
      cliente: client,
      tecnologia: technology,
      fase: phase,
      estado: sourceStatus,
      projectId: clean(row.projectId),
    },
    source: PRICING_PORTFOLIO_SOURCE,
    importedFrom: PRICING_PORTFOLIO_IMPORT_KEY,
    pricingImportKey: PRICING_PORTFOLIO_IMPORT_KEY,
  });
}

export function previewPricingSync(
  pricingProjects: PricingProjectRow[],
  certoProjects: CertoProjectMatchInput[],
) {
  const result = matchPricingProjects(pricingProjects, certoProjects);
  return {
    ...result,
    updateCount: result.matched.length,
    createCount: result.unmatchedPricing.length,
    markXCount: result.unmatchedCertoIds.length,
  };
}
