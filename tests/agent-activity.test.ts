import assert from "node:assert/strict";
import test from "node:test";
import {
  activityResultTone,
  countAgentRunsToday,
  formatAgentActivityLine,
  formatRelativeTime,
} from "../src/lib/agentActivity.ts";
import { ODISEUS_NAME } from "../src/lib/odiseus.ts";

test("formatAgentActivityLine uses verb, actor, and actionCount", () => {
  assert.equal(
    formatAgentActivityLine(
      {
        action: "actions_rejected",
        result: "rejected",
        agentId: "odysseus",
        actionCount: 2,
        userId: "u1",
        summary: "Rejected Odiseus proposed actions",
      },
      { viewerUserId: "u1" },
    ),
    `You rejected 2 actions proposed by ${ODISEUS_NAME}`,
  );
});

test("formatAgentActivityLine rewrites Odiseus in plain summaries", () => {
  assert.match(
    formatAgentActivityLine({ summary: "Rejected Odiseus proposed actions" }),
    new RegExp(ODISEUS_NAME),
  );
  assert.doesNotMatch(
    formatAgentActivityLine({ summary: "Rejected Odiseus proposed actions" }),
    /Odiseus/,
  );
});

test("activityResultTone maps governance outcomes", () => {
  assert.equal(activityResultTone("rejected"), "red");
  assert.equal(activityResultTone("completed"), "green");
  assert.equal(activityResultTone("proposed"), "amber");
});

test("countAgentRunsToday counts completed Odysseus runs", () => {
  const now = new Date(2026, 7, 23, 18, 0, 0).getTime();
  const count = countAgentRunsToday(
    [
      {
        agentId: "odysseus",
        action: "job_completed",
        result: "completed",
        createdAt: new Date(2026, 7, 23, 12, 0, 0).getTime(),
      },
      {
        agentId: "odysseus",
        action: "actions_rejected",
        result: "rejected",
        createdAt: new Date(2026, 7, 23, 13, 0, 0).getTime(),
      },
      {
        agentId: "odysseus",
        action: "job_completed",
        result: "completed",
        createdAt: new Date(2026, 7, 22, 12, 0, 0).getTime(),
      },
    ],
    "odysseus",
    now,
  );
  assert.equal(count, 1);
});

test("formatRelativeTime is compact", () => {
  const now = new Date(2026, 7, 23, 12, 12, 0).getTime();
  assert.equal(
    formatRelativeTime(new Date(2026, 7, 23, 12, 0, 0).getTime(), now),
    "12 min ago",
  );
});
