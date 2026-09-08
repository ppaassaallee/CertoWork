import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCE_LINE_TASK_SOURCE,
  financeBillingStatusPatch,
  financeLineIdFromTask,
  isFinanceLineTask,
  normalizeFinanceBillingStatus,
  normalizeFinanceVendorPayStatus,
  parseFinanceLineId,
} from "../src/lib/financeBillingStatuses";
import {
  financeLineFollowUpTitle,
  patchProjectFinanceLine,
} from "../src/lib/financeLineActions";
import {
  buildPortfolioFinanceRows,
  defaultPortfolioFinanceColumns,
  ensureProjectFinanceColumn,
} from "../src/lib/portfolioFinancialRows";

test("normalizes billing and vendor pay statuses", () => {
  assert.equal(normalizeFinanceBillingStatus("invoiced"), "billed");
  assert.equal(normalizeFinanceBillingStatus("paid"), "paid");
  assert.equal(normalizeFinanceVendorPayStatus("overdue"), "overdue");
  assert.deepEqual(financeBillingStatusPatch("billed").invoiceStatus, "invoiced");
});

test("parses finance line ids and patches project finance periods", () => {
  const project = {
    id: "p1",
    financePeriods: [
      {
        id: "per1",
        kind: "monthly",
        year: 2026,
        month: 1,
        label: "Jan",
        status: "open",
        currency: "USD",
        entries: [
          {
            id: "e1",
            direction: "cost",
            description: "Support",
            category: "support",
            unit: "hour",
            plannedQty: 1,
            actualQty: 1,
            rate: 10,
            financialStatus: "not_billed",
            paymentStatus: "unpaid",
          },
        ],
      },
    ],
  };
  const lineId = "p1:per1:e1";
  assert.deepEqual(parseFinanceLineId(lineId), {
    projectId: "p1",
    periodId: "per1",
    entryId: "e1",
  });
  const next = patchProjectFinanceLine(project, lineId, {
    ...financeBillingStatusPatch("billed"),
    vendorInvoice: "V-100",
    clientInvoice: "C-200",
  });
  assert.equal(next?.[0].entries[0].financialStatus, "billed");
  assert.equal(next?.[0].entries[0].vendorInvoice, "V-100");
  assert.equal(next?.[0].entries[0].clientInvoice, "C-200");
});

test("default finance columns hide source and keep follow-up + billing fields", () => {
  assert.equal(defaultPortfolioFinanceColumns.includes("source"), false);
  assert.ok(defaultPortfolioFinanceColumns.includes("billingStatus"));
  assert.ok(defaultPortfolioFinanceColumns.includes("vendorPayStatus"));
  assert.ok(defaultPortfolioFinanceColumns.includes("followUp"));
  const ensured = ensureProjectFinanceColumn(["client", "cost", "source"]);
  assert.equal(ensured[0], "project");
  assert.equal(ensured.at(-1), "followUp");
  assert.ok(ensured.includes("billingStatus"));
  assert.ok(ensured.includes("clientInvoice"));
});

test("builds rows with billing and invoice fields", () => {
  const rows = buildPortfolioFinanceRows([
    {
      id: "p1",
      title: "Demo",
      status: "active",
      financePeriods: [
        {
          id: "per1",
          kind: "monthly",
          year: 2026,
          month: 3,
          label: "Mar",
          entries: [
            {
              id: "e1",
              direction: "cost",
              description: "Ops",
              costType: "Ops Consumptions",
              unit: "fee",
              actualQty: 1,
              rate: 5,
              priceRate: 8,
              financialStatus: "billed",
              paymentStatus: "partial",
              vendorInvoice: "VIN-1",
              clientInvoice: "CIN-1",
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].billingStatus, "billed");
  assert.equal(rows[0].vendorPayStatus, "partial");
  assert.equal(rows[0].vendorInvoice, "VIN-1");
  assert.equal(rows[0].clientInvoice, "CIN-1");
  assert.ok(financeLineFollowUpTitle(rows[0]).includes("Demo"));
});

test("detects finance-line follow-up tasks", () => {
  const task = {
    source: FINANCE_LINE_TASK_SOURCE,
    sourceFinanceLineId: "p1:per1:e1",
  };
  assert.equal(isFinanceLineTask(task), true);
  assert.equal(financeLineIdFromTask(task), "p1:per1:e1");
});
