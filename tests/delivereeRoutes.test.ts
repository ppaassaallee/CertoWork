import assert from "node:assert/strict";
import test from "node:test";

import {
  actionLabel,
  normalizeDeliveryStage,
  projectHealth,
  resolveDelivereeLens,
} from "../src/lib/delivereeRoutes";

test("legacy and new routes resolve into one conversational lens", () => {
  assert.deepEqual(resolveDelivereeLens("/boldi"), { kind: "home" });
  assert.deepEqual(resolveDelivereeLens("/work/delivery-os/portfolio"), {
    kind: "work",
    section: "portfolio",
  });
  assert.deepEqual(resolveDelivereeLens("/work/action-board"), {
    kind: "work",
    section: "issues",
  });
  assert.deepEqual(resolveDelivereeLens("/capture/review"), { kind: "review" });
  assert.deepEqual(resolveDelivereeLens("/work/projects/project-123"), {
    kind: "project",
    projectId: "project-123",
  });
});

test("delivery stage normalization keeps the portfolio coherent", () => {
  assert.equal(normalizeDeliveryStage("in progress"), "delivery");
  assert.equal(normalizeDeliveryStage("completed"), "support");
  assert.equal(normalizeDeliveryStage(undefined), "assessment");
});

test("project health and issue language support a Jira-like workflow", () => {
  assert.equal(projectHealth({ health: "blocked" }), "blocked");
  assert.equal(projectHealth({}, 15), "at_risk");
  assert.equal(projectHealth({}, 2), "on_track");
  assert.equal(actionLabel("create_task"), "Create issue");
});
