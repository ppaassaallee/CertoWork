import assert from "node:assert/strict";
import test from "node:test";

import {
  hierarchyChildren,
  hierarchyRoot,
  hierarchyRoots,
  sortHierarchyForest,
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

test("priority sort keeps children with the highest parent even when children have no priority", () => {
  const epic = { id: "e1", title: "Launch", workItemType: "epic", priority: "1" };
  const mvp = {
    id: "p1",
    title: "a) Construir un MVP",
    workItemType: "pbi",
    parentId: "e1",
    epicId: "e1",
    priority: null,
  };
  const deploy = {
    id: "p2",
    title: "b) Desplegar el verdadero minimo viable",
    workItemType: "pbi",
    parentId: "e1",
    epicId: "e1",
    priority: null,
  };
  const later = { id: "e2", title: "Later epic", workItemType: "epic", priority: "3" };
  const items = [deploy, later, mvp, epic];
  const byPriority = (left: any, right: any) =>
    String(left.priority || "9").localeCompare(String(right.priority || "9"))
    || String(left.title || "").localeCompare(String(right.title || ""));

  assert.equal(hierarchyRoot(mvp, items).id, "e1");
  assert.deepEqual(
    sortHierarchyForest(items, byPriority).map((item) => item.id),
    ["e1", "p1", "p2", "e2"],
  );
});

test("a nested feature still follows the epic when sorting families", () => {
  const epic = { id: "e1", title: "Platform", workItemType: "epic", priority: "1" };
  const feature = {
    id: "f1",
    title: "Auth",
    workItemType: "feature",
    parentId: "e1",
    epicId: "e1",
    priority: "3",
  };
  const pbi = {
    id: "p1",
    title: "Login",
    workItemType: "pbi",
    parentId: "f1",
    featureId: "f1",
    epicId: "e1",
    priority: null,
  };
  const other = { id: "e2", title: "Ops", workItemType: "epic", priority: "2" };
  const items = [pbi, other, feature, epic];
  const byPriority = (left: any, right: any) =>
    String(left.priority || "9").localeCompare(String(right.priority || "9"))
    || String(left.title || "").localeCompare(String(right.title || ""));

  assert.equal(hierarchyRoot(pbi, items).id, "e1");
  assert.deepEqual(
    sortHierarchyForest(items, byPriority).map((item) => item.id),
    ["e1", "f1", "p1", "e2"],
  );
});
