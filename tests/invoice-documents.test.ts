import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  canTransitionInvoice,
  clientActionsForStatus,
  financeActionsForStatus,
  financeEntryPatchForInvoice,
  filterInvoiceQueue,
  invoicePortalPath,
  invoiceQueueCounts,
  invoiceStatusLabel,
  isInvoiceOverdue,
  nextInvoiceNumber,
  pendingInvoiceLines,
} from "../src/lib/invoiceDocuments";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";

test("Ariba-style invoice statuses cover billed through paid, plus problem and void", () => {
  assert.equal(invoiceStatusLabel("billed"), "Billed");
  assert.equal(invoiceStatusLabel("sent"), "Sent");
  assert.equal(invoiceStatusLabel("pending_approval"), "Pending approval");
  assert.equal(invoiceStatusLabel("approved"), "Approved");
  assert.equal(invoiceStatusLabel("paid"), "Paid");
  assert.equal(invoiceStatusLabel("rejected"), "Rejected");
  assert.equal(invoiceStatusLabel("void"), "Void");
  assert.equal(invoiceStatusLabel("exception"), "Problem");
});

test("finance can send, approve, pay, reject, void, or flag a problem", () => {
  assert.deepEqual(financeActionsForStatus("billed"), ["sent", "exception", "void"]);
  assert.ok(canTransitionInvoice("sent", "approved", "finance"));
  assert.ok(canTransitionInvoice("approved", "paid", "finance"));
  assert.equal(canTransitionInvoice("paid", "void", "finance"), false);
});

test("client portal can only confirm payment, reject, or flag a problem", () => {
  assert.deepEqual(clientActionsForStatus("approved"), ["paid", "rejected", "exception"]);
  assert.equal(canTransitionInvoice("approved", "paid", "client"), true);
  assert.equal(canTransitionInvoice("approved", "void", "client"), false);
  assert.equal(canTransitionInvoice("billed", "paid", "client"), false);
});

test("pending project revenue lines become the push queue until they have a document", () => {
  const pending = pendingInvoiceLines(
    [
      {
        id: "p1",
        title: "Agent build",
        clientEntity: "Acme",
        currency: "USD",
        financePeriods: [
          {
            id: "per1",
            kind: "build",
            label: "Build V1",
            entries: [
              {
                id: "inv1",
                direction: "revenue",
                description: "Build invoice",
                unit: "fee",
                actualQty: 1,
                rate: 12000,
                dueDate: "2026-09-01",
                invoiceStatus: "not_billed",
              },
              {
                id: "paid1",
                direction: "revenue",
                description: "Already paid",
                unit: "fee",
                actualQty: 1,
                rate: 1000,
                paymentStatus: "paid",
              },
            ],
          },
        ],
      },
    ],
    [{ id: "doc", projectId: "p1", entryId: "other", status: "sent" }],
  );
  assert.equal(pending.length, 1);
  assert.equal(pending[0].title, "Build invoice");
  assert.equal(pending[0].amount, 12000);
  assert.equal(pending[0].clientName, "Acme");
});

test("paid invoices write collection back onto the project finance line", () => {
  const patch = financeEntryPatchForInvoice({
    id: "inv",
    status: "paid",
    amount: 8000,
    settledAmount: 8000,
    settledDate: "2026-08-20",
    invoiceNumber: "INV-202608-001",
  });
  assert.equal(patch.financialStatus, "paid");
  assert.equal(patch.paymentStatus, "paid");
  assert.equal(patch.referenceNumber, "INV-202608-001");
});

test("overdue tiles only include open invoices past due", () => {
  const now = new Date("2026-08-24T12:00:00Z");
  const invoices = [
    { id: "a", status: "approved", dueDate: "2026-08-01", paymentStatus: "unpaid" },
    { id: "b", status: "paid", dueDate: "2026-08-01", paymentStatus: "paid" },
    { id: "c", status: "sent", dueDate: "2026-09-01", paymentStatus: "unpaid" },
  ];
  assert.equal(isInvoiceOverdue(invoices[0], now), true);
  assert.equal(filterInvoiceQueue(invoices, "overdue", now).map((item) => item.id).join(), "a");
  assert.equal(invoiceQueueCounts(invoices, 2, now).ready, 2);
  assert.equal(invoiceQueueCounts(invoices, 2, now).overdue, 1);
});

test("invoice numbers increment inside the calendar month", () => {
  assert.equal(
    nextInvoiceNumber(["INV-202608-001", "INV-202608-004"], new Date("2026-08-24")),
    "INV-202608-005",
  );
});

test("invoice routes split finance queue from the client portal", () => {
  assert.deepEqual(resolveDelivereeLens("/invoices"), { kind: "invoices" });
  assert.deepEqual(resolveDelivereeLens("/finance"), { kind: "invoices" });
  assert.equal(invoicePortalPath("abc123"), "/invoice/abc123");
});

test("invoice rules and UI stay aligned", () => {
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  const workspace = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  const center = readFileSync(resolve("src/components/InvoiceCenter.tsx"), "utf8");
  const portal = readFileSync(resolve("src/components/PublicInvoicePortal.tsx"), "utf8");

  assert.match(rules, /match \/invoice_documents\/\{id\}/);
  assert.match(rules, /function isFinanceOperator\(workspaceId\)/);
  assert.match(workspace, /doc\(db, "invoice_documents"/);
  assert.match(center, /invoice-finance-queue/);
  assert.match(center, /Push to AP/);
  assert.match(portal, /invoice-client-portal/);
});
