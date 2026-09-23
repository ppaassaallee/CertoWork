import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("projects list wires ViewGrid selection into portfolio bulk actions", () => {
  const surfaces = readFileSync(
    resolve("src/components/ProjectSurfaces.tsx"),
    "utf8",
  );
  const projectsSurface = readFileSync(
    resolve("src/features/views/ProjectsViewsSurface.tsx"),
    "utf8",
  );
  const viewGrid = readFileSync(resolve("src/features/views/ViewGrid.tsx"), "utf8");

  assert.match(viewGrid, /selectedIds\?:/);
  assert.match(viewGrid, /onSelectionChange\?/);
  assert.match(viewGrid, /commitSelection/);
  assert.match(projectsSurface, /selectedIds=\{selectedIds\}/);
  assert.match(projectsSurface, /onSelectionChange=\{onSelectionChange\}/);
  assert.match(surfaces, /selectedIds=\{selectedProjectIds\}/);
  assert.match(surfaces, /onSelectionChange=\{setSelectedProjectIds\}/);
  assert.match(surfaces, /data-testid="project-bulk-actions"/);
  assert.match(surfaces, /label === "Archive"/);
});
