import assert from "node:assert/strict";
import test from "node:test";
import pricingFile from "../src/data/pricingPortfolio2026.json";
import {
  PRICING_MATCH_THRESHOLD,
  PRICING_PORTFOLIO_IMPORT_KEY,
  buildFinancePeriodsFromTransactions,
  buildPricingProjectPayload,
  buildPricingProjectUpdate,
  hasUnmatchedPrefix,
  mapChargeType,
  mapPricingUnit,
  matchPricingProjects,
  previewPricingSync,
  stripUnmatchedPrefix,
  titleSimilarity,
  transactionQuantities,
  withUnmatchedPrefix,
  type PricingPortfolioFile,
} from "../src/lib/pricingPortfolioSync";

const data = pricingFile as PricingPortfolioFile;

test("pricing JSON has 44 projects and transaction rows", () => {
  assert.equal(data.projectCount, 44);
  assert.equal(data.projects.length, 44);
  assert.equal(data.transactionCount, 563);
  assert.equal(
    data.projects.reduce((sum, row) => sum + row.transactions.length, 0),
    563,
  );
  for (const project of data.projects) {
    assert.ok(project.projectId);
    assert.ok(project.title);
    assert.ok(project.bpo);
    assert.ok(project.client);
    assert.ok(project.transactions.length >= 1);
  }
});

test("maps charge types, units, and Excel quantities without inventing blanks", () => {
  assert.equal(mapPricingUnit("Hour"), "hour");
  assert.equal(mapPricingUnit("Minute"), "ai_minute");
  assert.equal(mapPricingUnit("Interaction"), "transaction");
  assert.equal(mapPricingUnit("Project"), "fee");
  assert.equal(mapPricingUnit("Month"), "fee");

  assert.deepEqual(mapChargeType("Build Fee", "External"), {
    costType: "Direct Cost",
    allocationStage: "Build",
    category: "development",
    kind: "build",
  });
  assert.equal(mapChargeType("Maintenance and Support", "Internal").costType, "Internal Cost");
  assert.equal(mapChargeType("Consumption", "External").costType, "Pass-through Cost");
  assert.equal(mapChargeType("Token/Voice surcharge", "External").allocationStage, "Operations");

  const build = transactionQuantities({
    sourceRow: 1,
    units: 1,
    costPerUnit: null,
    cost: 0,
    price: 0,
  });
  assert.equal(build.qty, 1);
  assert.equal(build.rate, 0);

  const blankCost = transactionQuantities({
    sourceRow: 2,
    units: 3,
    costPerUnit: null,
    cost: null,
    price: null,
  });
  assert.equal(blankCost.qty, 3);
  assert.equal(blankCost.rate, 0);
  assert.equal(blankCost.priceRate, 0);

  const support = transactionQuantities({
    sourceRow: 3,
    units: 3,
    costPerUnit: 18,
    cost: 54,
    price: 83.0769230769,
  });
  assert.equal(support.rate, 18);
  assert.ok(Math.abs(support.priceRate - 83.0769230769 / 3) < 0.0001);
});

test("builds finance periods from monthly + build transactions", () => {
  const claro = data.projects.find((row) => row.projectId.includes("CLARO"));
  assert.ok(claro);
  const periods = buildFinancePeriodsFromTransactions(claro.transactions, {
    externalOrInternal: claro.externalOrInternal,
  });
  assert.ok(periods.some((period) => period.kind === "build"));
  assert.ok(periods.some((period) => period.kind === "monthly" && period.label === "2026-01"));
  const support = periods
    .flatMap((period) => period.entries)
    .find((entry) => entry.description.includes("Maintenance"));
  assert.ok(support);
  assert.equal(support.costType, "Recurring Cost");
  assert.equal(support.allocationStage, "Support");
  assert.equal(support.unit, "hour");
  assert.equal(support.serviceSolution, "AI Agent");
});

test("BPO maps to deliveryEntity and Client to clientEntity", () => {
  const row = data.projects.find((item) => item.bpo === "Apex" && item.client === "TECO");
  assert.ok(row);
  const payload = buildPricingProjectPayload(row, {
    userId: "owner-1",
    email: "alejandro@getboldr.ai",
    workspaceId: "pure-ai",
  });
  assert.equal(payload.deliveryEntity, "Apex");
  assert.equal(payload.bpo, "Apex");
  assert.equal(payload.clientEntity, "TECO");
  assert.equal(payload.client, "TECO");
  assert.equal(payload.technology, "AI Sparring");
  assert.equal(payload.importedFrom, PRICING_PORTFOLIO_IMPORT_KEY);
  assert.ok(Array.isArray(payload.financePeriods));
  assert.ok((payload.financePeriods as unknown[]).length > 0);

  const update = buildPricingProjectUpdate(row);
  assert.equal(update.deliveryEntity, "Apex");
  assert.equal(update.clientEntity, "TECO");
});

test("fuzzy match reaches ~80% and prefixes unmatched with X", () => {
  assert.ok(titleSimilarity("AI Sparring AI Trainer Banrural Allied Global 2026", "AI Trainer Banrural Allied") >= 0.8);
  assert.ok(
    titleSimilarity(
      "AI Agent APEX Claro Argentina Encuesta Claro Argentina Apex",
      "Claro Argentina Encuesta Apex",
    ) >= PRICING_MATCH_THRESHOLD,
  );

  const pricing = data.projects.slice(0, 3);
  const certo = [
    {
      id: "c1",
      title: pricing[0].title,
      projectKey: pricing[0].projectId,
      clientEntity: pricing[0].client,
      deliveryEntity: pricing[0].bpo,
    },
    {
      id: "c2",
      // Slightly different title — should still fuzzy-match
      title: pricing[1].title.replace(/\s+2026$/, " '26"),
      clientEntity: pricing[1].client,
      deliveryEntity: pricing[1].bpo,
      technology: pricing[1].solution,
    },
    {
      id: "orphan",
      title: "Legacy Pure AI project with no pricing row",
    },
  ];

  const preview = previewPricingSync(pricing, certo);
  assert.equal(preview.updateCount, 2);
  assert.equal(preview.createCount, 1);
  assert.equal(preview.markXCount, 1);
  assert.deepEqual(preview.unmatchedCertoIds, ["orphan"]);

  const exact = matchPricingProjects(
    [pricing[0]],
    [{ id: "x", title: "X " + pricing[0].title, projectKey: "other" }],
  );
  assert.equal(exact.matched[0]?.reason, "exact-title");
  assert.equal(stripUnmatchedPrefix("X Banrural"), "Banrural");
  assert.equal(withUnmatchedPrefix("Banrural"), "X Banrural");
  assert.equal(hasUnmatchedPrefix("X Banrural"), true);
  assert.equal(hasUnmatchedPrefix("Banrural"), false);
});
