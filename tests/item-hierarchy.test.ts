import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedChildKinds,
  allowedParentItems,
  allowedParentKinds,
  effectiveInheritedField,
  effectivePriority,
  hierarchyChildren,
  hierarchyRoot,
  hierarchyRoots,
  parentLinkPatch,
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

test("PBIs can only pick epics as parents, and tasks can only pick PBIs", () => {
  const epic = { id: "e1", title: "Launch", workItemType: "epic", projectId: "p" };
  const otherEpic = { id: "e2", title: "Platform", workItemType: "epic", projectId: "p" };
  const pbi = { id: "p1", title: "MVP", workItemType: "pbi", projectId: "p" };
  const task = { id: "t1", title: "Build", workItemType: "task", projectId: "p" };
  const items = [epic, otherEpic, pbi, task];

  assert.deepEqual(allowedParentKinds("epic"), []);
  assert.deepEqual(allowedParentKinds("pbi"), ["epic"]);
  assert.deepEqual(allowedParentKinds("task"), ["pbi", "story"]);
  assert.deepEqual(allowedParentItems(pbi, items).map((item) => item.id), ["e1", "e2"]);
  assert.deepEqual(allowedParentItems(epic, items), []);
  assert.deepEqual(allowedParentItems(task, items).map((item) => item.id), ["p1"]);
  assert.deepEqual(parentLinkPatch(epic), { parentId: "e1", epicId: "e1", featureId: null });
  assert.deepEqual(parentLinkPatch(null), { parentId: null, epicId: null, featureId: null });
});

test("epics stored as type=epic still appear as PBI parents, and other projects are a fallback", () => {
  const typedEpic = { id: "e3", title: "Growth", type: "epic", projectId: "other" };
  const pbi = { id: "p1", title: "MVP", workItemType: "pbi", projectId: "p" };
  const otherPbi = { id: "p2", title: "Other PBI", workItemType: "pbi", projectId: "p" };
  assert.deepEqual(allowedParentItems(pbi, [typedEpic, otherPbi]).map((item) => item.id), ["e3"]);
});

test("allowedChildKinds is the inverse nesting table", () => {
  assert.deepEqual(allowedChildKinds("epic"), ["pbi", "feature", "story"]);
  assert.deepEqual(allowedChildKinds("feature"), ["pbi", "story"]);
  assert.deepEqual(allowedChildKinds("pbi"), ["task", "bug"]);
  assert.deepEqual(allowedChildKinds("story"), ["task", "bug"]);
  assert.deepEqual(allowedChildKinds("task"), ["subtask"]);
  assert.deepEqual(allowedChildKinds("bug"), ["subtask"]);
  assert.deepEqual(allowedChildKinds("subtask"), []);
});

test("effectivePriority inherits from the highest ancestor; due dates stay local", () => {
  const epic = { id: "e1", title: "Launch", workItemType: "epic", priority: "1", dueDate: "2026-01-01" };
  const feature = {
    id: "f1",
    title: "Auth",
    workItemType: "feature",
    parentId: "e1",
    epicId: "e1",
    priority: "3",
    dueDate: "2026-02-01",
  };
  const pbi = {
    id: "p1",
    title: "Login",
    workItemType: "pbi",
    parentId: "f1",
    featureId: "f1",
    epicId: "e1",
    priority: null,
    dueDate: "2026-03-01",
  };
  const items = [epic, feature, pbi];

  assert.equal(effectivePriority(pbi, items), "1");
  assert.equal(effectivePriority(feature, items), "1");
  assert.equal(effectiveInheritedField(pbi, items, "priority"), "1");
  assert.equal(effectiveInheritedField(pbi, items, "dueDate"), "2026-03-01");
  assert.equal(effectiveInheritedField(feature, items, "dueDate"), "2026-02-01");
  assert.equal(effectiveInheritedField(pbi, items, "targetDate"), null);
  assert.equal(effectiveInheritedField(pbi, items, "startDate"), null);

  const orphan = { id: "p2", title: "Solo", workItemType: "pbi", priority: "2", dueDate: "2026-04-01" };
  assert.equal(effectivePriority(orphan, [orphan]), "2");
  assert.equal(effectiveInheritedField(orphan, [orphan], "dueDate"), "2026-04-01");
});

test("My Work-style filtered roots still resolve children from the full hierarchy pool", () => {
  const parent = { id: "p1", title: "Checkout", workItemType: "pbi", assignee: "me" };
  const mine = { id: "t1", title: "My part", workItemType: "task", parentId: "p1", assignee: "me" };
  const theirs = { id: "t2", title: "Their part", workItemType: "task", parentId: "p1", assignee: "other" };
  const myWorkView = [parent, mine];
  const fullPool = [parent, mine, theirs];

  assert.deepEqual(hierarchyRoots(myWorkView).map((item) => item.id), ["p1"]);
  assert.deepEqual(hierarchyChildren(myWorkView, "p1").map((item) => item.id), ["t1"]);
  assert.deepEqual(hierarchyChildren(fullPool, "p1").map((item) => item.id), ["t1", "t2"]);
});
