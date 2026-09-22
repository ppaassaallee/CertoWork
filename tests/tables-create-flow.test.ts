import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { compileTablePhrase } from "../src/lib/tables/compile";
import { canSeeTable } from "../src/lib/tables/storage";
import type { TableDoc } from "../src/lib/tables/types";

const root = resolve(import.meta.dirname, "..");

test("CreateTableWizard has no unknown eslint-disable for react-hooks", () => {
  const wizard = readFileSync(
    resolve(root, "src/features/tables/CreateTableWizard.tsx"),
    "utf8",
  );
  assert.doesNotMatch(wizard, /eslint-disable[^\n]*react-hooks/);
});

test("phrase compile produces a schema the create path can persist", () => {
  const result = compileTablePhrase({
    phrase:
      "Proveedores y suscripciones con nombre, estado, responsable, fecha de renovación y monto mensual",
    locale: "es",
  });
  assert.ok(result.schema);
  assert.ok(result.schema!.columns.length >= 4);
  assert.equal(result.schema!.keyColumns.status, "estado");
  assert.equal(result.schema!.keyColumns.owner, "responsable");
});

test("created workspace table is visible immediately after optimistic insert", () => {
  const uid = "user_abc";
  const created: TableDoc = {
    id: "tbl_new",
    workspaceId: "ws_1",
    projectId: null,
    name: "Proveedores y suscripciones",
    icon: "✦",
    color: "#3C3489",
    visibility: "workspace",
    columns: [
      { id: "nombre", name: "Nombre", type: "text", required: true },
      { id: "estado", name: "Estado", type: "status" },
    ],
    keyColumns: { title: "nombre", status: "estado", owner: null, date: null },
    recordCount: 0,
    templateId: null,
    createdBy: uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    favorite: false,
  };
  assert.equal(canSeeTable(created, uid, []), true);
  const next = [created];
  assert.equal(next.filter((t) => canSeeTable(t, uid, [])).length, 1);
});

test("create coerces project visibility without projectId to workspace", () => {
  const wizard = readFileSync(
    resolve(root, "src/features/tables/CreateTableWizard.tsx"),
    "utf8",
  );
  // Without a home projectId, picking "project" visibility must fall back to workspace.
  assert.match(wizard, /homeProjectId/);
  assert.match(
    wizard,
    /visibility === "project"[\s\n]*\? "workspace"/,
  );
});

test("TABLES and TABLE_RECORDS listeners are workspace-scoped", () => {
  const shell = readFileSync(
    resolve(root, "src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  assert.match(
    shell,
    /makeQuery\(\s*TABLES,\s*\(items\)\s*=>[\s\S]*?false,\s*false,\s*\)/,
  );
  assert.match(
    shell,
    /makeQuery\(\s*TABLE_RECORDS,\s*\(items\)\s*=>[\s\S]*?false,\s*false,\s*\)/,
  );
});
