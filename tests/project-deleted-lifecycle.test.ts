import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isClosed } from "../src/lib/workspaceDisplay";
import { isProjectClosed } from "../src/lib/projectPortfolio";

test("deleted projects count as closed in shared filters", () => {
  assert.equal(isClosed("deleted"), true);
  assert.equal(isProjectClosed({ status: "deleted" }), true);
  assert.equal(isClosed("active"), false);
});

test("workspace exposes permanent delete for soft-deleted projects", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(workspace, /const permanentlyDeleteProject = async/);
  assert.match(workspace, /Delete forever/);
  assert.match(workspace, /batch\.delete\(doc\(db, "projects", project\.id\)\)/);
  assert.match(
    workspace,
    /is in Deleted\. Restore it before adding items/,
  );
});

test("project console shows restore + delete forever for deleted projects", () => {
  const surfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
  assert.match(surfaces, /project-deleted-banner/);
  assert.match(surfaces, /Delete forever/);
  assert.match(surfaces, /onPermanentlyDeleteProject/);
  assert.match(surfaces, /"deleted"/);
  assert.match(surfaces, /\["planning", "active", "paused", "completed", "archived", "deleted"\]/);
});

test("notion table can disable create while project is deleted", () => {
  const table = readFileSync(resolve("src/components/NotionProjectTable.tsx"), "utf8");
  const center = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");
  assert.match(table, /createDisabled/);
  assert.match(table, /do-notion-add-disabled/);
  assert.match(center, /projectCreateBlocked/);
  assert.match(center, /createDisabled=\{projectCreateBlocked\}/);
});
