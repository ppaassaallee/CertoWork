import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATE_QUICK_ACTIONS,
  ROW_QUICK_ACTIONS,
  addQuickAction,
  hiddenQuickActions,
  moveQuickAction,
  normalizeQuickActions,
  readQuickActions,
  removeQuickAction,
} from "../src/lib/quickActions.ts";

test("quick actions default to the full icon set and ignore unknown keys", () => {
  assert.deepEqual(normalizeQuickActions(null, ROW_QUICK_ACTIONS, ROW_QUICK_ACTIONS), [...ROW_QUICK_ACTIONS]);
  assert.deepEqual(
    normalizeQuickActions(["nope", "due", "due", "project"], ROW_QUICK_ACTIONS, ROW_QUICK_ACTIONS),
    ["due", "project"],
  );
  assert.equal(ROW_QUICK_ACTIONS.includes("assignees"), true);
  assert.equal(CREATE_QUICK_ACTIONS.includes("project"), true);
});

test("right-click actions remove, add after the current icon, and move", () => {
  const start = ["project", "type", "due"] as const;
  assert.deepEqual(removeQuickAction(start, "type"), ["project", "due"]);
  assert.deepEqual(addQuickAction(["project", "due"], "type", CREATE_QUICK_ACTIONS, "project"), ["project", "type", "due"]);
  assert.deepEqual(addQuickAction(["project"], "delivery", CREATE_QUICK_ACTIONS), ["project", "delivery"]);
  assert.deepEqual(hiddenQuickActions(["project"], CREATE_QUICK_ACTIONS).includes("type"), true);
  assert.deepEqual(moveQuickAction(["project", "type", "due"], "due", -1), ["project", "due", "type"]);
  assert.deepEqual(moveQuickAction(["project", "type"], "project", -1), ["project", "type"]);
});

test("stored quick actions restore a custom order", () => {
  const storage = {
    value: "",
    getItem() {
      return this.value;
    },
    setItem(_key: string, value: string) {
      this.value = value;
    },
  };
  storage.setItem("k", JSON.stringify(["due", "project"]));
  assert.deepEqual(readQuickActions(storage, "k", CREATE_QUICK_ACTIONS), ["due", "project"]);
  assert.deepEqual(readQuickActions({ getItem: () => null }, "k", CREATE_QUICK_ACTIONS), [...CREATE_QUICK_ACTIONS]);
});
