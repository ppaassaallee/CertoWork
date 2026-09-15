import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMyWorkRecords,
  recordOwnedByActor,
  recordToMyWorkItem,
  type RecordDoc,
  type TableDoc,
} from "../src/lib/tables";

const table: TableDoc = {
  id: "t1",
  workspaceId: "w1",
  name: "CRM",
  icon: "▦",
  color: "#000",
  visibility: "workspace",
  columns: [
    { id: "titulo", name: "Título", type: "text" },
    { id: "estado", name: "Estado", type: "status", options: [{ id: "todo", label: "To do", tone: "neutral" }] },
    { id: "responsable", name: "Responsable", type: "person" },
    { id: "fecha", name: "Fecha", type: "date" },
  ],
  keyColumns: { title: "titulo", status: "estado", owner: "responsable", date: "fecha" },
  recordCount: 1,
  createdBy: "u1",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const record: RecordDoc = {
  id: "r1",
  tableId: "t1",
  workspaceId: "w1",
  values: {
    titulo: "Brevo",
    estado: "todo",
    responsable: "u1",
    fecha: "2026-09-15",
  },
  order: 0,
  createdBy: "u1",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  updatedBy: "u1",
};

test("recordOwnedByActor matches owner column", () => {
  assert.equal(recordOwnedByActor(record, table, { userId: "u1" }), true);
  assert.equal(recordOwnedByActor(record, table, { userId: "u2" }), false);
});

test("recordToMyWorkItem maps key columns", () => {
  const item = recordToMyWorkItem(record, table);
  assert.equal(item.entityKind, "record");
  assert.equal(item.title, "Brevo");
  assert.equal(item.tableId, "t1");
  assert.equal(item.dueDate, "2026-09-15");
});

test("buildMyWorkRecords filters by today section", () => {
  const items = buildMyWorkRecords({
    tables: [table],
    records: [record],
    actor: { userId: "u1" },
    section: "today",
    now: new Date("2026-09-15T12:00:00"),
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "r1");
});
