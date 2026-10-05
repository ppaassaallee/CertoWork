import assert from "node:assert/strict";
import test from "node:test";
import {
  NO_PROJECT_SECTION,
  compareManualOrder,
  orderSections,
  placeItemBefore,
  reorderIds,
  subtreeIds,
} from "../src/lib/myWorkSectionOrder";

test("No Project stays last until the user saves a section order", () => {
  const ordered = orderSections(
    [
      { id: NO_PROJECT_SECTION, label: "No Project" },
      { id: "b", label: "Beta" },
      { id: "a", label: "Alpha" },
    ],
    [],
  );
  assert.deepEqual(ordered.map((section) => section.label), ["Alpha", "Beta", "No Project"]);
});

test("a saved section order can put No Project above every project", () => {
  const ordered = orderSections(
    [
      { id: "a", label: "Alpha" },
      { id: NO_PROJECT_SECTION, label: "No Project" },
      { id: "b", label: "Beta" },
    ],
    [NO_PROJECT_SECTION, "b", "a"],
  );
  assert.deepEqual(ordered.map((section) => section.id), [NO_PROJECT_SECTION, "b", "a"]);
});

test("dragging a project section reorders the visible sections", () => {
  assert.deepEqual(reorderIds(["a", NO_PROJECT_SECTION, "b"], "b", "a"), ["b", "a", NO_PROJECT_SECTION]);
});

test("placing an item before another keeps the rest of the project", () => {
  assert.deepEqual(placeItemBefore(["p1", "p2", "p3"], "moved", "p2"), ["p1", "moved", "p2", "p3"]);
  assert.deepEqual(placeItemBefore(["p1", "moved", "p2"], "moved", null), ["p1", "p2", "moved"]);
});

test("manual order places a dragged row where it was dropped, ahead of item type", () => {
  const rows = [
    { title: "Epic", order: 2, kind: "epic" },
    { title: "Task", order: 0, kind: "task" },
    { title: "Later", order: 1, kind: "task" },
  ].sort(compareManualOrder);
  assert.deepEqual(rows.map((row) => row.title), ["Task", "Later", "Epic"]);
});

test("a moved item takes its children with it", () => {
  const children: Record<string, string[]> = { epic: ["feature"], feature: ["task"], task: [] };
  assert.deepEqual(subtreeIds("epic", (id) => children[id] || []), ["epic", "feature", "task"]);
});
