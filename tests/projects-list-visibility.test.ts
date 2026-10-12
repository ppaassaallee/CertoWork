import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const surfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
const css = readFileSync(resolve("src/index.css"), "utf8");

test("Projects list starts with a compact toolbar and keeps advanced filters accessible", () => {
  assert.match(surfaces, /useState\(false\);\s*const \[phaseFilter, setPhaseFilter\]/);
  assert.match(surfaces, /data-testid="projects-more-filters"/);
  assert.match(surfaces, /aria-expanded=\{advancedFiltersOpen\}/);
  assert.match(surfaces, /advancedFiltersOpen && \(\s*<div className="do-command-advanced-filters"/);
  assert.match(surfaces, /advancedFiltersOpen && <div className="do-command-subtoolbar"/);
  assert.match(surfaces, /\{sortedFiltered\.length\} project/);
});

test("Hidden filter choices remain removable as visible chips", () => {
  for (const key of ["status-default", "phase-", "tag-", "category-", "product-phase-"]) {
    assert.ok(surfaces.includes(`key: \`${key}`), `${key} must be represented in activeFilterChips`);
  }
  assert.match(surfaces, /data-testid="projects-filter-chips"/);
});

test("Opening a stage from the dashboard clears unrelated previous filters", () => {
  const openListWith = surfaces.slice(
    surfaces.indexOf("const openListWith ="),
    surfaces.indexOf("const submitPortfolioAsk ="),
  );
  for (const reset of [
    'setPhaseFilter("all")',
    'setTagFilter("all")',
    'setWorkCategoryFilter("all")',
    'setProductPhaseFilter("all")',
  ]) {
    assert.ok(openListWith.includes(reset), `${reset} must clear stale dashboard filters`);
  }
});

test("Projects list uses the page scroll instead of a one-row nested scroll", () => {
  assert.match(css, /\.do-command-body-overview\s*\{[^}]*overflow-y: auto;/s);
  assert.match(css, /\.do-command-body-overview > \.do-command-portfolio\s*\{[^}]*flex: none;[^}]*overflow: visible;/s);
  assert.match(css, /\.do-command-body-overview \.cw-views-surface\s*\{[^}]*height: auto;/s);
  assert.match(css, /\.do-command-body-overview \.cw-views-surface\.is-asana-list \.cw-views-body\.is-asana-list\s*\{[^}]*overflow: visible;/s);
});
