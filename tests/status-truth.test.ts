import assert from "node:assert/strict";
import test from "node:test";
import { itemDueKey } from "../src/lib/kanbanFeatures";
import {
  columnOrderAfterDrop,
  kanbanColumnForStatus,
  statusForKanbanColumn,
  visibleBoardColumns,
} from "../src/lib/kanbanBoard";
import { dateRangeError } from "../src/lib/itemTiming";
import {
  projectAttentionReason,
  projectHealth,
  upcomingWorkCheckpoints,
} from "../src/lib/projectPortfolio";
import { projectWorkCounts } from "../src/lib/projectWorkCounts";
import { toDateKey } from "../src/shared/formatDate";
import { passesStatusView, WORK_STATUS_KEYS } from "../src/lib/workStatuses";
import { uniqueWorkItemKey, workItemChipLabel } from "../src/lib/workItemKey";

const october = new Date(2026, 9, 12, 18, 0, 0);

test("stored on_track cannot hide blocked work, overdue items, or a past delivery date", () => {
  assert.equal(
    projectHealth({ health: "on_track", status: "active" }, [{ status: "blocked" }], [], october),
    "blocked",
  );
  assert.equal(
    projectHealth(
      { health: "on_track", status: "active", dueDate: "2026-09-14" },
      [],
      [],
      october,
    ),
    "at_risk",
  );
  assert.equal(
    projectHealth(
      { health: "on_track", status: "active" },
      [{ status: "todo", dueDate: "2026-10-01" }],
      [],
      october,
    ),
    "at_risk",
  );
  assert.equal(
    projectHealth(
      { healthOverride: "on_track", dueDate: "2020-01-01" },
      [{ status: "blocked" }],
      [],
      october,
    ),
    "on_track",
  );
  assert.equal(
    projectAttentionReason(
      { status: "active" },
      [{ status: "todo", dueDate: "2026-10-01" }],
      [],
      october,
    ),
    "1 overdue item",
  );
});

test("project counts separate items, subtasks, open, and done and drop deleted rows", () => {
  const counts = projectWorkCounts(
    [
      { status: "todo", workItemType: "task" },
      { status: "done", workItemType: "pbi" },
      { status: "todo", workItemType: "subtask" },
      { status: "deleted", workItemType: "task" },
      { status: "blocked", workItemType: "task", dueDate: "2026-10-01" },
    ],
    october,
  );
  assert.equal(counts.items, 3);
  assert.equal(counts.subtasks, 1);
  assert.equal(counts.openItems, 2);
  assert.equal(counts.doneItems, 1);
  assert.equal(counts.openSubtasks, 1);
  assert.equal(counts.overdueItems, 1);
  assert.equal(counts.blockedItems, 1);
});

test("upcoming checkpoints include open items with a future due date", () => {
  const rows = upcomingWorkCheckpoints(
    [{ id: "p1", title: "Launch", status: "active", dueDate: "2026-10-20" }],
    [
      { id: "soon", title: "Send brief", status: "todo", projectId: "p1", dueDate: "2026-10-14" },
      { id: "done", title: "Old", status: "done", dueDate: "2026-10-15" },
      { id: "past", title: "Late", status: "todo", dueDate: "2026-10-01" },
    ],
    8,
    october,
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["soon", "p1"],
  );
});

test("date-only values stay on that calendar day in a UTC-6 reading", () => {
  assert.equal(toDateKey("2026-10-13"), "2026-10-13");
  assert.equal(itemDueKey({ dueDate: "2026-10-13" }), "2026-10-13");
  const utcMidnight = new Date("2026-10-13T00:00:00.000Z");
  const wall = new Date(utcMidnight.getTime() - 6 * 60 * 60 * 1000);
  const shifted = [
    wall.getUTCFullYear(),
    String(wall.getUTCMonth() + 1).padStart(2, "0"),
    String(wall.getUTCDate()).padStart(2, "0"),
  ].join("-");
  assert.equal(shifted, "2026-10-12");
  assert.notEqual(toDateKey("2026-10-13"), shifted);
});

test("status filters use the eight statuses and the completed toggle", () => {
  assert.equal(WORK_STATUS_KEYS.length, 8);
  assert.equal(passesStatusView({ status: "done" }, "open", false), false);
  assert.equal(passesStatusView({ status: "done" }, "open", true), true);
  assert.equal(passesStatusView({ status: "done" }, "done", false), true);
  assert.equal(passesStatusView({ status: "todo" }, "open", false), true);
  assert.equal(passesStatusView({ status: "archived" }, "all", true), true);
  assert.equal(passesStatusView({ status: "deleted" }, "done", true), false);
  assert.deepEqual(
    visibleBoardColumns(false).map((column) => column.key),
    ["backlog", "ready", "todo", "in_progress", "in_review", "blocked"],
  );
  assert.equal(visibleBoardColumns(true).length, 8);
  assert.equal(kanbanColumnForStatus("ready"), "ready");
  assert.equal(statusForKanbanColumn("blocked"), "blocked");
});

test("a column drop rewrites order for the destination and keeps keys unique", () => {
  const orders = columnOrderAfterDrop(
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    "b",
    0,
  );
  assert.deepEqual(
    orders.map((row) => row.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(orders.map((row) => row.order), [0, 1, 2]);
  const first = uniqueWorkItemKey(["01-001-121026"], { now: october, random: () => 0.1 });
  const second = uniqueWorkItemKey(["01-001-121026", first], { now: october, random: () => 0.1 });
  assert.notEqual(first, second);
  const sharedPrefix = workItemChipLabel({ id: "aaaa-bbbb-cccc-dddd" });
  assert.equal(sharedPrefix, "ccc-dddd");
  assert.notEqual(sharedPrefix, "BOLD");
  assert.notEqual(
    workItemChipLabel({ id: "prefix-shared-1111" }),
    workItemChipLabel({ id: "prefix-shared-2222" }),
  );
  assert.equal(workItemChipLabel({ key: "12-00A-121026" }), "12-00A-121026");
});

test("end date cannot be earlier than the start date", () => {
  assert.equal(dateRangeError("2026-10-12", "2026-10-11"), "End date must be on or after the start date.");
  assert.equal(dateRangeError("2026-10-12", "2026-10-12"), "");
  assert.equal(dateRangeError("", "2026-10-01"), "");
});
