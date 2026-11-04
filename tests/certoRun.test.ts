import assert from "node:assert/strict";
import test from "node:test";

import { checkMoveToMake } from "../src/lib/certoRun/caps";
import { workingDaysOfMonth } from "../src/lib/certoRun/dates";
import { taskToDeskItem, type RunTask } from "../src/lib/certoRun/fromTask";
import { queueCounts, soloQ } from "../src/lib/certoRun/queues";
import { adminNeverMake, checkTitle } from "../src/lib/certoRun/intake";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";

const workspace = { id: "ws-1", name: "Pure AI" };

function task(partial: Partial<RunTask> & { id: string }): RunTask {
  return { title: partial.id, status: "open", ...partial };
}

test("Certo Run opens from /run inside the Certo Work shell", () => {
  assert.deepEqual(resolveDelivereeLens("/run"), { kind: "certo-run", tab: "today" });
  assert.deepEqual(resolveDelivereeLens("/run/queue"), { kind: "certo-run", tab: "queue" });
});

test("open tasks already in the workspace become the five queues", () => {
  const items = [
    taskToDeskItem(task({ id: "a", itemType: "next_action" }), workspace, "Alpha"),
    taskToDeskItem(task({ id: "b", itemType: "decision" }), workspace),
    taskToDeskItem(task({ id: "c", itemType: "follow_up", requesterId: "me" }), workspace),
    taskToDeskItem(task({ id: "d", itemType: "admin", tags: ["admin"] }), workspace),
    taskToDeskItem(task({ id: "e", itemType: "delegated" }), workspace),
    taskToDeskItem(task({ id: "f", itemType: "project_task" }), workspace),
  ].filter((item) => item !== null);
  const counts = queueCounts(items, { workspace: "ws-1" });
  assert.equal(counts.make, 1);
  assert.equal(counts.decide, 1);
  assert.equal(counts.owed, 1);
  assert.equal(counts.admin, 1);
  assert.equal(counts.delegated, 1);
  assert.equal(counts.open, 6);
  assert.equal(items.filter((item) => item.inQueue === false).length, 1);
});

test("the sixth Make item is refused with the current five", () => {
  const items = Array.from({ length: 5 }, (_, index) =>
    taskToDeskItem(task({ id: `m${index}`, title: `Make ${index}`, itemType: "next_action" }), workspace),
  ).filter((item) => item !== null);
  const extra = taskToDeskItem(task({ id: "extra", itemType: "project_task" }), workspace);
  assert.ok(extra);
  const result = checkMoveToMake([...items, extra], { workspace: "ws-1" }, "extra");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
    assert.equal(result.current.length, 5);
    assert.equal(soloQ([...items, extra], { workspace: "ws-1" }).length, 5);
  }
});

test("title standard and admin-never-make stay in the domain", () => {
  assert.equal(checkTitle("Send Roger the proposal").ok, true);
  assert.equal(checkTitle("Waiting whatsapp update for the team").banned, true);
  assert.equal(checkTitle("one two three four five six seven eight nine ten eleven twelve thirteen").tooLong, true);
  assert.equal(adminNeverMake("admin", "make"), true);
});

test("November 2026 counts Monday to Friday", () => {
  assert.equal(workingDaysOfMonth(2026, 11).length, 21);
});
