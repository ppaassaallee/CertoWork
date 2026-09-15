import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ensureStatusOptionTones,
  nextStatusTone,
  withStatusTone,
} from "../src/lib/tables/statusTones";
import {
  blankKeyColumns,
  blankTableColumns,
} from "../src/features/tables/defaults";

const root = resolve(import.meta.dirname, "..");

test("nextStatusTone prefers unused tones then least-used", () => {
  assert.equal(nextStatusTone([]), "neutral");
  assert.equal(nextStatusTone([{ tone: "neutral" }]), "info");
  assert.equal(
    nextStatusTone([{ tone: "neutral" }, { tone: "info" }, { tone: "success" }]),
    "warning",
  );
  assert.equal(
    nextStatusTone([
      { tone: "neutral" },
      { tone: "info" },
      { tone: "success" },
      { tone: "warning" },
      { tone: "danger" },
      { tone: "purple" },
    ]),
    "neutral",
  );
});

test("withStatusTone auto-assigns when tone is missing", () => {
  const first = withStatusTone({ id: "a", label: "A" }, []);
  assert.equal(first.tone, "neutral");
  const second = withStatusTone({ id: "b", label: "B" }, [first]);
  assert.equal(second.tone, "info");
  const kept = withStatusTone({ id: "c", label: "C", tone: "danger" }, [first, second]);
  assert.equal(kept.tone, "danger");
});

test("ensureStatusOptionTones fills gaps without clobbering picks", () => {
  const rows = ensureStatusOptionTones([
    { id: "a", label: "A" },
    { id: "b", label: "B", tone: "purple" },
    { id: "c", label: "C" },
  ]);
  assert.equal(rows[0].tone, "neutral");
  assert.equal(rows[1].tone, "purple");
  assert.equal(rows[2].tone, "info");
});

test("blank table starts with title-only columns", () => {
  const cols = blankTableColumns("en");
  const keys = blankKeyColumns();
  assert.equal(cols.length, 1);
  assert.equal(cols[0].type, "text");
  assert.equal(cols[0].id, keys.title);
  assert.equal(keys.status, null);
  assert.equal(keys.owner, null);
  assert.equal(keys.date, null);
});

test("CreateTableWizard exposes blank create entry", () => {
  const wizard = readFileSync(
    resolve(root, "src/features/tables/CreateTableWizard.tsx"),
    "utf8",
  );
  assert.match(wizard, /tables-create-blank/);
  assert.match(wizard, /loadBlank/);
  assert.match(wizard, /blankTableColumns/);
  assert.match(wizard, /setColumnsEditorOpen\(true\)/);
  assert.match(wizard, /PreviewSource = "template" \| "phrase" \| "blank"/);
});

test("ColumnsEditor edits status option colors", () => {
  const editor = readFileSync(
    resolve(root, "src/features/tables/ColumnsEditor.tsx"),
    "utf8",
  );
  assert.match(editor, /STATUS_TONES/);
  assert.match(editor, /withStatusTone/);
  assert.match(editor, /ensureStatusOptionTones/);
  assert.match(editor, /tables-tone-/);
  assert.match(editor, /addStatusOption/);
  assert.match(editor, /setOptionTone/);
});
