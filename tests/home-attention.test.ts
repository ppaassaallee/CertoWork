import assert from "node:assert/strict";
import test from "node:test";
import { groupProjectsByHealth } from "../src/lib/workspaceDisplay";

test("home attention groups blocked and at-risk projects ahead of healthy ones", () => {
  const projects = [
    { id: "a", title: "Healthy", status: "active" },
    { id: "b", title: "Late", status: "active", dueDate: "2020-01-01" },
    { id: "c", title: "Stuck", status: "active", healthOverride: "blocked" },
  ];
  const grouped = groupProjectsByHealth(projects, [], []);
  assert.equal(grouped.blocked.map((item) => item.id).join(), "c");
  assert.equal(grouped.at_risk.map((item) => item.id).join(), "b");
  assert.equal(grouped.on_track.map((item) => item.id).join(), "a");
});
