import assert from "node:assert/strict";
import test from "node:test";
import { buildTimelineEntries, timelineDay, timelineGeometry, timelineMonths, timelinePosition, timelineRange, timelineSections, type TimelineItem } from "../src/lib/projectTimeline";

const item = (id: string, patch: Partial<TimelineItem> = {}): TimelineItem => ({
  id, title: id, kind: "pbi", parentId: "", projectId: "project", projectLabel: "Project", status: "backlog", ...patch,
});

test("Timeline plots due-only and start-only items on one real calendar day", () => {
  const rows = buildTimelineEntries([
    item("due", { dueDate: "2026-10-14" }),
    item("start", { startDate: "2026-10-13" }),
    item("range", { startDate: "2026-10-13", dueDate: "2026-10-15" }),
    item("none"),
  ]);
  assert.equal(rows[0].start, rows[0].end);
  assert.equal(rows[1].start, rows[1].end);
  assert.equal(rows[1].startOnly, true);
  assert.equal(rows[3].start, null);
  assert.deepEqual(timelinePosition(rows[2], timelineDay("2026-10-12")!, 24), { left: 24, width: 72 });
});

test("Timeline indentation follows real parent links and keeps standalone types at depth zero", () => {
  const rows = buildTimelineEntries([
    item("task", { kind: "task", parentId: "feature", dueDate: "2026-10-16" }),
    item("feature", { kind: "feature", parentId: "epic" }),
    item("epic", { kind: "epic" }),
    item("standalone-pbi"),
    item("standalone-feature", { kind: "feature" }),
    item("missing", { parentId: "not-loaded" }),
    item("different-project", { parentId: "epic", projectId: "other" }),
  ]);
  assert.deepEqual(rows.map((row) => [row.id, row.depth]), [
    ["epic", 0], ["feature", 1], ["task", 2], ["standalone-pbi", 0], ["standalone-feature", 0], ["missing", 0], ["different-project", 0],
  ]);
  assert.equal(rows[0].rollup, true);
  assert.equal(rows[0].start, timelineDay("2026-10-16"));
  assert.equal(rows[1].end, rows[2].end);
  const sections = timelineSections(rows, "hierarchy", "Standalone");
  assert.deepEqual(sections.map((group) => [group.id, group.entries.length]), [["epic", 3], ["standalone", 4]]);
});

test("Timeline tolerates cycles, invalid dates and reversed date ranges without losing records", () => {
  const rows = buildTimelineEntries([
    item("a", { parentId: "b" }), item("b", { parentId: "a" }),
    item("self", { parentId: "self" }),
    item("invalid", { dueDate: "2026-02-30" }),
    item("reverse", { startDate: "2026-10-20", dueDate: "2026-10-10" }),
  ]);
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map((row) => row.id)).size, 5);
  assert.equal(timelineDay("2026-02-30"), null);
  assert.equal(rows.find((row) => row.id === "invalid")?.start, null);
  assert.equal(rows.find((row) => row.id === "reverse")?.start, timelineDay("2026-10-10"));
});

test("An undated epic summarizes all descendants even if a feature has a shorter explicit range", () => {
  const rows = buildTimelineEntries([
    item("epic", { kind: "epic" }),
    item("feature", { kind: "feature", parentId: "epic", startDate: "2026-10-10", dueDate: "2026-10-12" }),
    item("task", { parentId: "feature", dueDate: "2026-10-20" }),
  ]);
  assert.equal(rows[0].end, timelineDay("2026-10-20"));
  assert.equal(rows[1].end, timelineDay("2026-10-12"));
  assert.equal(rows[1].rollup, false);
});

test("Timeline uses project ids for groups, even when projects share the same title", () => {
  const entries = buildTimelineEntries([item("a", { projectId: "p1" }), item("b", { projectId: "p2" }), item("c", { projectId: "" })]);
  const sections = timelineSections(entries, "project", "Standalone", ["__no_project__", "p2", "p1"]);
  assert.deepEqual(sections.map((group) => group.id), ["__no_project__", "p2", "p1"]);
});

test("Timeline aligns weeks to Monday and splits month headers at actual month boundaries", () => {
  const range = timelineRange(buildTimelineEntries([item("a", { startDate: "2026-10-29", dueDate: "2026-11-10" })]), timelineDay("2026-10-13")!);
  assert.equal(new Date(range.start * 86_400_000).getUTCDay(), 1);
  assert.ok(range.end >= timelineDay("2026-11-10")!);
  const months = timelineMonths(timelineDay("2026-10-26")!, timelineDay("2026-11-08")!);
  assert.deepEqual(months.map((month) => month.days), [6, 8]);
  assert.equal(months.reduce((sum, month) => sum + month.days, 0), 14);
  assert.equal(timelineDay("2026-03-08")! - timelineDay("2026-03-07")!, 1);
});

test("Extreme stored dates do not generate thousands of month headers", () => {
  const periods = timelineMonths(timelineDay("1000-01-01")!, timelineDay("9999-12-31")!);
  assert.ok(periods.length < 100);
  assert.equal(periods[0].unit, "years");
  const days = timelineDay("9999-12-31")! - timelineDay("1000-01-01")!;
  for (const scale of ["day", "week", "month", "quarter"] as const) {
    const geometry = timelineGeometry(days, 1024, scale, false);
    assert.ok(geometry.dayWidth * days <= 24_000);
    assert.ok(Math.ceil(days / geometry.tickStep) < 1000);
    const fit = timelineGeometry(days, 1024, scale, true);
    assert.ok(Math.abs(fit.dayWidth * days - 1024) < 1);
  }
});
