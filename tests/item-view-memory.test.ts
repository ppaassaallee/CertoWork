import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultItemViewFilters,
  itemViewPrefsDocId,
  itemViewSurface,
  namedViewsStorageKey,
  lastSessionsStorageKey,
  normalizeItemViewFilters,
  resolveWorkItemsViewMode,
  shouldApplySessionMode,
  upsertNamedItemView,
} from "../src/lib/itemViewMemory";

test("item view surfaces are split between My Work and each project", () => {
  assert.equal(itemViewSurface(null), "my-work");
  assert.equal(itemViewSurface(undefined), "my-work");
  assert.equal(itemViewSurface("fieldops"), "project:fieldops");
});

test("named views and last sessions are keyed by user id", () => {
  assert.equal(namedViewsStorageKey("uid-1"), "certo-items-views:uid-1");
  assert.equal(lastSessionsStorageKey("uid-1"), "certo-items-last:uid-1");
  assert.equal(itemViewPrefsDocId("uid-1", "ws-9"), "uid-1_ws-9");
});

test("saving a named view replaces the same name and keeps sort", () => {
  const first = upsertNamedItemView([], {
    name: "Grooming",
    columns: ["title", "status"],
    filters: { primarySort: "priority", secondarySort: "due", groupBy: "status", mode: "list" },
  });
  const next = upsertNamedItemView(first, {
    name: "Grooming",
    columns: ["title", "priority"],
    filters: { primarySort: "due", secondarySort: "priority", groupBy: "priority", mode: "list" },
  });
  assert.equal(next.length, 1);
  assert.equal(next[0].columns[1], "priority");
  assert.equal(next[0].filters?.primarySort, "due");
});

test("My Work defaults to project sections", () => {
  const myWork = defaultItemViewFilters(null);
  const project = defaultItemViewFilters("proj-1");
  assert.equal(myWork.groupBy, "project");
  assert.equal(project.groupBy, "hierarchy");
});

test("normalize forces My Work to project groupBy and restores project session sorts", () => {
  const myWork = normalizeItemViewFilters(
    { primarySort: "due", secondarySort: "title", groupBy: "priority", mode: "calendar" },
    null,
  );
  assert.equal(myWork.primarySort, "due");
  assert.equal(myWork.secondarySort, "title");
  assert.equal(myWork.groupBy, "project");
  assert.equal(myWork.mode, "calendar");
  assert.equal(myWork.projectFilter, "all");

  const project = normalizeItemViewFilters(
    { primarySort: "due", secondarySort: "title", groupBy: "priority", mode: "calendar" },
    "proj-1",
  );
  assert.equal(project.groupBy, "priority");
  assert.equal(project.projectFilter, "proj-1");
});

test("parent-owned notion/force modes win over local mode (no tab thrash)", () => {
  assert.equal(
    resolveWorkItemsViewMode({ localMode: "list", notionSurface: true, notionMode: "gantt" }),
    "gantt",
  );
  assert.equal(
    resolveWorkItemsViewMode({ localMode: "gantt", notionSurface: true, notionMode: "list" }),
    "list",
  );
  assert.equal(
    resolveWorkItemsViewMode({ localMode: "list", forceMode: "kanban", notionSurface: true, notionMode: "gantt" }),
    "kanban",
  );
  assert.equal(
    resolveWorkItemsViewMode({ localMode: "calendar", notionSurface: false }),
    "calendar",
  );
});

test("session hydrate skips mode when parent controls the view", () => {
  assert.equal(shouldApplySessionMode({ notionSurface: true }), false);
  assert.equal(shouldApplySessionMode({ forceMode: "kanban" }), false);
  assert.equal(shouldApplySessionMode({}), true);
  assert.equal(shouldApplySessionMode({ notionSurface: false }), true);
});
