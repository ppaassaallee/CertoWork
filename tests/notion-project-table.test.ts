import assert from "node:assert/strict";
import test from "node:test";
import {
  notionDifficulty,
  notionShortDate,
  notionStatusLabel,
  notionStatusTone,
} from "../src/lib/notionProjectTable";

test("notion status maps lanes to Spanish labels", () => {
  assert.equal(notionStatusLabel("done"), "Completado");
  assert.equal(notionStatusLabel("blocked"), "Bloqueado");
  assert.equal(notionStatusLabel("in_progress"), "En curso");
  assert.equal(notionStatusLabel("backlog"), "Pendiente");
  assert.equal(notionStatusTone("blocked"), "blocked");
});

test("notion difficulty follows priority", () => {
  assert.deepEqual(notionDifficulty("1"), { label: "High", tone: "high" });
  assert.deepEqual(notionDifficulty("2"), { label: "Medium", tone: "medium" });
  assert.deepEqual(notionDifficulty("3"), { label: "Low", tone: "low" });
});

test("notion short date formats YYYY-MM-DD", () => {
  assert.equal(notionShortDate("2026-09-01"), "Sep 1");
  assert.equal(notionShortDate(""), "");
});
