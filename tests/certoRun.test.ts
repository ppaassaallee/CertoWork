import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { checkMoveToMake } from "../src/lib/certoRun/caps";
import { workingDaysOfMonth } from "../src/lib/certoRun/dates";
import { queueCounts, soloQ } from "../src/lib/certoRun/queues";
import { adminNeverMake, checkTitle } from "../src/lib/certoRun/intake";
import { RUN_COLLECTION, runDocToDeskItem } from "../src/lib/certoRun/store";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";

const workspace = { id: "ws-1", name: "Pure AI" };

function runItem(id: string, decision = "make") {
  return runDocToDeskItem(id, { title: id, decision, status: "open", workspaceId: workspace.id }, workspace);
}

test("Certo Run opens from /run inside the Certo Work shell", () => {
  assert.deepEqual(resolveDelivereeLens("/run"), { kind: "certo-run", tab: "today" });
  assert.deepEqual(resolveDelivereeLens("/run/queue"), { kind: "certo-run", tab: "queue" });
});

test("Certo Run starts empty and does not touch Work tasks", () => {
  assert.equal(queueCounts([], { workspace: "ws-1" }).open, 0);
  const writes = readFileSync("src/lib/certoRun/writes.ts", "utf8");
  const desk = readFileSync("src/features/certo-run/CertoRunDesk.tsx", "utf8");
  const rules = readFileSync("firestore.rules", "utf8");
  assert.equal(writes.includes('"tasks"'), false);
  assert.equal(desk.includes("fromTask"), false);
  assert.equal(RUN_COLLECTION, "run_items");
  assert.ok(writes.includes("RUN_COLLECTION"));
  assert.match(rules, /match \/run_items\/\{id\}/);
});

test("only a Certo Run document enters a queue", () => {
  const item = runItem("a", "decide");
  const counts = queueCounts([item], { workspace: "ws-1" });
  assert.equal(counts.decide, 1);
  assert.equal(counts.make, 0);
  assert.equal(counts.open, 1);
});

test("Certo Run worlds are not Certo Work workspaces", () => {
  const tenant = { id: "personal-focus-id", name: "Personal Focus" };
  const pure = runDocToDeskItem("a", { title: "Note", decision: "make", status: "open", workspaceId: tenant.id, world: "Pure AI" }, tenant);
  const boldr = runDocToDeskItem("b", { title: "Other", decision: "make", status: "open", workspaceId: tenant.id, world: "Boldr AI" }, tenant);
  assert.equal(pure.world, "Pure AI");
  assert.notEqual(pure.world, tenant.name);
  assert.equal(queueCounts([pure, boldr], { workspace: "Pure AI" }).make, 1);
  assert.equal(queueCounts([pure, boldr], { workspace: "Personal Focus" }).open, 0);
  const desk = readFileSync("src/features/certo-run/CertoRunDesk.tsx", "utf8");
  assert.equal(desk.includes("workspaces"), false);
  assert.equal(resolveDelivereeLens("/run/team").kind, "certo-run");
});

test("the sixth Make item is refused with the current five", () => {
  const items = Array.from({ length: 5 }, (_, index) => runItem(`m${index}`));
  const extra = runDocToDeskItem("extra", { title: "Extra", decision: "decide", status: "open", workspaceId: workspace.id, inQueue: true }, workspace);
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
