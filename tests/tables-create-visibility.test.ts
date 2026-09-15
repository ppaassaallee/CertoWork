import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("tables listener is workspace-scoped (not personal userId-only)", () => {
  const source = readFileSync(
    resolve(root, "src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  // TABLES subscription must use personal=false so docs with createdBy (no userId) appear.
  assert.match(
    source,
    /makeQuery\(\s*TABLES,[\s\S]*?false,\s*false,\s*\)/,
  );
});

test("createTable writes userId alongside createdBy", () => {
  const source = readFileSync(resolve(root, "src/lib/tables/storage.ts"), "utf8");
  assert.match(source, /userId:\s*explicitUserId\s*\|\|\s*rest\.createdBy/);
});

test("create wizard returns TableDoc and parent inserts optimistically", () => {
  const wizard = readFileSync(
    resolve(root, "src/features/tables/CreateTableWizard.tsx"),
    "utf8",
  );
  const shell = readFileSync(
    resolve(root, "src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  assert.match(wizard, /onCreated\(table:\s*TableDoc\)/);
  assert.match(wizard, /compileTablePhrase/);
  assert.match(shell, /setWorkspaceTables\(\(current\)\s*=>/);
  assert.match(shell, /onCreated=\{\(table\)\s*=>/);
});
