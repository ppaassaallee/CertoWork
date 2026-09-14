import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const surfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
const css = readFileSync(resolve("src/index.css"), "utf8");
const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");

test("portfolio bulk actions await updates and show feedback", () => {
  assert.match(surfaces, /runBulkProjectAction/);
  assert.match(surfaces, /data-testid="project-bulk-actions"/);
  assert.match(surfaces, /data-testid="project-bulk-feedback"/);
  assert.match(surfaces, /data-testid="project-bulk-add-member"/);
  assert.match(surfaces, /Promise\.allSettled/);
  assert.match(surfaces, /withCollaboratorAccess\(project, grant\)/);
  assert.match(surfaces, /teamMembers/);
  assert.match(surfaces, /onNotice\?\.\(message\)/);
});

test("bulk add member is wired to workspace notice toast", () => {
  assert.match(workspace, /onNotice=\{setNotice\}/);
});

test("portfolio bulk bar and quiet list styles exist", () => {
  assert.match(css, /\.do-command-bulk\s*\{/);
  assert.match(css, /\.do-command-bulk-groups\s*\{/);
  assert.match(css, /\.do-command-bulk-group\s*\{/);
  assert.match(css, /\.do-command-bulk-feedback\s*\{/);
  assert.match(css, /\.do-command-table \.do-project-select[\s\S]*border:\s*0/s);
});
