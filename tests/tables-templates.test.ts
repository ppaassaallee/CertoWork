import assert from "node:assert/strict";
import test from "node:test";

import {
  TABLE_TEMPLATES,
  getTableTemplate,
  templateAutomationSentence,
  templateDisplayName,
} from "../src/lib/tables/templates";

test("TABLE_TEMPLATES exposes eight curated templates", () => {
  assert.equal(TABLE_TEMPLATES.length, 8);
  const ids = TABLE_TEMPLATES.map((t) => t.id).sort();
  assert.deepEqual(ids, [
    "access",
    "clients",
    "okrs",
    "onboarding",
    "pipeline",
    "requests",
    "risks",
    "vendors",
  ]);
});

test("each template has columns, keyColumns, status tones, and one automation", () => {
  for (const tpl of TABLE_TEMPLATES) {
    assert.ok(tpl.columns.length >= 4, `${tpl.id} should have columns`);
    assert.ok(tpl.keyColumns.title, `${tpl.id} needs title key`);
    assert.ok(
      tpl.columns.some((c) => c.id === tpl.keyColumns.title),
      `${tpl.id} title key must exist`,
    );
    const statusCol = tpl.columns.find((c) => c.id === tpl.keyColumns.status);
    if (statusCol) {
      assert.equal(statusCol.type, "status");
      assert.ok((statusCol.options?.length || 0) >= 2);
      for (const opt of statusCol.options || []) {
        assert.match(
          opt.tone,
          /^(neutral|info|success|warning|danger|purple)$/,
          `${tpl.id} status tone`,
        );
      }
    }
    assert.ok(tpl.suggestedAutomation.sentenceEs);
    assert.ok(tpl.suggestedAutomation.sentenceEn);
    assert.ok(tpl.suggestedAutomation.trigger.kind);
  }
});

test("getTableTemplate finds by id", () => {
  const pipeline = getTableTemplate("pipeline");
  assert.ok(pipeline);
  assert.equal(pipeline?.id, "pipeline");
  assert.match(templateDisplayName(pipeline!, "es"), /pipeline|comercial/i);
  assert.match(templateAutomationSentence(pipeline!, "es"), /Ganado/i);
  assert.equal(getTableTemplate("missing"), undefined);
});

test("pipeline automation triggers on Ganado status", () => {
  const pipeline = getTableTemplate("pipeline");
  assert.ok(pipeline);
  assert.equal(pipeline?.suggestedAutomation.trigger.kind, "status_changed");
  if (pipeline?.suggestedAutomation.trigger.kind === "status_changed") {
    assert.equal(pipeline.suggestedAutomation.trigger.statusTo, "ganado");
  }
});

test("vendors automation is 15 days before renewal", () => {
  const vendors = getTableTemplate("vendors");
  assert.ok(vendors);
  assert.equal(vendors?.suggestedAutomation.trigger.kind, "date_reached");
  if (vendors?.suggestedAutomation.trigger.kind === "date_reached") {
    assert.equal(vendors.suggestedAutomation.trigger.offsetDays, 15);
  }
});

test("okrs automation is Friday schedule", () => {
  const okrs = getTableTemplate("okrs");
  assert.ok(okrs);
  assert.equal(okrs?.suggestedAutomation.trigger.kind, "schedule");
  if (okrs?.suggestedAutomation.trigger.kind === "schedule") {
    assert.match(okrs.suggestedAutomation.trigger.cron, /5$/);
  }
});
