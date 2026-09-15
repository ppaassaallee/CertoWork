import test from "node:test";
import assert from "node:assert/strict";
import { computeFocusScore } from "../src/lib/dayplan/focusScore";
import type { DayPlan } from "../src/lib/dayplan/types";

function plan(partial: Partial<DayPlan>): DayPlan {
  return {
    id: "u_2026-09-14", userId: "u", workspaceId: "w", date: "2026-09-14",
    keyItemId: null, plannedItemIds: [], clearedItemIds: [], energy: {},
    feel: null, carryForward: null, closedAt: null,
    createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z",
    ...partial,
  };
}

test("no plan → 0", () => {
  assert.equal(computeFocusScore({ plan: null, itemStatusById: {} }).value, 0);
});

test("key task set → 10", () => {
  const s = computeFocusScore({ plan: plan({ keyItemId: "a" }), itemStatusById: { a: "open" } });
  assert.equal(s.value, 10);
  assert.equal(s.keySet, true);
});

test("key task done, nothing else planned → 100", () => {
  const s = computeFocusScore({ plan: plan({ keyItemId: "a" }), itemStatusById: { a: "done" } });
  assert.equal(s.value, 100);
});

test("adding planned items lowers nothing but never raises", () => {
  const p = plan({ keyItemId: "a", plannedItemIds: ["b", "c"] });
  const s = computeFocusScore({ plan: p, itemStatusById: { a: "open", b: "open", c: "open" } });
  assert.equal(s.value, 10);
  assert.equal(s.remaining, 2);
});

test("clearing (moving) an item counts like done for the 30 points", () => {
  const p = plan({ keyItemId: "a", plannedItemIds: ["b", "c"], clearedItemIds: ["c"] });
  const s = computeFocusScore({ plan: p, itemStatusById: { a: "done", b: "done", c: "open" } });
  assert.equal(s.value, 100);
});
