import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canEditColumn,
  canViewColumn,
  normalizeColumnAccess,
  redactRecordValues,
  resolveColumnAccess,
  visibleColumnsForActor,
} from "../src/lib/tables/permissions";
import type { Column, RecordDoc, TableDoc } from "../src/lib/tables/types";

function baseTable(columns: Column[]): TableDoc {
  return {
    id: "t1",
    workspaceId: "w1",
    name: "People",
    icon: "▦",
    color: "#2547C4",
    visibility: "workspace",
    columns,
    keyColumns: { title: "name" },
    recordCount: 0,
    createdBy: "owner",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    permissions: {
      visibility: "workspace",
      editors: ["owner", "editor"],
      viewers: ["viewer"],
    },
  };
}

test("normalizeColumnAccess maps hiddenForViewers to no access", () => {
  const access = normalizeColumnAccess({
    id: "salary",
    name: "Salary",
    type: "currency",
    hiddenForViewers: true,
  });
  assert.equal(access.defaultAccess, "none");
});

test("table editors always get full column access", () => {
  const table = baseTable([
    {
      id: "salary",
      name: "Salary",
      type: "currency",
      access: { defaultAccess: "none", exceptions: [] },
    },
  ]);
  assert.equal(
    resolveColumnAccess(table, table.columns[0], { userId: "owner" }),
    "full",
  );
  assert.equal(
    resolveColumnAccess(table, table.columns[0], { userId: "editor" }),
    "full",
  );
});

test("viewers respect default and exceptions", () => {
  const table = baseTable([
    {
      id: "salary",
      name: "Salary",
      type: "currency",
      access: {
        defaultAccess: "none",
        exceptions: [
          {
            id: "e1",
            subjectType: "user",
            subjectId: "hr-lead",
            access: "view",
          },
          {
            id: "e2",
            subjectType: "role",
            subjectId: "hr",
            access: "full",
          },
        ],
      },
    },
  ]);
  assert.equal(
    canViewColumn(table, table.columns[0], { userId: "viewer" }),
    false,
  );
  assert.equal(
    canViewColumn(table, table.columns[0], { userId: "hr-lead" }),
    true,
  );
  assert.equal(
    canEditColumn(table, table.columns[0], { userId: "hr-lead" }),
    false,
  );
  assert.equal(
    canEditColumn(table, table.columns[0], {
      userId: "anyone",
      roles: ["hr"],
    }),
    true,
  );
});

test("redactRecordValues strips no-access columns", () => {
  const table = baseTable([
    { id: "name", name: "Name", type: "text" },
    {
      id: "salary",
      name: "Salary",
      type: "currency",
      access: { defaultAccess: "none", exceptions: [] },
    },
  ]);
  const record: RecordDoc = {
    id: "r1",
    tableId: "t1",
    workspaceId: "w1",
    values: { name: "Ada", salary: 164000 },
    order: 0,
    createdBy: "owner",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    updatedBy: "owner",
  };
  const redacted = redactRecordValues(table, record, { userId: "viewer" });
  assert.equal(redacted.values.name, "Ada");
  assert.equal(redacted.values.salary, undefined);
  const visible = visibleColumnsForActor(table, { userId: "viewer" });
  assert.deepEqual(
    visible.map((c) => c.id),
    ["name"],
  );
});

test("Property access UI and wiring exist", () => {
  const modal = readFileSync(
    resolve("src/features/tables/PropertyAccessModal.tsx"),
    "utf8",
  );
  const editor = readFileSync(
    resolve("src/features/tables/ColumnsEditor.tsx"),
    "utf8",
  );
  const page = readFileSync(resolve("src/features/tables/TablePage.tsx"), "utf8");
  const storage = readFileSync(resolve("src/lib/tables/storage.ts"), "utf8");
  assert.match(modal, /property-access-modal/);
  assert.match(modal, /tables\.access\.title/);
  assert.match(editor, /PropertyAccessModal/);
  assert.match(editor, /tables-access-col-/);
  assert.match(page, /visibleColumnsForActor/);
  assert.match(page, /assertCanWriteColumn/);
  assert.match(storage, /assertCanWriteColumn/);
});
