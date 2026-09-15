import assert from "node:assert/strict";
import test from "node:test";
import { coerceValue, displayValue, validateRecord } from "../src/lib/tables/validate.ts";
import type { Column, TableDoc } from "../src/lib/tables/types.ts";

const baseTable = {
  keyColumns: { title: "nombre", status: "estado", owner: "responsable", date: "renueva" },
  columns: [
    { id: "nombre", name: "Nombre", type: "text", required: true },
    { id: "estado", name: "Estado", type: "status", options: [{ id: "ok", label: "Ok", tone: "success" }, { id: "vencido", label: "Vencido", tone: "danger" }] },
    { id: "monto", name: "Monto", type: "currency", currency: "USD" },
    { id: "renueva", name: "Renueva", type: "date" },
    { id: "tags", name: "Tags", type: "tags" },
    { id: "activo", name: "Activo", type: "checkbox" },
    { id: "owner", name: "Owner", type: "person" },
    { id: "link", name: "Link", type: "url" },
    { id: "rel", name: "Rel", type: "relation", relation: { to: "task", multiple: true } },
  ] as Column[],
} as Pick<TableDoc, "columns" | "keyColumns">;

test("coerceValue covers each column type", () => {
  assert.equal(coerceValue(baseTable.columns[0]!, "Brevo"), "Brevo");
  assert.equal(coerceValue(baseTable.columns[2]!, "1,200"), 1200);
  assert.equal(coerceValue(baseTable.columns[3]!, "2026-09-15"), "2026-09-15");
  assert.equal(coerceValue(baseTable.columns[1]!, "vencido"), "vencido");
  assert.equal(coerceValue(baseTable.columns[1]!, "nope"), undefined);
  assert.equal(coerceValue(baseTable.columns[6]!, "uid-1"), "uid-1");
  assert.deepEqual(coerceValue(baseTable.columns[4]!, "a, b"), ["a", "b"]);
  assert.equal(coerceValue(baseTable.columns[5]!, "true"), true);
  assert.equal(coerceValue(baseTable.columns[7]!, "https://x.test"), "https://x.test");
  assert.deepEqual(coerceValue(baseTable.columns[8]!, ["t1", "t2"]), ["t1", "t2"]);
});

test("validateRecord requires title and required columns", () => {
  const bad = validateRecord(baseTable, {});
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.nombre);

  const good = validateRecord(baseTable, { nombre: "Brevo", estado: "ok" });
  assert.equal(good.ok, true);
});

test("displayValue formats currency status and tags", () => {
  assert.match(displayValue(baseTable.columns[2]!, 1200, "en"), /\$1,200/);
  assert.equal(displayValue(baseTable.columns[1]!, "vencido"), "Vencido");
  assert.equal(displayValue(baseTable.columns[4]!, ["a", "b"]), "a, b");
});
