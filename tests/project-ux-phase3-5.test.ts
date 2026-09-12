import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const surfaces = readFileSync(new URL("../src/components/ProjectSurfaces.tsx", import.meta.url), "utf8");
const workItems = readFileSync(new URL("../src/components/WorkItemsCenter.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const panel = readFileSync(
  new URL("../src/features/projects/panels/ProjectContextPanel.tsx", import.meta.url),
  "utf8",
);

test("phase 3 board cards expose kind, description clamp, and hover actions", () => {
  assert.match(workItems, /is-notion-card/);
  assert.match(workItems, /do-kanban-kind-chip/);
  assert.match(workItems, /do-kanban-card-desc/);
  assert.match(workItems, /do-kanban-col-dot/);
  assert.match(workItems, /Add new task/);
  assert.match(css, /\.do-kanban-card\.is-notion-card:hover/);
});

test("phase 4 mounts a collapsible right context panel", () => {
  assert.match(surfaces, /ProjectContextPanel/);
  assert.match(surfaces, /do-project-items-layout/);
  assert.match(panel, /data-testid="project-context-panel"/);
  assert.match(panel, /Upcoming deadlines/);
  assert.match(panel, /Recent activity/);
  assert.match(css, /\.do-project-context \{[\s\S]*?width: 280px/);
  assert.match(css, /\.cw-toast \{[\s\S]*?bottom: 16px/);
});

test("phase 5 gantt focus hides page chrome and keeps dense rows", () => {
  assert.match(css, /\.do-project-console\.is-gantt-focus \.do-project-page-header/);
  assert.match(css, /\.do-gantt-row \{[\s\S]*?height: 32px/);
  assert.match(css, /\.do-gantt-bar \{[\s\S]*?height: 14px/);
  assert.match(css, /\.do-gantt-focus-bar \{[\s\S]*?height: 40px/);
});
