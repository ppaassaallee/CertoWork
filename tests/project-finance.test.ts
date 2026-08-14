import assert from "node:assert/strict";
import test from "node:test";

import {
  financeCapacityAllocations,
  financeSummary,
  normalizedFinancePeriods,
  projectFinancialRollup,
  stripUndefinedValues,
} from "../src/lib/projectFinance";

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
        {
          id: "dev",
          direction: "cost",
          description: "Development",
          category: "development",
          unit: "hour",
          plannedQty: 100,
          actualQty: 110,
          rate: 50,
          paymentStatus: "paid",
          settledAmount: 5500,
        },
        {
          id: "invoice",
          direction: "revenue",
          description: "Build invoice",
          category: "revenue",
          unit: "fee",
          plannedQty: 1,
          actualQty: 1,
          rate: 10000,
          referenceNumber: "INV-001",
          paymentStatus: "partial",
          settledAmount: 4000,
        },
      ],
    },
    {
      id: "build-cr1",
      kind: "build",
      label: "Build CR1",
      status: "active",
      currency: "USD",
      entries: [
        {
          id: "cr-dev",
          direction: "cost",
          description: "Change request",
          category: "development",
          unit: "hour",
          plannedQty: 20,
          actualQty: 10,
          rate: 60,
          paymentStatus: "incurred",
        },
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
        {
          id: "support-july",
          direction: "cost",
          description: "Support",
          category: "support",
          unit: "hour",
          plannedQty: 20,
          actualQty: 18,
          rate: 40,
          paymentStatus: "paid",
        },
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
        {
          id: "support-aug",
          direction: "cost",
          description: "Support",
          category: "support",
          unit: "hour",
          plannedQty: 25,
          actualQty: 20,
          rate: 40,
          paymentStatus: "incurred",
        },
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
    financePeriods: [
      {
        id: "build-v1",
        kind: "build",
        entries: [
          {
            id: "void-invoice",
            direction: "revenue",
            unit: "fee",
            plannedQty: 1,
            actualQty: 1,
            rate: 5000,
            paymentStatus: "void",
            settledAmount: 5000,
          },
        ],
      },
    ],
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

test("calendar-month billing keeps budget, invoice and collection separate", () => {
  const periods = normalizedFinancePeriods({
    financePeriods: [
      {
        id: "build-v2",
        kind: "build",
        label: "Build V2",
        entries: [
          {
            id: "installment-1",
            direction: "revenue",
            description: "Build installment",
            unit: "fee",
            accountingMonth: "2026-09",
            plannedQty: 1,
            actualQty: 1,
            plannedRate: 12000,
            rate: 11500,
            invoiceStatus: "invoiced",
            paymentStatus: "partial",
            settledAmount: 5000,
          },
        ],
      },
    ],
  });
  const summary = financeSummary(periods);
  assert.equal(periods[0].entries[0].accountingMonth, "2026-09");
  assert.equal(summary.plannedRevenue, 12000);
  assert.equal(summary.invoiced, 11500);
  assert.equal(summary.collected, 5000);
  assert.equal(summary.outstanding, 6500);
});

test("every financial movement keeps an exact date, calendar period and simple status", () => {
  const periods = normalizedFinancePeriods({
    financePeriods: [
      {
        id: "build-v3",
        kind: "build",
        label: "Build V3",
        month: 9,
        year: 2026,
        entries: [
          {
            id: "vendor-cost",
            direction: "cost",
            description: "Voice AI usage",
            unit: "ai_minute",
            actualQty: 1000,
            rate: 0.08,
            transactionDate: "2026-09-18",
            financialStatus: "disputed",
          },
        ],
      },
    ],
  });
  const entry = periods[0].entries[0];
  assert.equal(periods[0].month, 9);
  assert.equal(periods[0].year, 2026);
  assert.equal(entry.accountingMonth, "2026-09");
  assert.equal(entry.transactionDate, "2026-09-18");
  assert.equal(entry.financialStatus, "disputed");
});

test("cost allocation lines preserve Excel-style drivers and feed capacity planning", () => {
  const periods = normalizedFinancePeriods({
    financePeriods: [
      {
        id: "build-allocation",
        kind: "build",
        label: "Build V1",
        month: 9,
        year: 2026,
        entries: [
          {
            id: "internal-hours",
            direction: "cost",
            description: "Hours",
            type: "Direct Allocation Cost",
            stage: "Build",
            service: "Agentic Project",
            unit: "hour",
            plannedQty: 100,
            actualQty: 110,
            plannedRate: 23,
            actualRate: 23,
            assignee: "Juan Perez",
          },
          {
            id: "vendor-minutes",
            direction: "cost",
            description: "AI consumption for build phase",
            costType: "Direct Cost",
            allocationStage: "Build",
            serviceSolution: "Agentic Project",
            unit: "ai_minute",
            plannedQty: 2300,
            actualQty: 1200,
            rate: 0.43,
            vendor: "Retell AI",
          },
        ],
      },
    ],
  });

  const [hours, minutes] = periods[0].entries;
  assert.equal(hours.costType, "Direct Allocation Cost");
  assert.equal(hours.allocationStage, "Build");
  assert.equal(hours.serviceSolution, "Agentic Project");
  assert.equal(hours.assignee, "Juan Perez");
  assert.equal(minutes.vendor, "Retell AI");

  const capacity = financeCapacityAllocations(periods);
  assert.deepEqual(capacity.byAssignee[0], {
    name: "Juan Perez",
    plannedHours: 100,
    actualHours: 110,
    plannedCost: 2300,
    actualCost: 2530,
  });
  assert.deepEqual(capacity.byStage[0], {
    name: "Build",
    plannedHours: 100,
    actualHours: 110,
    plannedCost: 2300,
    actualCost: 2530,
  });
});

test("financial periods are cleaned before Firestore storage", () => {
  const cleaned = stripUndefinedValues([
    {
      id: "period",
      sourceTemplateId: undefined,
      entries: [
        {
          id: "entry",
          invoiceStatus: undefined,
          nested: { keep: "yes", remove: undefined },
        },
      ],
    },
  ]);

  assert.deepEqual(cleaned, [
    {
      id: "period",
      entries: [
        {
          id: "entry",
          nested: { keep: "yes" },
        },
      ],
    },
  ]);
});
