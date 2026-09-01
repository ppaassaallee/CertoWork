import assert from "node:assert/strict";
import test from "node:test";

import {
  clampKanbanColumnWidth,
  KANBAN_COLUMNS,
  laneForKanbanColumn,
} from "../src/lib/kanbanBoard";

test("kanban delivery columns use Asana-like names", () => {
  assert.deepEqual(
    KANBAN_COLUMNS.map((column) => column.label),
    ["Backlog", "In progress", "Blocked", "Completed"],
  );
});

test("adding a card to a kanban column maps to the matching work lane", () => {
  assert.equal(laneForKanbanColumn("doing"), "in_progress");
  assert.equal(laneForKanbanColumn("done"), "done");
  assert.equal(laneForKanbanColumn("blocked"), "blocked");
  assert.equal(laneForKanbanColumn("backlog"), "backlog");
});

test("kanban columns can be made shorter or longer within a usable range", () => {
  assert.equal(clampKanbanColumnWidth(80), 200);
  assert.equal(clampKanbanColumnWidth(900), 520);
  assert.equal(clampKanbanColumnWidth(320), 320);
});
