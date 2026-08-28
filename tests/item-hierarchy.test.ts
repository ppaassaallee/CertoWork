import assert from "node:assert/strict";
import test from "node:test";

import {
  hierarchyChildren,
  hierarchyRoots,
  visibleParentId,
} from "../src/lib/itemHierarchy";

test("PBIs and tasks nest under an epic even without a feature in between", () => {
  const epic = { id: "e1", title: "Launch", workItemType: "epic" };
  const pbi = { id: "p1", title: "Checkout", workItemType: "pbi", parentId: "e1", epicId: "e1" };
  const task = { id: "t1", title: "Copy", workItemType: "task", epicId: "e1" };
  const items = [epic, pbi, task];
  const ids = new Set(items.map((item) => item.id));

  assert.equal(visibleParentId(pbi, ids), "e1");
  assert.equal(visibleParentId(task, ids), "e1");
  assert.deepEqual(hierarchyRoots(items).map((item) => item.id), ["e1"]);
  assert.deepEqual(hierarchyChildren(items, "e1").map((item) => item.id), ["p1", "t1"]);
});

test("a PBI still appears under its epic when a stale featureId is missing from the list", () => {
  const epic = { id: "e1", title: "Launch", workItemType: "epic" };
  const pbi = {
    id: "p1",
    title: "Checkout",
    workItemType: "pbi",
    parentId: "",
    featureId: "gone-feature",
    epicId: "e1",
  };
  const items = [epic, pbi];
  const ids = new Set(items.map((item) => item.id));

  assert.equal(visibleParentId(pbi, ids), "e1");
  assert.deepEqual(hierarchyChildren(items, "e1").map((item) => item.id), ["p1"]);
  assert.deepEqual(hierarchyRoots(items).map((item) => item.id), ["e1"]);
});
