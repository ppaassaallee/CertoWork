import assert from "node:assert/strict";
import test from "node:test";
import { executeOdiseusTool } from "../worker/odiseus-tools.js";

const context = {
  projects: [
    { id: "p1", title: "Phoenix", status: "active", dueDate: "2020-01-01" },
    { id: "p2", title: "Atlas", status: "active", health: "on_track" },
  ],
  tasks: [
    { id: "t1", title: "Fix checkout", projectId: "p1", status: "open", dueDate: "2020-01-02" },
    { id: "t2", title: "Write docs", projectId: "p2", status: "open", dueDate: "2099-01-01" },
    { id: "t3", title: "Blocked deploy", projectId: "p1", status: "blocked" },
  ],
  risks: [{ id: "r1", projectId: "p1", title: "Latency", severity: "critical", status: "open" }],
};

test("Odiseus search_projects returns accessible projects with health", () => {
  const result = executeOdiseusTool("search_projects", { query: "pho" }, context);
  assert.equal(result.result.count, 1);
  assert.equal(result.result.projects[0].id, "p1");
  assert.equal(result.result.projects[0].health, "blocked");
});

test("Odiseus get_overdue_items finds only past-due open work", () => {
  const result = executeOdiseusTool("get_overdue_items", {}, context);
  assert.equal(result.result.count, 1);
  assert.equal(result.result.items[0].id, "t1");
});

test("Odiseus propose_followups returns approval-bound create_task actions", () => {
  const result = executeOdiseusTool("propose_followups", { maxActions: 5 }, context);
  assert.ok(result.result.count >= 1);
  assert.equal(result.proposedActions[0].type, "create_task");
  assert.equal(result.proposedActions[0].safetyLevel, 2);
});

test("Odiseus get_activity_summary aggregates portfolio attention", () => {
  const result = executeOdiseusTool("get_activity_summary", {}, context);
  assert.equal(result.result.projects, 2);
  assert.ok(result.result.blocked >= 1);
  assert.ok(result.result.overdueItems >= 1);
});

test("Odiseus prepare_status_report returns a markdown artifact", () => {
  const result = executeOdiseusTool("prepare_status_report", { projectId: "p1" }, context);
  assert.equal(result.artifact.kind, "markdown_report");
  assert.match(result.artifact.title, /Phoenix/);
  assert.equal(result.proposedActions[0].type, "create_project_artifact");
});

test("Odiseus tools refuse unknown project ids outside scope", () => {
  const result = executeOdiseusTool("get_project", { projectId: "missing" }, context);
  assert.match(result.result.error, /not found/i);
});
