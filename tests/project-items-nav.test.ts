import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes.ts";

test("project /tasks route stays a project lens (items live in the console)", () => {
  const lens = resolveDelivereeLens("/work/projects/abc/tasks");
  assert.deepEqual(lens, {
    kind: "project",
    projectId: "abc",
    tab: "tasks",
  });
});

test("project console exposes one Items tab, not a separate Tasks + Backlog pair", () => {
  const consoleSource = readFileSync(
    resolve("src/components/ProjectSurfaces.tsx"),
    "utf8",
  );
  const workspaceSource = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );

  const tabsMatch = consoleSource.match(
    /aria-label="Project console sections"[\s\S]*?<\/nav>/,
  );
  assert.ok(tabsMatch, "console tabs nav missing");
  assert.match(tabsMatch[0], /\["items", "Items"\]/);
  assert.doesNotMatch(tabsMatch[0], /\["backlog", "Backlog"\]/);
  assert.match(consoleSource, /data-testid="project-items"/);

  const viewsMatch = workspaceSource.match(
    /aria-label="Project views"[\s\S]*?<\/div>\s*<\/section>/,
  );
  assert.ok(viewsMatch, "project views switch missing");
  assert.doesNotMatch(viewsMatch[0], />\s*Tasks\s*</);
  assert.match(viewsMatch[0], />\s*Overview\s*</);
});
