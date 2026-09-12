import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const surfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
const portfolio = readFileSync(resolve("src/lib/projectPortfolio.ts"), "utf8");
const css = readFileSync(resolve("src/index.css"), "utf8");

test("Projects home filters out past checkpoints and uses one attention definition", () => {
  assert.match(portfolio, /date >= today/);
  assert.match(portfolio, /export function projectNeedsAttention/);
  assert.match(surfaces, /projectNeedsAttention\(/);
  assert.match(surfaces, /allAttention\.length/);
  assert.doesNotMatch(
    surfaces.slice(surfaces.indexOf("do-command-metrics"), surfaces.indexOf("do-command-body")),
    /realProjects\.filter\(\s*\(project\) =>\s*projectHealth/,
  );
});

test("Projects home hides empty investment KPI and warns at capacity hours", () => {
  assert.match(surfaces, /totals\.initial > 0/);
  assert.match(surfaces, /totals\.recurring > 0/);
  assert.match(surfaces, /hoursAtCapacity/);
  assert.doesNotMatch(surfaces, /Add costs/);
});

test("Projects home drops marketing chrome and portfolio access banner", () => {
  assert.doesNotMatch(surfaces, /DELIVERY CONTROL TOWER/);
  assert.doesNotMatch(surfaces, /Project command center/);
  assert.match(surfaces, /<h1>Projects<\/h1>/);
  assert.doesNotMatch(workspace, /pure-ai-grant-followers-portfolio/);
  assert.doesNotMatch(surfaces, /aria-label="Close command center"/);
});

test("Projects home puts attention first and asks via compact input", () => {
  const dashboard = surfaces.slice(
    surfaces.indexOf("do-portfolio-dashboard"),
    surfaces.indexOf("do-command-portfolio"),
  );
  assert.ok(dashboard.indexOf("Needs your attention") < dashboard.indexOf("do-pm-ask-bar"));
  assert.ok(dashboard.indexOf("do-pm-ask-bar") < dashboard.indexOf("By stage"));
  assert.match(surfaces, /data-testid="projects-ask-bar"/);
  assert.match(surfaces, /data-testid="projects-ask-panel"/);
  assert.doesNotMatch(surfaces, /CERTO FOR PROJECT MANAGERS/);
});

test("Projects KPIs and health chips open the list with removable filters", () => {
  assert.match(surfaces, /openListWith\(\{ healthFilter: "needs_attention" \}\)/);
  assert.match(surfaces, /openListWith\(\{ stageFilter: stage \}\)/);
  assert.match(surfaces, /data-testid="projects-filter-chips"/);
  assert.match(surfaces, /primarySort: "hours_variance"/);
  assert.match(css, /\.do-command-metrics\.is-text-row/);
});
