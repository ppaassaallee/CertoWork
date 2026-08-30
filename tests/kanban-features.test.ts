import assert from "node:assert/strict";
import test from "node:test";

import {
  applyKanbanAutomations,
  appendStatusHistory,
  asKanbanSwimlane,
  calendarWeekDays,
  canAcceptWipDrop,
  checklistCaption,
  checklistProgress,
  cumulativeFlowSeries,
  cycleTimeMs,
  encodeKanbanDroppable,
  estimateLabel,
  extractUrls,
  formatDuration,
  isWipOver,
  leadTimeMs,
  itemMentionsViewer,
  mentionNames,
  mentionSegments,
  parseKanbanDroppable,
  stackedAreaLayers,
  subtaskProgress,
  swimlaneKeyFor,
  swimlaneMovePatch,
  uniqueSwimlanes,
  wipCaption,
  wipTone,
} from "../src/lib/kanbanFeatures";

test("WIP limits flag a column at capacity and reject extra drops", () => {
  assert.equal(isWipOver(4, 0), false);
  assert.equal(isWipOver(3, 3), false);
  assert.equal(isWipOver(4, 3), true);
  assert.equal(canAcceptWipDrop("backlog", "doing", 3, 3), false);
  assert.equal(canAcceptWipDrop("doing", "doing", 3, 3), true);
  assert.equal(canAcceptWipDrop("backlog", "doing", 2, 3), true);
  assert.equal(wipTone(3, 3), "limit");
  assert.equal(wipTone(4, 3), "over");
  assert.equal(wipCaption(4, 3), "4/3");
  assert.equal(wipCaption(2, 0), "2");
});

test("swimlanes group cards by assignee, priority, or project", () => {
  const items = [
    { id: "a", assignees: ["Ana"], priority: "1", projectId: "ops" },
    { id: "b", owner: "Bo", priority: "2", projectId: null },
    { id: "c", priority: null },
  ];
  const projects = [{ id: "ops", title: "FieldOps" }];
  assert.equal(swimlaneKeyFor(items[0], "assignee"), "Ana");
  assert.equal(swimlaneKeyFor(items[1], "assignee"), "Bo");
  assert.equal(swimlaneKeyFor(items[2], "assignee"), "Unassigned");
  assert.equal(swimlaneKeyFor(items[0], "priority"), "1");
  assert.equal(swimlaneKeyFor(items[0], "project", projects), "FieldOps");
  assert.deepEqual(
    uniqueSwimlanes(items, "priority").map((lane) => lane.key),
    ["1", "2", "none"],
  );
  assert.deepEqual(swimlaneMovePatch("priority", "1"), { priority: "1" });
  assert.deepEqual(swimlaneMovePatch("assignee", "Ana"), {
    assignee: "Ana",
    owner: "Ana",
    assignees: ["Ana"],
  });
});

test("droppable ids keep the column key when swimlanes are on", () => {
  const encoded = encodeKanbanDroppable("doing", "Ana López");
  assert.match(encoded, /^doing::/);
  assert.deepEqual(parseKanbanDroppable(encoded), { columnKey: "doing", swimlaneKey: "Ana López" });
  assert.deepEqual(parseKanbanDroppable("blocked"), { columnKey: "blocked", swimlaneKey: "" });
});

test("checklist and subtask progress stay on the parent card", () => {
  assert.deepEqual(
    checklistProgress([
      { id: "1", text: "Write", done: true },
      { id: "2", text: "Review", done: false },
    ]),
    { done: 1, total: 2, percent: 50 },
  );
  assert.equal(
    checklistCaption([
      { id: "1", text: "Write", done: true },
      { id: "2", text: "Review", done: false },
    ]),
    "1/2 completed",
  );
  assert.deepEqual(
    subtaskProgress({ id: "epic-1" }, [
      { id: "c1", parentId: "epic-1", status: "done" },
      { id: "c2", parentId: "epic-1", status: "in_progress" },
      { id: "other", parentId: "x", status: "done" },
    ]),
    { done: 1, total: 2, percent: 50 },
  );
  assert.equal(estimateLabel({ storyPoints: 5, estimateHours: 2 }), "5 pts · 2h");
});

