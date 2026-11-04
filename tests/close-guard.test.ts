import assert from "node:assert/strict";
import test from "node:test";
import {
  blockDoneWithOpenChildren,
  dismissCloseGuard,
  getCloseGuardSnapshot,
  isMovingToDone,
  resetCloseGuardForTests,
  unfinishedDescendants,
} from "../src/lib/closeGuard.ts";

const epic = { id: "e", title: "Launch", workItemType: "epic", status: "in_progress" };
const feature = { id: "f", title: "Payments", workItemType: "feature", status: "todo", parentId: "e" };
const pbi = { id: "p", title: "Checkout", workItemType: "pbi", status: "in_progress", parentId: "f" };
const subtask = { id: "s", title: "Copy", workItemType: "subtask", status: "todo", parentId: "p" };
const doneFeature = { ...feature, id: "fd", title: "Done feature", status: "done" };
const donePbi = { ...pbi, id: "pd", title: "Done pbi", status: "done", parentId: "fd" };
const cancelled = { id: "c", title: "Dropped", workItemType: "pbi", status: "cancelled", parentId: "e" };
const removed = { id: "r", title: "Gone", workItemType: "feature", status: "deleted", parentId: "e", deletedAt: "2026-01-01" };

test("a parent stays open while any descendant is open", () => {
  const items = [epic, feature, pbi, subtask, cancelled, removed];
  const open = unfinishedDescendants(epic, items).map((item) => (item as { id: string }).id);
  assert.deepEqual(open, ["f", "p", "s"]);
  assert.equal(unfinishedDescendants(feature, items).length, 2);
  assert.equal(unfinishedDescendants(subtask, items).length, 0);
  assert.equal(isMovingToDone(epic, { status: "done" }), true);
  assert.equal(isMovingToDone({ status: "done" }, { status: "done" }), false);
  assert.equal(isMovingToDone(epic, { status: "cancelled" }), false);
  assert.equal(isMovingToDone(epic, { title: "Launch" }), false);
});

test("done and cancelled descendants do not block", () => {
  resetCloseGuardForTests();
  const items = [epic, doneFeature, donePbi, cancelled];
  assert.equal(unfinishedDescendants(epic, items).length, 0);
  assert.equal(blockDoneWithOpenChildren(epic, items), false);
  assert.equal(getCloseGuardSnapshot(), null);
});

test("blocking explains the open children and does not stack forever", () => {
  resetCloseGuardForTests();
  const items = [epic, feature, pbi];
  assert.equal(blockDoneWithOpenChildren(epic, items), true);
  const guard = getCloseGuardSnapshot();
  assert.equal(guard?.parentTitle, "Launch");
  assert.deepEqual(guard?.open.map((row) => row.title), ["Payments", "Checkout"]);
  dismissCloseGuard();
  assert.equal(getCloseGuardSnapshot(), null);
});
