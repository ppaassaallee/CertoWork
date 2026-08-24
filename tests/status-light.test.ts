import assert from "node:assert/strict";
import test from "node:test";
import { healthToStatus, taskDueStatus } from "../src/components/ui/StatusLight";
import { t } from "../src/lib/i18n";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";

test("health maps onto semáforo tones", () => {
  assert.equal(healthToStatus("on_track"), "green");
  assert.equal(healthToStatus("at_risk"), "amber");
  assert.equal(healthToStatus("blocked"), "red");
});

test("task due dates map onto semáforo tones", () => {
  const now = Date.parse("2026-08-21T12:00:00Z");
  assert.equal(taskDueStatus({ status: "done", now }), "green");
  assert.equal(taskDueStatus({ status: "open", dueDate: "2026-08-21", now }), "amber");
  assert.equal(taskDueStatus({ status: "open", dueDate: "2026-08-01", now }), "red");
});

test("primary nav labels stay in one language", () => {
  assert.equal(t("navHome", "en"), "Home");
  assert.equal(t("navApprovals", "en"), "Approvals");
  assert.equal(t("navInvoices", "en"), "Invoices");
  assert.equal(t("moreAutomations", "en"), "Automations");
  assert.equal(t("moreUpdates", "en"), "Updates");
});

test("approvals and project tabs are URL screens", () => {
  assert.deepEqual(resolveDelivereeLens("/approvals"), { kind: "approvals" });
  assert.deepEqual(resolveDelivereeLens("/invoices"), { kind: "invoices" });
  assert.deepEqual(resolveDelivereeLens("/work/projects/abc/notes"), {
    kind: "project",
    projectId: "abc",
    tab: "notes",
  });
  assert.deepEqual(resolveDelivereeLens("/settings"), { kind: "settings" });
});
