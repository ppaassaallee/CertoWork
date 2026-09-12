import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCheckpointLabel,
  projectAttentionReason,
  projectHealth,
  projectNeedsAttention,
  sidebarProjectGroups,
  sortProjectsByRecency,
  taskWorkLane,
  todayIsoDate,
  upcomingProjectCheckpoints,
} from "../src/lib/projectPortfolio";

test("puts favorite projects first and keeps the six latest non-favorites", () => {
  const projects = [
    { id: "old", title: "Old", updatedAt: 1 },
    { id: "favorite", title: "Favorite", favorite: true, updatedAt: 2 },
    { id: "recent-1", title: "Recent 1", updatedAt: 5 },
    { id: "recent-2", title: "Recent 2", updatedAt: 4 },
    { id: "recent-3", title: "Recent 3", updatedAt: 3 },
  ];
  const groups = sidebarProjectGroups(projects);
  assert.deepEqual(groups.favorites.map((project) => project.id), ["favorite"]);
  assert.deepEqual(groups.recent.map((project) => project.id), [
    "recent-1",
    "recent-2",
    "recent-3",
    "old",
  ]);
});

test("does not hide a just-created project behind insertion order", () => {
  const sorted = sortProjectsByRecency([
    { id: "legacy", updatedAt: { seconds: 10 } },
    { id: "new", createdAt: { seconds: 100 } },
  ]);
  assert.equal(sorted[0].id, "new");
});

test("derives project health and Jira-like work lanes from real records", () => {
  assert.equal(projectHealth({}, [{ status: "blocked" }], []), "blocked");
  assert.equal(projectHealth({}, [], [{ status: "open" }]), "at_risk");
  assert.equal(
    projectHealth({}, [], [{ status: "open", severity: "critical" }]),
    "blocked",
  );
  assert.equal(
    projectHealth({ status: "active", dueDate: "2020-01-01" }, [], []),
    "at_risk",
  );
  assert.equal(
    projectHealth(
      { healthOverride: "on_track", dueDate: "2020-01-01" },
      [{ status: "blocked" }],
      [],
    ),
    "on_track",
  );
  assert.equal(
    projectHealth(
      { importedFrom: "pipeline", health: "on_track" },
      [{ status: "blocked" }],
      [],
    ),
    "blocked",
  );
  assert.equal(taskWorkLane({ status: "in_progress" }), "in_progress");
  assert.equal(taskWorkLane({ status: "open" }), "backlog");
});

test("upcoming checkpoints skip closed projects and past dates", () => {
  const now = new Date("2026-09-11T12:00:00");
  const rows = upcomingProjectCheckpoints(
    [
      {
        id: "deleted-x",
        title: "X AI Agent PTC AI Collections Agent Banrural Allied Global 2026",
        status: "deleted",
        dueDate: "2026-09-20",
      },
      {
        id: "past-ops",
        title: "Live ops with expired exit",
        status: "active",
        dueDate: "2026-05-31",
      },
      {
        id: "active-soon",
        title: "Active Banrural",
        status: "active",
        dueDate: "2026-09-20",
      },
      {
        id: "archived",
        title: "Archived",
        status: "archived",
        dueDate: "2026-09-15",
      },
      {
        id: "undated",
        title: "No date",
        status: "planning",
      },
      {
        id: "active-later",
        title: "Later",
        status: "planning",
        dueDate: "2026-10-01",
      },
    ],
    8,
    now,
  );
  assert.deepEqual(
    rows.map((project) => project.id),
    ["active-soon", "active-later"],
  );
});

test("need attention matches open health that is not on track", () => {
  assert.equal(
    projectNeedsAttention({ status: "active", dueDate: "2020-01-01" }, [], []),
    true,
  );
  assert.equal(
    projectNeedsAttention({ status: "completed", dueDate: "2020-01-01" }, [], []),
    false,
  );
  assert.equal(
    projectNeedsAttention({ status: "active" }, [], []),
    false,
  );
  assert.equal(
    projectAttentionReason(
      { status: "active" },
      [{ status: "blocked" }],
      [],
    ),
    "1 blocked item",
  );
});

test("checkpoint labels are human-readable and mark overdue", () => {
  const now = new Date("2026-09-11T12:00:00");
  assert.equal(todayIsoDate(now), "2026-09-11");
  const future = formatCheckpointLabel("2026-10-02", now);
  assert.match(future.text, /Oct 2/);
  assert.match(future.text, /in 21 days/);
  assert.equal(future.overdue, false);
  const past = formatCheckpointLabel("2026-09-08", now);
  assert.match(past.text, /3 days ago/);
  assert.equal(past.overdue, true);
});
