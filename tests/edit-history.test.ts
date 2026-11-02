import assert from "node:assert/strict";
import test from "node:test";
import {
  bindItemHistoryWriter,
  describeItemEdit,
  pushEdit,
  recordItemEdit,
  redoEdit,
  resetEditHistoryForTests,
  undoEdit,
  getHistorySnapshot,
} from "../src/lib/editHistory.ts";

test("undo keeps five steps and a new edit clears redo", async () => {
  resetEditHistoryForTests();
  const log: string[] = [];
  for (let step = 1; step <= 6; step += 1) {
    pushEdit({
      label: { en: `Edit ${step}`, es: `Cambio ${step}` },
      undo: () => {
        log.push(`u${step}`);
      },
      redo: () => {
        log.push(`r${step}`);
      },
    });
  }
  assert.equal(getHistorySnapshot().undoCount, 5);
  assert.equal(getHistorySnapshot().undoLabel?.en, "Edit 6");
  await undoEdit();
  assert.deepEqual(log, ["u6"]);
  assert.equal(getHistorySnapshot().redoCount, 1);
  assert.equal(getHistorySnapshot().undoCount, 4);
  await redoEdit();
  assert.deepEqual(log, ["u6", "r6"]);
  pushEdit({
    label: { en: "Next", es: "Siguiente" },
    undo: () => undefined,
    redo: () => undefined,
  });
  assert.equal(getHistorySnapshot().redoCount, 0);
  assert.equal(getHistorySnapshot().undoCount, 5);
});

test("replaying an edit does not record another step", async () => {
  resetEditHistoryForTests();
  const seen: Array<Record<string, unknown>> = [];
  bindItemHistoryWriter((id, patch) => {
    seen.push({ id, ...patch });
    recordItemEdit(id, { title: "A", status: "todo" }, patch, patch);
  });
  recordItemEdit("task-1", { title: "A", status: "todo" }, { status: "done" }, { status: "done" });
  assert.equal(getHistorySnapshot().undoCount, 1);
  assert.equal(getHistorySnapshot().undoLabel?.en, "Marked “A” done");
  await undoEdit();
  assert.equal(seen[0]?.status, "todo");
  assert.equal(getHistorySnapshot().undoCount, 0);
  assert.equal(getHistorySnapshot().redoCount, 1);
  await redoEdit();
  assert.equal(seen[1]?.status, "done");
  assert.equal(getHistorySnapshot().undoCount, 1);
  assert.equal(getHistorySnapshot().redoCount, 0);
});

test("item edit labels stay short", () => {
  const before = { title: "Ship the board", status: "todo" };
  assert.equal(describeItemEdit(before, { title: "Ship it" }).es, "Renombrada “Ship the board”");
  assert.equal(describeItemEdit(before, { assigneeIds: ["m1"] }).en, "Reassigned “Ship the board”");
  assert.equal(describeItemEdit(before, { status: "deleted" }).en, "Deleted “Ship the board”");
});
