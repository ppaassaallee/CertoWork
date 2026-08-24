import assert from "node:assert/strict";
import test from "node:test";
import { executeOdysseusTool } from "../worker/odiseus-tools.js";

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

test("Odysseus search_projects returns accessible projects with health", () => {
  const result = executeOdysseusTool("search_projects", { query: "pho" }, context);
  assert.equal(result.result.count, 1);
  assert.equal(result.result.projects[0].id, "p1");
  assert.equal(result.result.projects[0].health, "blocked");
});

test("Odysseus get_overdue_items finds only past-due open work", () => {
  const result = executeOdysseusTool("get_overdue_items", {}, context);
  assert.equal(result.result.count, 1);
  assert.equal(result.result.items[0].id, "t1");
});

test("Odysseus propose_followups returns approval-bound create_task actions", () => {
  const result = executeOdysseusTool("propose_followups", { maxActions: 5 }, context);
  assert.ok(result.result.count >= 1);
  assert.equal(result.proposedActions[0].type, "create_task");
  assert.equal(result.proposedActions[0].safetyLevel, 2);
});

test("Odysseus get_activity_summary aggregates portfolio attention", () => {
  const result = executeOdysseusTool("get_activity_summary", {}, context);
  assert.equal(result.result.projects, 2);
  assert.ok(result.result.blocked >= 1);
  assert.ok(result.result.overdueItems >= 1);
});

test("Odysseus prepare_status_report returns a markdown artifact", () => {
  const result = executeOdysseusTool("prepare_status_report", { projectId: "p1" }, context);
  assert.equal(result.artifact.kind, "markdown_report");
  assert.match(result.artifact.title, /Phoenix/);
  assert.equal(result.proposedActions[0].type, "create_project_artifact");
});

test("Odysseus tools refuse unknown project ids outside scope", () => {
  const result = executeOdysseusTool("get_project", { projectId: "missing" }, context);
  assert.match(result.result.error, /not found/i);
});

test("Odysseus recall_memory and remember_fact use personal memory", () => {
  const withMemory = {
    ...context,
    odiseusMemory: [
      { id: "m1", text: "Prefer Spanish for status updates", kind: "preference", tags: ["lang"] },
    ],
  };
  const recalled = executeOdysseusTool("recall_memory", { query: "spanish" }, withMemory);
  assert.equal(recalled.result.count, 1);
  const remembered = executeOdysseusTool(
    "remember_fact",
    { text: "Sprint reviews are Fridays", kind: "commitment" },
    withMemory,
  );
  assert.equal(remembered.proposedActions[0].type, "create_odiseus_memory");
});

test("Odysseus run_skill returns an artifact from workspace skills", () => {
  const withSkills = {
    ...context,
    skills: [
      {
        id: "s1",
        name: "Risk sweep",
        description: "Find open risks",
        instructions: "List critical risks and owners.",
      },
    ],
  };
  const result = executeOdysseusTool("run_skill", { skillName: "risk" }, withSkills);
  assert.equal(result.artifact.kind, "skill_run");
  assert.match(result.artifact.body, /critical risks/i);
});

test("Odysseus list_schedules returns configured jobs", () => {
  const withSchedules = {
    ...context,
    schedules: [{ id: "sch1", title: "Morning pulse", cron: "0 9 * * 1-5", enabled: true }],
  };
  const result = executeOdysseusTool("list_schedules", {}, withSchedules);
  assert.equal(result.result.count, 1);
  assert.equal(result.result.schedules[0].id, "sch1");
});
