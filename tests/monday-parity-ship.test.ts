import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { emptyTableFilters, filterTableRecords, tableFiltersActive } from "../src/lib/tables/filters";
import { buildWorkloadRows } from "../src/lib/workload";
import {
  addDashboardWidget,
  defaultDashboardLayout,
  removeDashboardWidget,
} from "../src/lib/dashboardLayout";
import { parseInboundItemUpdate } from "../src/lib/itemUpdateChannels";
import { resolveDelivereeLens, lensToPath } from "../src/lib/delivereeRoutes";

const root = resolve(import.meta.dirname, "..");

test("table filters match query status owner and dates", () => {
  const table = {
    columns: [
      { id: "title", name: "Title", type: "text" },
      { id: "status", name: "Status", type: "status" },
      { id: "owner", name: "Owner", type: "person" },
      { id: "date", name: "Date", type: "date" },
    ],
    keyColumns: { title: "title", status: "status", owner: "owner", date: "date" },
  };
  const records = [
    { id: "1", values: { title: "Alpha", status: "todo", owner: "u1", date: "2026-09-16" } },
    { id: "2", values: { title: "Beta", status: "done", owner: "u2", date: "2026-09-20" } },
  ] as any;
  assert.equal(tableFiltersActive(emptyTableFilters()), false);
  const filtered = filterTableRecords(table as any, records, {
    ...emptyTableFilters(),
    query: "alp",
    statusIds: ["todo"],
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "1");
});

test("workload groups assignees for this week and overdue", () => {
  const now = new Date("2026-09-16T12:00:00");
  const rows = buildWorkloadRows({
    now,
    capacityHoursPerPerson: 40,
    projects: [{ id: "p1", title: "Launch" }],
    members: [{ userId: "u1", displayName: "Alex" }],
    tasks: [
      {
        id: "t1",
        title: "Ship",
        status: "open",
        assigneeId: "u1",
        projectId: "p1",
        dueDate: "2026-09-17",
        estimateHours: 8,
      },
      {
        id: "t2",
        title: "Late",
        status: "open",
        assigneeId: "u1",
        dueDate: "2026-09-10",
        estimateHours: 4,
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].assigneeName, "Alex");
  assert.equal(rows[0].itemCount, 2);
  assert.equal(rows[0].estimateHours, 12);
  assert.equal(rows[0].overdueCount, 1);
});

test("dashboard layout add/remove widgets", () => {
  let layout = defaultDashboardLayout();
  const before = layout.widgets.length;
  layout = addDashboardWidget(layout, "approvals");
  assert.ok(layout.widgets.some((w) => w.kind === "approvals"));
  const id = layout.widgets[0].id;
  layout = removeDashboardWidget(layout, id);
  assert.equal(layout.widgets.length, before);
});

test("inbound item update parses item id", () => {
  assert.deepEqual(parseInboundItemUpdate("item:abc123 please update status"), {
    itemId: "abc123",
    message: "please update status",
  });
  assert.equal(parseInboundItemUpdate("[certo-item:xyz] done").itemId, "xyz");
});

test("dashboard and workload routes resolve", () => {
  assert.deepEqual(resolveDelivereeLens("/dashboard"), { kind: "dashboard" });
  assert.deepEqual(resolveDelivereeLens("/workload"), { kind: "workload" });
  assert.equal(lensToPath({ kind: "dashboard" }), "/dashboard");
  assert.equal(lensToPath({ kind: "workload" }), "/workload");
});

test("worker exposes item notify and inbound endpoints", () => {
  const worker = readFileSync(resolve(root, "worker/index.js"), "utf8");
  assert.match(worker, /\/api\/items\/notify/);
  assert.match(worker, /\/api\/items\/inbound/);
  assert.match(worker, /notifyItemUpdate/);
});

test("table form and filter UI are wired", () => {
  const page = readFileSync(resolve(root, "src/features/tables/TablePage.tsx"), "utf8");
  assert.match(page, /TableFiltersBar/);
  assert.match(page, /TableFormView/);
  assert.match(page, /filterTableRecords/);
  assert.match(page, /\["form"/);
});
