import assert from "node:assert/strict";
import test from "node:test";

import { matchesTableEventFilter } from "../src/lib/routines/tableEventMatch";
import { compileRoutineSentence } from "../src/lib/routines/compile";
import { prepareRitualData } from "../src/lib/routines/prepare";
import { matchesTableEventFilter as workerMatch } from "../worker/routinesScheduler.js";

test("matchesTableEventFilter requires tableId when present in filter", () => {
  assert.equal(
    matchesTableEventFilter({ tableId: "t1" }, { tableId: "t1" }),
    true,
  );
  assert.equal(
    matchesTableEventFilter({ tableId: "t1" }, { tableId: "t2" }),
    false,
  );
  assert.equal(matchesTableEventFilter({ tableId: "t1" }, {}), false);
  assert.equal(matchesTableEventFilter({}, { tableId: "t1" }), true);
  assert.equal(matchesTableEventFilter(null, { tableId: "t1" }), true);
});

test("matchesTableEventFilter matches optional to / columnId / offsetDays", () => {
  assert.equal(
    matchesTableEventFilter(
      { tableId: "t1", to: "done" },
      { tableId: "t1", to: "done" },
    ),
    true,
  );
  assert.equal(
    matchesTableEventFilter(
      { tableId: "t1", to: "done" },
      { tableId: "t1", to: "doing" },
    ),
    false,
  );
  assert.equal(
    matchesTableEventFilter(
      { tableId: "t1", columnId: "status", offsetDays: 3 },
      { tableId: "t1", columnId: "status", offsetDays: 3 },
    ),
    true,
  );
  assert.equal(
    matchesTableEventFilter(
      { tableId: "t1", offsetDays: 3 },
      { tableId: "t1", offsetDays: 0 },
    ),
    false,
  );
});

test("worker matchesTableEventFilter stays in sync with src helper", () => {
  const filter = { tableId: "tbl", to: "done", columnId: "st", offsetDays: 2 };
  const meta = { tableId: "tbl", to: "done", columnId: "st", offsetDays: 2 };
  assert.equal(workerMatch(filter, meta), matchesTableEventFilter(filter, meta));
  assert.equal(
    workerMatch({ tableId: "tbl", to: "done" }, { tableId: "tbl", to: "open" }),
    matchesTableEventFilter({ tableId: "tbl", to: "done" }, { tableId: "tbl", to: "open" }),
  );
});

test("compile accepts triggerOverride for table.* events", () => {
  const trigger = {
    kind: "event" as const,
    eventType: "table.status_changed" as const,
    filter: { tableId: "t1", to: "done" },
    cooldownSeconds: 60,
    human: "Cuando el estado → Done",
  };
  const result = compileRoutineSentence({
    sentence: "Cuando el estado → Done en Pipeline, entonces notificarme",
    scope: { entityType: "table", entityId: "t1", entityTitle: "Pipeline" },
    triggerOverride: trigger,
  });
  assert.equal(result.spec.trigger.kind, "event");
  if (result.spec.trigger.kind === "event") {
    assert.equal(result.spec.trigger.eventType, "table.status_changed");
    assert.equal(result.spec.trigger.filter?.tableId, "t1");
  }
  assert.equal(result.spec.scope.entityType, "table");
});

test("compile recognizes table.record_created from NL", () => {
  const result = compileRoutineSentence({
    sentence: "Cuando se cree un registro, notificarme",
    scope: { entityType: "table", entityId: "t1" },
  });
  assert.equal(result.spec.trigger.kind, "event");
  if (result.spec.trigger.kind === "event") {
    assert.equal(result.spec.trigger.eventType, "table.record_created");
  }
});

test("prepare record_context loads table + record + links", () => {
  const out = prepareRitualData(["record_context"], {
    userId: "u1",
    tasks: [],
    scopeEntityType: "record",
    scopeEntityId: "r1",
    tables: [
      {
        id: "t1",
        name: "Pipeline",
        keyColumns: { title: "title", status: "status" },
        columns: [{ id: "title", name: "Title", type: "text" }],
      },
    ],
    records: [
      {
        id: "r1",
        tableId: "t1",
        values: { title: "Acme", status: "doing" },
        updatedAt: "2026-09-15T12:00:00.000Z",
      },
    ],
    entityLinks: [
      {
        id: "l1",
        fromEntityType: "record",
        fromEntityId: "r1",
        toEntityType: "task",
        toEntityId: "task1",
        relation: "record_reference",
      },
    ],
  });
  const ctx = out.record_context as {
    table: { id: string; name: string } | null;
    record: { id: string; values: Record<string, unknown> } | null;
    links: unknown[];
  };
  assert.equal(ctx.table?.id, "t1");
  assert.equal(ctx.record?.id, "r1");
  assert.equal(ctx.record?.values.title, "Acme");
  assert.equal(ctx.links.length, 1);
});
