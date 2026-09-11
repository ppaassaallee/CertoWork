import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workItems = readFileSync(new URL("../src/components/WorkItemsCenter.tsx", import.meta.url), "utf8");
const surfaces = readFileSync(new URL("../src/components/ProjectSurfaces.tsx", import.meta.url), "utf8");
const memory = readFileSync(new URL("../src/lib/itemViewMemory.ts", import.meta.url), "utf8");

test("My Work forces project sections and No Project label", () => {
  assert.match(workItems, /const NO_PROJECT_LABEL = "No Project"/);
  assert.match(workItems, /const isMyWork = !activeProject/);
  assert.match(workItems, /const effectiveGroupBy: GroupBy = isMyWork \? "project" : groupBy/);
  assert.match(workItems, /data-testid="my-work-project-section"/);
  assert.match(workItems, /data-testid="gantt-project-section"/);
  assert.match(memory, /groupBy: projectId \? "hierarchy" : "project"/);
  assert.match(memory, /groupBy: projectId \? asGroup\(value\.groupBy, fallback\.groupBy\) : "project"/);
});

test("Notion Filter and Sort open real panels in WorkItemsCenter", () => {
  assert.match(surfaces, /data-testid="notion-filter-button"/);
  assert.match(surfaces, /data-testid="notion-sort-button"/);
  assert.match(surfaces, /notionFilterOpen=\{notionFilterOpen\}/);
  assert.match(surfaces, /notionSortOpen=\{notionSortOpen\}/);
  assert.match(surfaces, /onNotionFilterOpenChange=\{setNotionFilterOpen\}/);
  assert.match(surfaces, /onNotionSortOpenChange=\{setNotionSortOpen\}/);
  assert.match(workItems, /data-testid="notion-tools-panel"/);
  assert.match(workItems, /data-testid="items-filter-popover"/);
  assert.match(workItems, /data-testid="items-sort-popover"/);
});
