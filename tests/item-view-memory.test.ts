import assert from "node:assert/strict";
import test from "node:test";

import {
  itemViewPrefsDocId,
  itemViewSurface,
  namedViewsStorageKey,
  lastSessionsStorageKey,
  normalizeItemViewFilters,
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

test("normalize restores a valid last-used sort instead of the mount default", () => {
  const restored = normalizeItemViewFilters(
    { primarySort: "due", secondarySort: "title", groupBy: "priority", mode: "calendar" },
    null,
  );
  assert.equal(restored.primarySort, "due");
  assert.equal(restored.secondarySort, "title");
  assert.equal(restored.groupBy, "priority");
  assert.equal(restored.mode, "calendar");
  assert.equal(restored.projectFilter, "all");
});
