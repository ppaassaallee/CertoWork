import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeFocusScore } from "../src/features/dailyPlan/focusScore";
import type { DayPlan, DayPlanEntry } from "../src/features/dailyPlan/types";

function entry(partial: Partial<DayPlanEntry> & Pick<DayPlanEntry, "itemId" | "bucket">): DayPlanEntry {
  return {
    order: 0,
    doneToday: false,
    addedAt: {} as any,
    ...partial,
  };
}

function plan(entries: DayPlanEntry[]): DayPlan {
  return {
    id: "u_d",
    uid: "u",
    date: "2026-09-20",
    entries,
    createdAt: {} as any,
    updatedAt: {} as any,
  };
}

describe("computeFocusScore", () => {
  it("returns null with no entries", () => {
    assert.equal(computeFocusScore(plan([])), null);
  });

  it("weights growth 3 and fire 2 → 60 when only growth done", () => {
    const s = computeFocusScore(
      plan([
        entry({ itemId: "g", bucket: "growth", doneToday: true }),
        entry({ itemId: "f", bucket: "fire", doneToday: false }),
      ]),
    );
    assert.equal(s, 60);
  });

  it("adds 10 when key item is done", () => {
    const s = computeFocusScore(
      plan([
        entry({ itemId: "g", bucket: "growth", doneToday: true }),
        entry({ itemId: "f", bucket: "fire", doneToday: false }),
      ]),
      "g",
    );
    assert.equal(s, 70);
  });
});
