import assert from "node:assert/strict";
import test from "node:test";
import {
  isProjectRelationColumn,
  listProjectTables,
  projectIdsFromRelationValue,
  relatedProjectIdsOf,
  tableTouchesProject,
} from "../src/lib/tables/projectLinks.ts";
import type { Column, TableDoc } from "../src/lib/tables/types.ts";

function table(partial: Partial<TableDoc> & { id: string; name: string }): TableDoc {
  return {
    workspaceId: "ws",
    icon: "▦",
    color: "#2547C4",
    visibility: "workspace",
    columns: [],
    keyColumns: { title: "title" },
    recordCount: 0,
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  } as TableDoc;
}

test("relatedProjectIdsOf dedupes and trims", () => {
  assert.deepEqual(
    relatedProjectIdsOf({ relatedProjectIds: [" a ", "b", "a", "", "b"] }),
    ["a", "b"],
  );
  assert.deepEqual(relatedProjectIdsOf(null), []);
});

test("tableTouchesProject covers home and related", () => {
  const row = table({
    id: "t1",
    name: "Leases",
    projectId: "p-home",
    relatedProjectIds: ["p-rel"],
  });
  assert.equal(tableTouchesProject(row, "p-home"), true);
  assert.equal(tableTouchesProject(row, "p-rel"), true);
  assert.equal(tableTouchesProject(row, "other"), false);
});

test("listProjectTables sorts home before related", () => {
  const tables = [
    table({ id: "t-rel", name: "Alpha", relatedProjectIds: ["p1"] }),
    table({ id: "t-home", name: "Zulu", projectId: "p1" }),
    table({ id: "t-other", name: "Nope", projectId: "px" }),
  ];
  const rows = listProjectTables(tables, "p1");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.table.id, "t-home");
  assert.equal(rows[0]!.role, "home");
  assert.equal(rows[1]!.table.id, "t-rel");
  assert.equal(rows[1]!.role, "related");
});

test("projectIdsFromRelationValue accepts string or array", () => {
  assert.deepEqual(projectIdsFromRelationValue("p1"), ["p1"]);
  assert.deepEqual(projectIdsFromRelationValue(["p1", " p2 ", "p1", ""]), ["p1", "p2"]);
  assert.deepEqual(projectIdsFromRelationValue(null), []);
});

test("isProjectRelationColumn detects project relations", () => {
  const projectCol: Column = {
    id: "proj",
    name: "Project",
    type: "relation",
    relation: { to: "project", multiple: true },
  };
  const taskCol: Column = {
    id: "task",
    name: "Task",
    type: "relation",
    relation: { to: "task" },
  };
  assert.equal(isProjectRelationColumn(projectCol), true);
  assert.equal(isProjectRelationColumn(taskCol), false);
  assert.equal(isProjectRelationColumn({ type: "text" } as Column), false);
});
