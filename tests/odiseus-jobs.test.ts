import assert from "node:assert/strict";
import test from "node:test";
import {
  actionIdempotencyKey,
  normalizeOdysseusRun,
} from "../src/lib/odiseusJobs";

test("normalizeOdysseusRun keeps human work steps", () => {
  const run = normalizeOdysseusRun({
    status: "completed",
    steps: [{ tool: "search_projects", label: "Reviewing projects", status: "done" }],
  });
  assert.equal(run?.status, "completed");
  assert.equal(run?.steps?.[0].label, "Reviewing projects");
  assert.equal(run?.toolCount, 1);
});

test("actionIdempotencyKey is stable for retries", () => {
  const action = {
    type: "create_task",
    proposedChange: { title: "Follow up: Fix checkout", projectId: "p1", sourceTaskId: "t1" },
  };
  assert.equal(
    actionIdempotencyKey("plan1", 0, action),
    actionIdempotencyKey("plan1", 0, action),
  );
  assert.notEqual(
    actionIdempotencyKey("plan1", 0, action),
    actionIdempotencyKey("plan1", 1, action),
  );
});
