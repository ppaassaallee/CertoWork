import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("create table modal uses two-panel grid, not a single-column flex body", () => {
  const css = readFileSync(resolve(root, "src/features/tables/createTable.css"), "utf8");
  const wizard = readFileSync(
    resolve(root, "src/features/tables/CreateTableWizard.tsx"),
    "utf8",
  );
  assert.match(css, /grid-template-columns:\s*minmax\(360px,\s*400px\)/);
  assert.match(wizard, /cw-tables-create-left/);
  assert.match(wizard, /cw-tables-create-right/);
  assert.match(wizard, /createTable\.css/);
  assert.match(wizard, /tables\.create\.hint/);
  assert.match(wizard, /sampleRows/);
  assert.match(wizard, /cardPreviewColumns/);
  assert.match(wizard, /shortHeaders/);
  assert.doesNotMatch(wizard, /do-skill-head/);
  assert.doesNotMatch(wizard, /tables\.create\.kicker/);
  assert.doesNotMatch(wizard, /eslint-disable[^\n]*react-hooks/);
});
