import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  projectDateRangeLabel,
  projectDisplayName,
  projectKpis,
  projectSummaryStats,
} from "../src/features/projects/chrome/ProjectPageChrome";

const surfaces = readFileSync(new URL("../src/components/ProjectSurfaces.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const chrome = readFileSync(
  new URL("../src/features/projects/chrome/ProjectPageChrome.tsx", import.meta.url),
  "utf8",
);
const table = readFileSync(new URL("../src/components/NotionProjectTable.tsx", import.meta.url), "utf8");

test("cockpit mounts header, summary strip, and view tabs", () => {
  assert.match(surfaces, /<ProjectPageHeader/);
  assert.match(surfaces, /<ProjectSummaryStrip/);
  assert.match(surfaces, /<ProjectViewTabs/);
  assert.match(chrome, /data-testid="project-page-header"/);
  assert.match(chrome, /data-testid="project-summary-strip"/);
  assert.match(chrome, /data-testid="project-page-tabs"/);
  assert.doesNotMatch(surfaces, /className="do-notion-top"/);
  assert.match(css, /\.do-project-page-header \{/);
  assert.match(css, /height: 64px/);
  assert.match(css, /\.do-project-summary-strip/);
});

test("header no longer shows Open / In progress / Done KPIs", () => {
  const headerFn = chrome.slice(
    chrome.indexOf("export function ProjectPageHeader"),
    chrome.indexOf("export function ProjectSummaryStrip"),
  );
  assert.doesNotMatch(headerFn, />Open</);
  assert.doesNotMatch(headerFn, />In progress</);
  assert.doesNotMatch(headerFn, />Done</);
  assert.doesNotMatch(headerFn, /do-project-page-meta/);
});

test("project display name strips trailing key badge text", () => {
  assert.equal(
    projectDisplayName({
      title: "RPA Reporting Services Allied Global 2026 (ALLIED-GLOBAL-REPORTING-SERVICES-RPA-70)",
      projectKey: "ALLIED-GLOBAL-REPORTING-SERVICES-RPA-70",
    }),
    "RPA Reporting Services Allied Global 2026",
  );
});

test("project KPIs split open / in progress / done", () => {
  const kpis = projectKpis([
    { status: "backlog" },
    { status: "todo" },
    { status: "in_progress" },
    { status: "blocked" },
    { status: "done" },
    { status: "completed" },
  ]);
  assert.deepEqual(kpis, { open: 2, inProgress: 2, done: 2 });
});

test("summary strip rolls up items and hours", () => {
  const stats = projectSummaryStats(
    { dueDate: "2026-10-24", projectManager: "Rafael" },
    [
      { status: "done", estimateHours: 10, loggedHours: 8 },
      { status: "blocked", estimateHours: 4, loggedHours: 1 },
      { status: "todo", estimateHours: 6 },
    ],
  );
  assert.equal(stats.owner, "Rafael");
  assert.equal(stats.itemCount, 3);
  assert.equal(stats.blockedCount, 1);
  assert.match(stats.hoursLabel, /9 \/ 20 h/);
});

test("project date range uses earliest and latest dated fields", () => {
  assert.equal(
    projectDateRangeLabel(
      { startDate: "2026-09-01", targetDate: "2026-10-24" },
      [{ dueDate: "2026-09-15" }],
    ),
    "Sep 1, 2026 – Oct 24, 2026",
  );
});

test("notion table renders type glyph, hierarchy indent, attrs, and nest drag", () => {
  assert.match(table, /WorkItemTypeGlyph/);
  assert.match(table, /HierarchyChevron/);
  assert.match(table, /HIERARCHY_INDENT_PX/);
  assert.match(table, /depth \* HIERARCHY_INDENT_PX/);
  assert.match(table, /sortHierarchyForest/);
  assert.match(table, /renderAttrs/);
  assert.match(table, /id: "attrs"/);
  assert.match(table, /canNestUnder/);
  assert.match(table, /parentLinkPatch/);
  assert.match(table, /do-notion-drag-handle/);
  assert.match(table, /do-notion-row-attrs/);
});
