import assert from "node:assert/strict";
import test from "node:test";

import {
  compileTablePhrase,
  validateCompiledTableSchema,
} from "../src/lib/tables/compile";
import {
  compileTablePhrase as workerCompile,
  validateCompiledTableSchema as workerValidate,
} from "../worker/tablesCompile.js";

test("deterministic parser extracts Spanish vendors phrase", () => {
  const result = compileTablePhrase({
    phrase: "proveedores con nombre, estado, responsable, renovación y monto",
    locale: "es",
  });
  assert.ok(result.schema);
  assert.match(result.schema!.name, /proveedores/i);
  const names = result.schema!.columns.map((c) => c.name.toLowerCase());
  assert.ok(names.some((n) => n.includes("nombre")));
  assert.ok(names.some((n) => n.includes("estado")));
  assert.ok(names.some((n) => n.includes("responsable")));
  assert.ok(names.some((n) => /renov/.test(n)));
  assert.ok(names.some((n) => n.includes("monto")));

  const byType = Object.fromEntries(
    result.schema!.columns.map((c) => [c.name.toLowerCase(), c.type]),
  );
  assert.equal(byType.estado, "status");
  assert.equal(byType.responsable, "person");
  assert.equal(byType.renovación || byType["renovacion"], "date");
  assert.equal(byType.monto, "currency");
  assert.ok(result.schema!.keyColumns.title);
  assert.ok(result.schema!.keyColumns.status);
  assert.ok(result.schema!.keyColumns.owner);
  assert.ok(result.schema!.keyColumns.date);
});

test("deterministic parser extracts English pipeline phrase", () => {
  const result = compileTablePhrase({
    phrase: "sales pipeline with deal, status, owner, amount and close date",
    locale: "en",
  });
  assert.ok(result.schema);
  assert.match(result.schema!.name, /sales|pipeline/i);
  assert.ok(result.schema!.columns.length >= 4);
  assert.ok(result.schema!.columns.some((c) => c.type === "status"));
  assert.ok(result.schema!.columns.some((c) => c.type === "person"));
});

test("vague phrase asks one clarification question", () => {
  const result = compileTablePhrase({
    phrase: "una tabla de clientes",
    locale: "es",
  });
  assert.equal(result.schema, undefined);
  assert.ok(result.question);
  assert.match(result.question!, /column/i);
});

test("empty phrase asks for guidance", () => {
  const result = compileTablePhrase({ phrase: "  ", locale: "en" });
  assert.ok(result.question);
  assert.equal(result.schema, undefined);
});

test("validateCompiledTableSchema rejects bad payloads", () => {
  const bad = validateCompiledTableSchema({ name: "", columns: [] });
  assert.equal(bad.ok, false);

  const good = validateCompiledTableSchema({
    name: "Demo",
    icon: "▦",
    columns: [
      { id: "nombre", name: "Nombre", type: "text" },
      {
        id: "estado",
        name: "Estado",
        type: "status",
        options: [{ id: "todo", label: "To do", tone: "neutral" }],
      },
    ],
    keyColumns: { title: "nombre", status: "estado", owner: null, date: null },
    statusOptions: [{ id: "todo", label: "To do", tone: "neutral" }],
  });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.schema.keyColumns.status, "estado");
  }
});

test("worker deterministic parser stays in sync with src", () => {
  const phrase = "proveedores con nombre, estado, responsable, renovación y monto";
  const a = compileTablePhrase({ phrase, locale: "es" });
  const b = workerCompile({ phrase, locale: "es" });
  assert.deepEqual(
    a.schema?.columns.map((c) => ({ name: c.name, type: c.type })),
    b.schema?.columns.map((c: { name: string; type: string }) => ({
      name: c.name,
      type: c.type,
    })),
  );
  assert.equal(a.schema?.name, b.schema?.name);

  const raw = {
    name: "X",
    columns: [{ id: "a", name: "A", type: "text" }],
    keyColumns: { title: "a" },
  };
  assert.equal(validateCompiledTableSchema(raw).ok, workerValidate(raw).ok);
});
