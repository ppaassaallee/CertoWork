import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const surfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
const delivery = readFileSync(resolve("src/lib/projectDelivery.ts"), "utf8");

test("new wizard and magic projects start in Define with a work key", () => {
  assert.match(workspace, /deliveryStage: "define"/);
  assert.match(workspace, /deliveryPhase: "intake"/);
  assert.match(workspace, /projectKey: projectWorkKey\(/);
  assert.match(workspace, /createProjectFromWizard/);
  assert.match(workspace, /createMagicProject/);
});

test("portfolio search and command palette include derived work keys like GWL", () => {
  assert.match(surfaces, /projectWorkKey\(project\)/);
  assert.match(workspace, /projectWorkKey\(project\)/);
  assert.doesNotMatch(
    surfaces,
    /statusFilters\.length === 0 && filter === value/,
  );
  assert.match(surfaces, /Status: \$\{projectStatusLabel\(value\)\}/);
});

test("missing delivery stage defaults to Define instead of Build", () => {
  assert.match(delivery, /return inferred \|\| "define"/);
  assert.match(delivery, /normalized === "planning"/);
});
