import assert from "node:assert/strict";
import test from "node:test";
import {
  dateInputValue,
  dueDateTimingPatch,
  timingMarksForItem,
  todayTimingPatch,
  weekTimingPatch,
} from "../src/lib/itemTiming";

test("Today mark follows due date, not a stale timeSector pin", () => {
  const now = new Date(2026, 8, 9, 16, 8, 0); // Sep 9, 2026 local
  const marks = timingMarksForItem(
    {
      dueDate: "2026-09-30",
      timeSector: "today",
      timeSectorDate: "2026-09-09",
      timeSectorExpiresAt: "2026-09-09T23:59:59",
    },
    now,
  );
  assert.equal(marks.markedToday, false);
  assert.equal(marks.due, "2026-09-30");
});

test("Today mark is active only when due is today", () => {
  const now = new Date(2026, 8, 9, 10, 0, 0);
  assert.equal(
    timingMarksForItem({ dueDate: "2026-09-09", timeSector: "this_week" }, now).markedToday,
    true,
  );
  assert.equal(
    timingMarksForItem(
      {
        timeSector: "today",
        timeSectorDate: "2026-09-09",
        timeSectorExpiresAt: "2026-09-09T23:59:59",
      },
      now,
    ).markedToday,
    true,
  );
});

test("changing due date clears stale Today sector", () => {
  const now = new Date(2026, 8, 9, 16, 0, 0);
  const patch = dueDateTimingPatch("2026-09-30", now);
  assert.equal(patch.dueDate, "2026-09-30");
  assert.notEqual(patch.timeSector, "today");
  assert.equal(todayTimingPatch(now).dueDate, "2026-09-09");
  assert.equal(weekTimingPatch(now).timeSector, "this_week");
});

test("dateInputValue keeps local calendar days for timestamps", () => {
  const local = new Date(2026, 8, 30, 0, 30, 0);
  assert.equal(dateInputValue(local), "2026-09-30");
  assert.equal(dateInputValue("2026-09-30T15:00:00.000Z"), "2026-09-30");
});
