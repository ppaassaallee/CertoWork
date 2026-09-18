import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workItems = readFileSync(new URL("../src/components/WorkItemsCenter.tsx", import.meta.url), "utf8");
const surfaces = readFileSync(new URL("../src/components/ProjectSurfaces.tsx", import.meta.url), "utf8");
const projectItemsSurface = readFileSync(
  new URL("../src/features/views/ProjectItemsViewsSurface.tsx", import.meta.url),
  "utf8",
);
const chrome = readFileSync(
  new URL("../src/features/projects/chrome/ProjectPageChrome.tsx", import.meta.url),
  "utf8",
);
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

test("Project Items Asana hybrid keeps Filter/Sort in WorkItemsCenter toolbar", () => {
  // Project Items use ViewsBar + Asana WorkItemsCenter (not NotionProjectTable).
  assert.match(surfaces, /ProjectItemsViewsSurface/);
  assert.match(surfaces, /listBody=\{/);
  assert.match(projectItemsSurface, /WorkItemsCenter/);
  assert.match(projectItemsSurface, /project-items-asana-list/);
  assert.doesNotMatch(projectItemsSurface, /notionSurface/);
  // Chrome still exposes Filter/Sort affordances; list body uses WIC's own panels.
  assert.match(chrome, /data-testid="notion-filter-button"/);
  assert.match(chrome, /data-testid="notion-sort-button"/);
  assert.match(workItems, /data-testid="items-filter-popover"/);
  assert.match(workItems, /data-testid="items-sort-popover"/);
});
