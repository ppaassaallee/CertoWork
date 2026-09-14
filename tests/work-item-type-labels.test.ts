import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  joinWorkItemTypeLabels,
  uniqueWorkItemTypes,
  workItemTypeLabel,
  WORK_ITEM_CREATE_TYPES,
} from "../src/lib/workItemTypeLabels";

test("canonical work item labels match product naming", () => {
  assert.equal(workItemTypeLabel("epic", "en"), "Epic");
  assert.equal(workItemTypeLabel("feature", "en"), "Feature");
  assert.equal(workItemTypeLabel("pbi", "en"), "PBI/Task");
  assert.equal(workItemTypeLabel("task", "en"), "PBI/Task");
  assert.equal(workItemTypeLabel("story", "en"), "PBI/Task");
  assert.equal(workItemTypeLabel("subtask", "en"), "Sub Task");
  assert.equal(workItemTypeLabel("bug", "en"), "bug");
  assert.equal(workItemTypeLabel("issue", "en"), "issue");
  assert.equal(workItemTypeLabel("idea", "en"), "idea");
  assert.equal(workItemTypeLabel("note", "en"), "note");
});

test("parent search labels dedupe pbi/story aliases", () => {
  assert.equal(joinWorkItemTypeLabels(["pbi", "story"], "en"), "PBI/Task");
  assert.deepEqual(uniqueWorkItemTypes(["pbi", "story", "task"], "en"), ["pbi"]);
  assert.deepEqual([...WORK_ITEM_CREATE_TYPES], [
    "epic",
    "feature",
    "pbi",
    "subtask",
    "bug",
    "issue",
  ]);
});

test("parent picker CSS stacks options in a column with opaque rows", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(css, /\.do-parent-picker\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.do-parent-options\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.do-parent-options\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.do-parent-options button\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(css, /\.do-parent-title\s*\{[^}]*text-overflow:\s*ellipsis/s);
  assert.doesNotMatch(css, /\.do-parent-kind\s*\{[^}]*text-transform:\s*uppercase/s);
});

test("item modal parent field uses full-width layout to avoid crush", () => {
  const css = readFileSync(resolve("src/features/items/ItemModal/ItemModal.css"), "utf8");
  assert.match(css, /\.cw-item-prop-row:has\(\.cw-item-parent\)\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test("shared label helper is wired into modal and items center", () => {
  const labels = readFileSync(resolve("src/features/items/ItemModal/labels.ts"), "utf8");
  const center = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");
  assert.match(labels, /workItemTypeLabel/);
  assert.match(labels, /Sub Task/);
  assert.match(center, /joinWorkItemTypeLabels/);
  assert.match(center, /do-parent-title/);
  assert.match(center, /type="text"/);
});
