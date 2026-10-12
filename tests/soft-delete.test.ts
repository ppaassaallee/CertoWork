import assert from "node:assert/strict";
import test from "node:test";

import {
  SOFT_DELETE_MS,
  UNDO_WINDOW_MS,
  archivePatch,
  purgeDeadline,
  restorePatch,
  softDeletePatch,
} from "../src/lib/softDelete";
import { pushUndo, resetUndoForTests, runUndo, currentUndo } from "../src/lib/undoToast";

test("soft delete is restorable for 30 days and undo lasts 10 seconds", () => {
  assert.equal(UNDO_WINDOW_MS, 10_000);
  assert.equal(SOFT_DELETE_MS, 30 * 24 * 60 * 60 * 1000);
  const now = new Date("2026-10-12T00:00:00.000Z");
  const patch = softDeletePatch("todo", now);
  assert.equal(patch.status, "deleted");
  assert.equal(patch.previousStatus, "todo");
  assert.equal(patch.purgeAfter, purgeDeadline(now));
  assert.equal(restorePatch("todo", now).status, "todo");
});

test("archive keeps the previous status for undo", () => {
  const patch = archivePatch("in_progress", new Date("2026-10-12T00:00:00.000Z"));
  assert.equal(patch.status, "archived");
  assert.equal(patch.previousStatus, "in_progress");
  assert.equal(restorePatch(patch.previousStatus).status, "in_progress");
});

test("undo toast runs the restore callback once", () => {
  resetUndoForTests();
  let ran = 0;
  pushUndo("Archived Weekly plan", () => {
    ran += 1;
  });
  assert.equal(currentUndo()?.message, "Archived Weekly plan");
  runUndo();
  assert.equal(ran, 1);
  assert.equal(currentUndo(), null);
  resetUndoForTests();
});
