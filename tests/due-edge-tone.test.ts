import assert from "node:assert/strict";
import test from "node:test";
import { daysPastDue, dueEdgeClassName, dueEdgeTone } from "../src/lib/dueEdgeTone";

const NOW = new Date("2026-09-19T12:00:00");

test("daysPastDue is null without a due date", () => {
  assert.equal(daysPastDue({ status: "open" }, NOW), null);
});

test("dueEdgeTone maps overdue weeks to neon bands", () => {
  assert.equal(dueEdgeTone({ status: "open", dueDate: "2026-09-19" }, NOW), "ontrack");
  assert.equal(dueEdgeTone({ status: "open", dueDate: "2026-09-25" }, NOW), "ontrack");
  assert.equal(dueEdgeTone({ status: "open", dueDate: "2026-09-15" }, NOW), "week1");
  assert.equal(dueEdgeTone({ status: "open", dueDate: "2026-09-05" }, NOW), "week2to3");
  assert.equal(dueEdgeTone({ status: "open", dueDate: "2026-08-20" }, NOW), "week4plus");
});

test("dueEdgeTone skips closed items and undated rows", () => {
  assert.equal(dueEdgeTone({ status: "done", dueDate: "2026-08-01" }, NOW), null);
  assert.equal(dueEdgeTone({ status: "open" }, NOW), null);
  assert.equal(dueEdgeClassName({ status: "open", dueDate: "2026-09-01" }, NOW), "is-due-edge is-due-edge-week2to3");
});
