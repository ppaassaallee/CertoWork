import test from "node:test";
import assert from "node:assert/strict";
import { propertySampleRentTotal } from "../src/lib/tables/templates/propertyManagement.ts";
import { footerSummary } from "../src/lib/tables/services/compute.ts";
import {
  loopGuardAllows,
  matchesTrigger,
  sentenceFromStructured,
} from "../src/lib/routines/structured.ts";
import { softTintToCss } from "../src/lib/tables/extendedTypes.ts";

test("property management sample rents sum to 7600", () => {
  assert.equal(propertySampleRentTotal(), 7600);
});

test("footerSummary sum and distribution", () => {
  const records = [
    { values: { rent: 1600, occupancy: "occupied" } },
    { values: { rent: 2200, occupancy: "occupied" } },
    { values: { rent: 1450, occupancy: "occupied" } },
    { values: { rent: 0, occupancy: "vacant" } },
    { values: { rent: 2350, occupancy: "occupied" } },
  ];
  const sum = footerSummary(records as never, {
    id: "rent",
    name: "Monthly rent",
    type: "number",
    summary: "sum",
  });
  assert.equal(sum.kind, "sum");
  assert.equal(sum.value, 7600);

  const dist = footerSummary(records as never, {
    id: "occupancy",
    name: "Occupancy",
    type: "status",
    summary: "distribution",
  });
  assert.equal(dist.kind, "distribution");
  assert.deepEqual(dist.value, { occupied: 4, vacant: 1 });
});

test("loop guard blocks same routineRunId", () => {
  assert.equal(
    loopGuardAllows(
      { tableId: "t", recordId: "r", type: "record.changed", routineRunId: "run_1" },
      "run_1",
      0,
    ),
    false,
  );
  assert.equal(
    loopGuardAllows(
      { tableId: "t", recordId: "r", type: "record.changed", routineRunId: null },
      "run_1",
      0,
    ),
    true,
  );
  assert.equal(
    loopGuardAllows(
      { tableId: "t", recordId: "r", type: "record.changed" },
      "run_1",
      3,
    ),
    false,
  );
});

test("matchesTrigger status change", () => {
  const ok = matchesTrigger(
    {
      tableId: "maint",
      recordId: "r1",
      type: "record.changed",
      columnId: "status",
      to: "completed",
    },
    { type: "record.changed", tableId: "maint", columnId: "status", to: "completed" },
  );
  assert.equal(ok, true);
  const no = matchesTrigger(
    {
      tableId: "maint",
      recordId: "r1",
      type: "record.changed",
      columnId: "status",
      to: "new",
    },
    { type: "record.changed", tableId: "maint", columnId: "status", to: "completed" },
  );
  assert.equal(no, false);
});

test("sentenceFromStructured", () => {
  const s = sentenceFromStructured(
    {
      kind: "structured",
      scope: { type: "table", tableId: "t" },
      trigger: { type: "record.changed", tableId: "t", columnId: "status", to: "completed" },
      conditions: [],
      actions: [{ type: "set", columnId: "completedAt", value: { fn: "today" } }],
      sentence: "",
      enabled: true,
      owner: "u",
    },
    (id) => (id === "status" ? "Status" : id === "completedAt" ? "Completion date" : id),
  );
  assert.match(s, /Status/);
  assert.match(s, /Completion date|set/);
});

test("soft tint labels stay readable", () => {
  const green = softTintToCss("green");
  assert.ok(green.bg.includes("rgba"));
  assert.equal(green.fg, "#166534");
});
