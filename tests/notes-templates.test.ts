import test from "node:test";
import assert from "node:assert/strict";
import { noteTemplate } from "../src/lib/notes/templates";
import { getBlocks } from "../src/lib/semanticBlocks";

test("meeting template returns five blocks in order", () => {
  const { title, content } = noteTemplate("meeting", { date: "2026-09-15" });
  assert.equal(title, "Reunión · 2026-09-15");
  const blocks = getBlocks(content);
  // "notas" is in the type union but not SEMANTIC_BLOCKS, so getBlocks may drop it.
  // Assert fences in source order instead.
  const types = [...content.matchAll(/:::([a-z0-9_]+)/g)].map((m) => m[1]);
  assert.deepEqual(types, ["objetivo", "paso", "decision", "paso", "notas"]);
  assert.ok(blocks.length >= 4);
});

test("note template returns empty content", () => {
  const { title, content } = noteTemplate("note", { date: "2026-09-15" });
  assert.equal(title, "Nota");
  assert.equal(content, "");
});
