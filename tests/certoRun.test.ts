import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { checkMoveToMake } from "../src/lib/certoRun/caps";
import { workingDaysOfMonth } from "../src/lib/certoRun/dates";
import { queueCounts, soloQ } from "../src/lib/certoRun/queues";
import { adminNeverMake, checkTitle } from "../src/lib/certoRun/intake";
import { isCertoRunItem } from "../src/lib/certoRun/item";
import { visibleWorkItems } from "../src/lib/itemRemoval";
import { RUN_COLLECTION, runDocToDeskItem } from "../src/lib/certoRun/store";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";

const workspace = { id: "ws-1", name: "Pure AI" };

function runItem(id: string, decision = "make") {
  const item = runDocToDeskItem(
    id,
    { title: id, runDecision: decision, status: "open", workspaceId: workspace.id, runWorld: "Pure AI" },
    workspace,
  );
  if (!item) throw new Error("expected a Certo Run item");
  return item;
}

test("Certo Run opens from /run inside the Certo Work shell", () => {
  assert.deepEqual(resolveDelivereeLens("/run"), { kind: "certo-run", tab: "today" });
  assert.deepEqual(resolveDelivereeLens("/run/queue"), { kind: "certo-run", tab: "queue" });
});

test("Certo Run reuses items and stays out of Work lists", () => {
  assert.equal(queueCounts([], { workspace: "ws-1" }).open, 0);
  const writes = readFileSync("src/lib/certoRun/writes.ts", "utf8");
  const desk = readFileSync("src/features/certo-run/CertoRunDesk.tsx", "utf8");
  const rules = readFileSync("firestore.rules", "utf8");
  assert.equal(RUN_COLLECTION, "tasks");
  assert.ok(writes.includes("runWorld"));
  assert.equal(writes.includes("run_items"), false);
  assert.equal(desk.includes("fromTask"), false);
  assert.equal(rules.includes("match /run_items/"), false);
  const work = { id: "w", title: "Ship the brief", status: "open" };
  const run = { id: "r", title: "Send the note", status: "open", runWorld: "Pure AI" };
  assert.equal(isCertoRunItem(work), false);
  assert.equal(isCertoRunItem(run), true);
  assert.deepEqual(visibleWorkItems([work, run]), [work]);
  assert.equal(runDocToDeskItem("w", work, { id: "ws-1" }), null);
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
  const pure = runDocToDeskItem("a", { title: "Note", runDecision: "make", status: "open", workspaceId: tenant.id, runWorld: "Pure AI" }, tenant);
  const boldr = runDocToDeskItem("b", { title: "Other", runDecision: "make", status: "open", workspaceId: tenant.id, runWorld: "Boldr AI" }, tenant);
  assert.ok(pure);
  assert.ok(boldr);
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
  const extra = runDocToDeskItem("extra", { title: "Extra", runDecision: "decide", status: "open", workspaceId: workspace.id, runWorld: "Pure AI", runInQueue: true }, workspace);
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
