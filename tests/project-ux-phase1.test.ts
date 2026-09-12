import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { projectDateRangeLabel, projectKpis } from "../src/features/projects/chrome/ProjectPageChrome";

const surfaces = readFileSync(new URL("../src/components/ProjectSurfaces.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const chrome = readFileSync(
  new URL("../src/features/projects/chrome/ProjectPageChrome.tsx", import.meta.url),
  "utf8",
);

test("phase 1 mounts one project header and one view-tab row", () => {
  assert.match(surfaces, /<ProjectPageHeader/);
  assert.match(surfaces, /<ProjectViewTabs/);
  assert.match(chrome, /data-testid="project-page-header"/);
  assert.match(chrome, /data-testid="project-page-tabs"/);
  assert.doesNotMatch(surfaces, /className="do-notion-top"/);
  assert.doesNotMatch(surfaces, /className="do-notion-title"/);
  assert.doesNotMatch(surfaces, /className="do-notion-views"/);
  assert.match(css, /\.do-project-page-header \{/);
  assert.match(css, /\.do-project-page-tabs \{/);
  assert.match(css, /min-height: 72px/);
  assert.match(css, /height: 44px/);
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

test("project date range uses earliest and latest dated fields", () => {
  assert.equal(
    projectDateRangeLabel(
      { startDate: "2026-09-01", targetDate: "2026-10-24" },
      [{ dueDate: "2026-09-15" }],
    ),
    "Sep 1, 2026 – Oct 24, 2026",
  );
});
