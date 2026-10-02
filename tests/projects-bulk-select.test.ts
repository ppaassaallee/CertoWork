import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("projects list wires Asana selection into portfolio bulk actions", () => {
  const surfaces = readFileSync(
    resolve("src/components/ProjectSurfaces.tsx"),
    "utf8",
  );
  const projectsSurface = readFileSync(
    resolve("src/features/views/ProjectsViewsSurface.tsx"),
    "utf8",
  );

  assert.match(projectsSurface, /selectedIds/);
  assert.match(projectsSurface, /onSelectionChange/);
  assert.match(projectsSurface, /data-testid="projects-row-select"/);
  assert.match(projectsSurface, /data-testid="projects-select-all-header"/);
  assert.match(projectsSurface, /data-testid="projects-asana-list"/);
  assert.match(projectsSurface, /event\.stopPropagation\(\);\s*toggleOne\(id\)/);
  assert.match(surfaces, /selectedIds=\{selectedProjectIds\}/);
  assert.match(surfaces, /onSelectionChange=\{setSelectedProjectIds\}/);
  assert.match(surfaces, /data-testid="project-bulk-actions"/);
  assert.match(surfaces, /label === "Archive"/);
  assert.match(surfaces, /initialPortfolioView \|\| "dashboard"/);
});
