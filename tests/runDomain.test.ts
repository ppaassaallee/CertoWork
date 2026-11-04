import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CAP_MONTH,
  DEFAULT_CAPS,
  DEFAULT_MANIFESTO,
  RUN_WORLDS,
  SPLIT_CLIENTS,
  WEEKS_PER_MONTH,
  adminNeverMake,
  checkAdminWrite,
  checkAllocation,
  checkMoveToMake,
  checkSetPriority,
  checkTitle,
  checkTop3,
  dayPlan,
  gateDest,
  hSem,
  isRunWorld,
  mondayOf,
  morningWorld,
  pbiReady,
  vis,
  workingDaysOfMonth,
} from "../src/run/domain/index.ts";
import { runDocToDeskItem } from "../src/lib/certoRun/store.ts";

const workspace = { id: "ws-1", name: "Pure AI" };

function item(id: string, decision: string, extra: Record<string, unknown> = {}) {
  const row = runDocToDeskItem(
    id,
    { title: id, runDecision: decision, status: "open", workspaceId: workspace.id, runWorld: "Pure AI", ...extra },
    workspace,
  );
  if (!row) throw new Error(`expected ${id}`);
  return row;
}

test("default caps are 5 make, 10 P1, 15 admin, 3 tomorrow", () => {
  assert.equal(DEFAULT_CAPS.make, 5);
  assert.equal(DEFAULT_CAPS.p1, 10);
  assert.equal(DEFAULT_CAPS.admin, 15);
  assert.equal(DEFAULT_CAPS.tomorrow, 3);
  assert.equal(DEFAULT_CAPS.adminSlaHours, 72);
});

test("the sixth Make item is refused with the current five", () => {
  const items = Array.from({ length: 5 }, (_, index) => item(`m${index}`, "make"));
  const extra = item("extra", "decide");
  const result = checkMoveToMake([...items, extra], { workspace: "ws-1" }, "extra");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.current.length, 5);
});

test("the eleventh P1 is refused", () => {
  const items = Array.from({ length: 10 }, (_, index) => item(`p${index}`, "make", { priority: "P1" }));
  const extra = item("extra", "make", { priority: "P2" });
  const result = checkSetPriority([...items, extra], { workspace: "ws-1" }, "extra", "P1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "p1");
});

test("the sixteenth admin item is refused", () => {
  const items = Array.from({ length: 15 }, (_, index) => item(`a${index}`, "admin_batch", { lane: "admin" }));
  const extra = item("extra", "decide", { lane: "admin" });
  const result = checkAdminWrite([...items, extra], { workspace: "ws-1" }, "extra");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "admin");
});

test("the fourth item for tomorrow is refused", () => {
  const result = checkTop3(["a", "b", "c"], "d");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "tomorrow");
});

test("titles stay at twelve words and reject channel words", () => {
  assert.equal(checkTitle("Send Roger the proposal").ok, true);
  assert.equal(checkTitle("Waiting whatsapp update for the team").banned, true);
  assert.equal(checkTitle("one two three four five six seven eight nine ten eleven twelve thirteen").tooLong, true);
});

test("admin never becomes Make", () => {
  assert.equal(adminNeverMake("admin", "make"), true);
  assert.equal(adminNeverMake("commercial", "make"), false);
});

test("November 2026 counts Monday to Friday", () => {
  assert.equal(workingDaysOfMonth(2026, 11).length, 21);
});

test("mondayOf keeps the civil week", () => {
  assert.equal(mondayOf("2026-11-04"), "2026-11-02");
});

test("Tuesday morning belongs to Boldr AI", () => {
  assert.equal(morningWorld("2026-11-03"), "Boldr AI");
});

test("Wednesday morning belongs to Pure AI", () => {
  assert.equal(morningWorld("2026-11-04"), "Pure AI");
});

test("Sunday is a personal block", () => {
  const plan = dayPlan("2026-11-01");
  assert.equal(plan[0]?.kind, "weekend");
  assert.equal(plan[0]?.world, "Personal");
});

test("Pure AI does not open a Boldr AI block", () => {
  const make = dayPlan("2026-11-03").find((block) => block.kind === "make");
  assert.ok(make);
  assert.equal(make.world, "Boldr AI");
  assert.equal(vis(make, "Pure AI"), false);
  assert.equal(vis(make, "Boldr AI"), true);
});

test("allocation over 100 percent is refused with that person's rows", () => {
  const rows = [
    { person: "Ada", project: "Pure", pct: 80 },
    { person: "Ada", project: "Internal", pct: 30 },
  ];
  const result = checkAllocation(rows, "Ada");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.rows.length, 2);
});

test("weekly hours use 170 hours and 4.33 weeks", () => {
  assert.equal(DEFAULT_CAP_MONTH, 170);
  assert.equal(WEEKS_PER_MONTH, 4.33);
  assert.ok(Math.abs(hSem(170, 100) - 170 / 4.33) < 1e-9);
});

test("the first No on the intake gate names the destination", () => {
  const note = gateDest({ commitment: false });
  assert.equal(note?.name, "Note");
  assert.equal(note?.pbi, false);
});

test("five Yes answers create a PBI", () => {
  const dest = gateDest({ commitment: true, yours: true, new: true, alive: true, promised: true });
  assert.equal(dest?.pbi, true);
  assert.equal(pbiReady({
    world: "Pure AI",
    client: "Klap",
    lane: "commercial",
    decision: "make",
    title: "Send Klap the proposal",
    deliverable: "Proposal",
    doneWhen: "Klap has it",
    nextStep: "Send the file",
    date: "",
    source: "meeting",
  }), true);
});

test("the manifesto keeps the two worlds apart", () => {
  assert.match(DEFAULT_MANIFESTO, /Two worlds, never mixed/);
  assert.match(DEFAULT_MANIFESTO, /Short night/);
});

test("split clients are asked per world", () => {
  assert.deepEqual(SPLIT_CLIENTS, ["Cementos Progreso", "Credichapin", "Klap", "Menzis", "PYP", "Tecalis"]);
});

test("world names are Pure AI, Boldr AI and Personal", () => {
  assert.deepEqual(RUN_WORLDS, ["Pure AI", "Boldr AI", "Personal"]);
  assert.equal(isRunWorld("Personal Focus"), false);
  assert.equal(isRunWorld("Pure AI"), true);
});
