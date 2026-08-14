import assert from "node:assert/strict";
import test from "node:test";

import {
  canAwardBoost,
  gemBalance,
  measureProgress,
  objectiveProgress,
} from "../src/lib/strategyExecution";

test("strategy progress is outcome-led and bounded", () => {
  const measures = [
    {
      strategicGoalId: "goal-1",
      measureKind: "outcome",
      startValue: 10,
      currentValue: 40,
      targetValue: 50,
    },
    {
      strategicGoalId: "goal-1",
      measureKind: "lead",
      startValue: 0,
      currentValue: 100,
      targetValue: 100,
    },
  ];
  assert.equal(measureProgress(measures[0]), 75);
  assert.equal(objectiveProgress("goal-1", measures), 75);
});

test("linked epics and projects can act as live lead measures", () => {
  assert.equal(
    objectiveProgress(
      "goal-2",
      [
        {
          strategicGoalId: "goal-2",
          measureKind: "lead",
          sourceType: "work_item",
          sourceId: "epic-1",
        },
      ],
      [],
      [{ id: "epic-1", status: "done" }],
    ),
    100,
  );
});

test("gems use an append-only balance and never hide redemptions", () => {
  const records = [
    { recordType: "gem_boost", walletEntityId: "project-1", amount: 25 },
    { recordType: "gem_boost", walletEntityId: "project-1", amount: 10 },
    { recordType: "gem_redemption", walletEntityId: "project-1", amount: -20 },
  ];
  assert.equal(gemBalance(records, "project-1"), 15);
});

test("only workspace leaders or named project leaders can award boosts", () => {
  assert.equal(canAwardBoost({ role: "admin" }, {}, {}), true);
  assert.equal(
    canAwardBoost(
      { role: "member", displayName: "Alex PM" },
      { projectManager: "Alex PM" },
      {},
    ),
    true,
  );
  assert.equal(canAwardBoost({ role: "viewer" }, {}, {}), false);
});
