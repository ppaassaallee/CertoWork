import assert from "node:assert/strict";
import test from "node:test";

import { financeSummary, normalizedFinancePeriods, projectFinancialRollup } from "../src/lib/projectFinance";

const project = {
  id: "project-1",
  financePeriods: [
    {
      id: "build-v1",
      kind: "build",
      label: "Build V1",
      status: "closed",
      currency: "USD",
      entries: [
        { id: "dev", direction: "cost", description: "Development", category: "development", unit: "hour", plannedQty: 100, actualQty: 110, rate: 50, paymentStatus: "paid", settledAmount: 5500 },
        { id: "invoice", direction: "revenue", description: "Build invoice", category: "revenue", unit: "fee", plannedQty: 1, actualQty: 1, rate: 10000, referenceNumber: "INV-001", paymentStatus: "partial", settledAmount: 4000 },
      ],
    },
    {
      id: "build-cr1",
      kind: "build",
      label: "Build CR1",
      status: "active",
      currency: "USD",
      entries: [
        { id: "cr-dev", direction: "cost", description: "Change request", category: "development", unit: "hour", plannedQty: 20, actualQty: 10, rate: 60, paymentStatus: "incurred" },
      ],
    },
    {
      id: "monthly-july",
      kind: "monthly",
      label: "July 2026",
      month: 7,
      year: 2026,
      status: "closed",
      currency: "USD",
      entries: [
        { id: "support-july", direction: "cost", description: "Support", category: "support", unit: "hour", plannedQty: 20, actualQty: 18, rate: 40, paymentStatus: "paid" },
      ],
    },
    {
      id: "monthly-august",
      kind: "monthly",
      label: "August 2026",
      month: 8,
      year: 2026,
      status: "active",
      currency: "USD",
      entries: [
        { id: "support-aug", direction: "cost", description: "Support", category: "support", unit: "hour", plannedQty: 25, actualQty: 20, rate: 40, paymentStatus: "incurred" },
      ],
    },
  ],
};

test("financial ledger separates revenue, invoicing and cash collection", () => {
  const summary = financeSummary(normalizedFinancePeriods(project));
  assert.equal(summary.actualCost, 7620);
  assert.equal(summary.actualRevenue, 10000);
  assert.equal(summary.invoiced, 10000);
  assert.equal(summary.collected, 4000);
  assert.equal(summary.outstanding, 6000);
  assert.equal(summary.margin, 2380);
});

test("portfolio uses all build costs and only the latest monthly period", () => {
  const summary = projectFinancialRollup(project);
  assert.equal(summary.buildCost, 6100);
  assert.equal(summary.latestMonthlyCost, 800);
  assert.equal(summary.plannedHours, 165);
  assert.equal(summary.actualHours, 158);
});

test("void financial movements do not affect audited totals", () => {
  const periods = normalizedFinancePeriods({
    financePeriods: [{
      id: "build-v1",
      kind: "build",
      entries: [{ id: "void-invoice", direction: "revenue", unit: "fee", plannedQty: 1, actualQty: 1, rate: 5000, paymentStatus: "void", settledAmount: 5000 }],
    }],
  });
  assert.deepEqual(financeSummary(periods), {
    actualCost: 0,
    plannedCost: 0,
    actualRevenue: 0,
    plannedRevenue: 0,
    invoiced: 0,
    collected: 0,
    outstanding: 0,
    margin: 0,
  });
});
