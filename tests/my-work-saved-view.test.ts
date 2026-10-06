import assert from "node:assert/strict";
import test from "node:test";
import { itemGroupForView, rowActionsForView } from "../src/lib/myWorkSavedView";

test("saved My Work columns control the visible attribute actions", () => {
  const actions = rowActionsForView(
    [{ id: "title" }, { id: "project" }, { id: "priority" }, { id: "assignee" }],
    ["collab", "parent", "status", "due"],
  );
  assert.deepEqual(actions, ["collab", "parent", "project", "priority", "assignees"]);
  assert.deepEqual(rowActionsForView([{ id: "title" }], ["collab"]), ["collab"]);
});

test("saved grouping maps to the list's real section keys", () => {
  assert.equal(itemGroupForView("project"), "project");
  assert.equal(itemGroupForView("assignee"), "owner");
  assert.equal(itemGroupForView("category"), "work_category");
  assert.equal(itemGroupForView("due"), "due");
  assert.equal(itemGroupForView(null), "hierarchy");
});
