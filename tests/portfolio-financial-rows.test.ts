import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPortfolioFinanceRows,
  ensureProjectFinanceColumn,
  filterPortfolioFinanceRows,
  groupPortfolioFinanceByMonthThenProject,
  groupPortfolioFinanceRows,
} from "../src/lib/portfolioFinancialRows";

const sampleProjects = [
  {
    id: "p1",
    title: "AI Agent Claro",
    projectKey: "CLARO-1",
    clientEntity: "Claro Argentina",
    deliveryEntity: "Apex",
    technology: "AI Agent",
    externalOrInternal: "External",
    sourceStage: "Build",
    phase: "Producción",
    sourceStatus: "On track",
    status: "active",
    financePeriods: [
      {
        id: "per1",
        kind: "monthly",
        year: 2026,
        month: 1,
        label: "Jan 2026",
        entries: [
          {
            id: "e1",
            direction: "cost",
            description: "Support hours",
            costType: "Maintenance and Support",
            unit: "hour",
            actualQty: 3,
            rate: 18,
            priceRate: 27.6933,
            financialStatus: "billed",
            accountingMonth: "2026-01",
            serviceSolution: "AI Agent",
          },
          {
            id: "e2",
            direction: "cost",
            description: "Build fee",
            costType: "Build",
            unit: "fee",
            actualQty: 1,
            rate: 1000,
            priceRate: 1500,
            financialStatus: "not_billed",
            accountingMonth: "2026-01",
            serviceSolution: "AI Agent",
          },
          {
            id: "rev",
            direction: "revenue",
            description: "Invoice",
            actualQty: 1,
            rate: 1500,
          },
        ],
      },
      {
        id: "per2",
        kind: "monthly",
        year: 2026,
        month: 2,
        label: "Feb 2026",
        entries: [
          {
            id: "e3",
            direction: "cost",
            description: "Tokens",
            costType: "Ops Consumptions",
            unit: "ai_minute",
            actualQty: 100,
            rate: 0.2,
            priceRate: 0.3,
            financialStatus: "not_billed",
            accountingMonth: "2026-02",
            serviceSolution: "Voice",
          },
        ],
      },
    ],
  },
  {
    id: "p2",
    title: "Internal tooling",
    clientEntity: "Internal",
    deliveryEntity: "Certo",
    technology: "Platform",
    status: "active",
    financePeriods: [
      {
        id: "per3",
        kind: "build",
        label: "Build",
        entries: [
          {
            id: "e4",
            direction: "cost",
            description: "Configuration",
            costType: "Configuration",
            unit: "hour",
            actualQty: 5,
            rate: 40,
            priceRate: 50,
            financialStatus: "billed",
          },
        ],
      },
    ],
  },
];

test("builds Excel-like flat rows and skips revenue lines", () => {
  const rows = buildPortfolioFinanceRows(sampleProjects);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((row) => row.id.includes(":")));
  assert.equal(
    rows.find((row) => row.id.includes("rev")),
    undefined,
  );
  const billed = rows.find((row) => row.id.endsWith("e1"));
  assert.equal(billed?.billed, true);
  assert.equal(billed?.client, "Claro Argentina");
  assert.equal(billed?.type, "Maintenance and Support");
  assert.equal(billed?.status, "On track");
  assert.equal(billed?.monthKey, "2026-01");
});

test("filters by client, period, product, type, and billed", () => {
  const rows = buildPortfolioFinanceRows(sampleProjects);
  const filtered = filterPortfolioFinanceRows(rows, {
    client: "Claro Argentina",
    month: "2026-01",
    product: "AI Agent",
    type: "Build",
    billed: "unbilled",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].type, "Build");
  assert.equal(filtered[0].billed, false);
});

test("groups by client, period, and product with cost/price subtotals", () => {
  const rows = buildPortfolioFinanceRows(sampleProjects);
  const byClient = groupPortfolioFinanceRows(rows, "client");
  assert.deepEqual(
    byClient.map((group) => group.key).sort(),
    ["Claro Argentina", "Internal"],
  );
  const claro = byClient.find((group) => group.key === "Claro Argentina");
  assert.equal(claro?.rows.length, 3);
  assert.ok((claro?.cost || 0) > 0);
  assert.ok((claro?.price || 0) > 0);

  const byMonth = groupPortfolioFinanceRows(rows, "month");
  assert.ok(byMonth.some((group) => group.key === "2026-01"));

  const byProduct = groupPortfolioFinanceRows(rows, "product");
  assert.deepEqual(
    byProduct.map((group) => group.key).sort(),
    ["AI Agent", "Platform", "Voice"],
  );
});

test("breaks by month chronologically then by project with cost and price totals", () => {
  const rows = buildPortfolioFinanceRows(sampleProjects);
  const breaks = groupPortfolioFinanceByMonthThenProject(rows);
  assert.deepEqual(
    breaks.map((month) => month.key),
    ["build", "2026-01", "2026-02"],
  );
  assert.equal(breaks[0].label, "Build / unscheduled");
  assert.equal(breaks[1].projects.length, 1);
  assert.equal(breaks[1].projects[0].label, "AI Agent Claro");
  assert.equal(breaks[1].projects[0].rows.length, 2);
  assert.ok(breaks[1].cost > 0);
  assert.ok(breaks[1].price > 0);
  assert.equal(
    breaks[1].cost,
    breaks[1].projects.reduce((sum, project) => sum + project.cost, 0),
  );
});

test("applies Excel-style column filters and keeps project column frozen first", () => {
  const rows = buildPortfolioFinanceRows(sampleProjects);
  const filtered = filterPortfolioFinanceRows(rows, {
    columnFilters: {
      type: ["Ops Consumptions"],
      client: ["Claro Argentina"],
    },
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].type, "Ops Consumptions");
  assert.deepEqual(ensureProjectFinanceColumn(["client", "cost"]), [
    "project",
    "client",
    "cost",
    "billingStatus",
    "vendorPayStatus",
    "vendorInvoice",
    "clientInvoice",
    "followUp",
  ]);
});
