import assert from "node:assert/strict";
import test from "node:test";
import {
  projectHealth,
  sidebarProjectGroups,
  sortProjectsByRecency,
  taskWorkLane,
} from "../src/lib/projectPortfolio";

test("puts favorite projects first and keeps the three latest non-favorites", () => {
    const projects = [
      { id: "old", title: "Old", updatedAt: 1 },
      { id: "favorite", title: "Favorite", favorite: true, updatedAt: 2 },
      { id: "recent-1", title: "Recent 1", updatedAt: 5 },
      { id: "recent-2", title: "Recent 2", updatedAt: 4 },
      { id: "recent-3", title: "Recent 3", updatedAt: 3 },
    ];
    const groups = sidebarProjectGroups(projects);
  assert.deepEqual(groups.favorites.map((project) => project.id), ["favorite"]);
  assert.deepEqual(groups.recent.map((project) => project.id), ["recent-1", "recent-2", "recent-3"]);
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
  assert.equal(projectHealth({}, [], [{ status: "open", severity: "critical" }]), "blocked");
  assert.equal(projectHealth({ status: "active", dueDate: "2020-01-01" }, [], []), "at_risk");
  assert.equal(projectHealth({ healthOverride: "on_track", dueDate: "2020-01-01" }, [{ status: "blocked" }], []), "on_track");
  assert.equal(projectHealth({ importedFrom: "pipeline", health: "on_track" }, [{ status: "blocked" }], []), "blocked");
  assert.equal(taskWorkLane({ status: "in_progress" }), "in_progress");
  assert.equal(taskWorkLane({ status: "open" }), "backlog");
});