test("column automations assign and retag when a card enters a lane", () => {
  const patch = applyKanbanAutomations(
    { assignees: ["Ana"] },
    "doing",
    [{ id: "r1", whenColumn: "doing", setPriority: "1", setAssignee: "Bo" }],
  );
  assert.equal(patch.priority, "1");
  assert.equal(patch.assignee, "Bo");
  assert.deepEqual(patch.assignees, ["Bo", "Ana"]);
});

test("cycle and lead time use start and completion stamps", () => {
  const item = {
    createdAt: "2026-08-01T08:00:00.000Z",
    startDate: "2026-08-02T08:00:00.000Z",
    completedAt: "2026-08-04T08:00:00.000Z",
    statusHistory: [{ status: "in_progress", column: "doing", at: "2026-08-02T08:00:00.000Z" }],
  };
  assert.equal(cycleTimeMs(item), 2 * 24 * 3_600_000);
  assert.equal(leadTimeMs(item), 3 * 24 * 3_600_000);
  assert.equal(formatDuration(2 * 24 * 3_600_000), "2.0d");
});

test("cumulative flow counts cards that existed on each day", () => {
  const series = cumulativeFlowSeries(
    [
      { id: "a", status: "backlog", createdAt: "2026-08-20T00:00:00.000Z" },
      { id: "b", status: "done", createdAt: "2026-08-21T00:00:00.000Z", completedAt: "2026-08-22T00:00:00.000Z" },
    ],
    3,
    new Date("2026-08-22T12:00:00.000Z"),
  );
  assert.equal(series.length, 3);
  assert.equal(series[0].date, "2026-08-20");
  assert.ok(series[0].backlog >= 1);
  assert.ok(series[2].done >= 1);
});

test("calendar weeks start Monday and comments extract mentions and links", () => {
  const days = calendarWeekDays(new Date("2026-08-26T12:00:00"));
  assert.equal(days.length, 7);
  assert.equal(days[0].key, "2026-08-24");
  assert.deepEqual(mentionNames("Ping @Ana and @Bo."), ["Ana", "Bo"]);
  assert.deepEqual(
    mentionSegments("Ping @Ana now."),
    [
      { text: "Ping ", mention: false },
      { text: "@Ana", mention: true },
      { text: " now.", mention: false },
    ],
  );
  assert.equal(
    itemMentionsViewer({ mentionedNames: ["Ana"], comments: [{ text: "hi" }] }, ["Ana"]),
    true,
  );
  assert.equal(itemMentionsViewer({ comments: [{ text: "Ping @Bo" }] }, ["Ana"]), false);
  assert.deepEqual(extractUrls("See https://certo.work/docs and more"), ["https://certo.work/docs"]);
  assert.equal(asKanbanSwimlane("assignee"), "assignee");
  assert.equal(asKanbanSwimlane("nope"), "none");
});

test("status history appends a column change without duplicating the last event", () => {
  const first = appendStatusHistory({}, "in_progress", "doing", "2026-08-22T00:00:00.000Z");
  const again = appendStatusHistory({ statusHistory: first }, "in_progress", "doing", "2026-08-22T01:00:00.000Z");
  const moved = appendStatusHistory({ statusHistory: again }, "done", "done", "2026-08-23T00:00:00.000Z");
  assert.equal(first.length, 1);
  assert.equal(again.length, 1);
  assert.equal(moved.length, 2);
  assert.equal(moved[1].column, "done");
});

test("stacked area layers keep done under in-progress", () => {
  const layers = stackedAreaLayers([
    { date: "2026-08-20", backlog: 2, doing: 1, blocked: 0, done: 1 },
    { date: "2026-08-21", backlog: 1, doing: 2, blocked: 0, done: 2 },
  ]);
  assert.match(layers.done, /,/);
  assert.match(layers.backlog, /,/);
});
