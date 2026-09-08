import assert from "node:assert/strict";
import test from "node:test";
import {
  financeMonthKey,
  financeMonthLabel,
  isFinanceLineBilled,
  normalizeChargeLineType,
} from "../src/lib/financeChargeTypes";

test("infers charge line types from legacy cost metadata", () => {
  assert.equal(
    normalizeChargeLineType({ costType: "Direct Cost", allocationStage: "Build" }),
    "Build",
  );
  assert.equal(
    normalizeChargeLineType({
      costType: "Recurring Cost",
      description: "Maintenance and Support · 2026-01",
    }),
    "Maintenance and Support",
  );
  assert.equal(
    normalizeChargeLineType({
      costType: "Pass-through Cost",
      description: "Consumption · Agent IDs",
      unit: "ai_minute",
    }),
    "Ops Consumptions",
  );
  assert.equal(
    normalizeChargeLineType({
      allocationStage: "Onboarding",
      description: "Configuration setup",
    }),
    "Configuration",
  );
  assert.equal(normalizeChargeLineType({ costType: "Build" }), "Build");
});

test("marks billed and paid finance lines", () => {
  assert.equal(isFinanceLineBilled({ financialStatus: "billed" }), true);
  assert.equal(isFinanceLineBilled({ financialStatus: "paid" }), true);
  assert.equal(isFinanceLineBilled({ financialStatus: "not_billed" }), false);
  assert.equal(isFinanceLineBilled({ invoiceStatus: "invoiced" }), true);
});

test("formats month keys for period subtotals", () => {
  assert.equal(financeMonthKey({ accountingMonth: "2026-03-01" }), "2026-03");
  assert.equal(financeMonthKey({}, { year: 2026, month: 7 }), "2026-07");
  assert.equal(financeMonthLabel("2026-03"), "Mar 2026");
  assert.equal(financeMonthLabel("build"), "Build / unscheduled");
});
