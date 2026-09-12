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

test("project console uses a Notion-style table surface, not Tasks + Backlog tabs", () => {
  const consoleSource = readFileSync(
    resolve("src/components/ProjectSurfaces.tsx"),
    "utf8",
  );
  const chromeSource = readFileSync(
    resolve("src/features/projects/chrome/ProjectPageChrome.tsx"),
    "utf8",
  );
  const workspaceSource = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );

  assert.match(consoleSource, /data-testid="project-items"/);
  assert.match(consoleSource, /notionSurface/);
  assert.match(consoleSource, /<ProjectPageHeader/);
  assert.match(consoleSource, /<ProjectViewTabs/);
  assert.match(chromeSource, /aria-label="Project views"/);
  assert.match(chromeSource, /label: "Tabla"/);
  assert.match(chromeSource, /label: "Tablero"/);
  assert.match(chromeSource, /label: "Gantt"/);
  assert.match(chromeSource, /label: "Calendario"/);
  assert.match(chromeSource, /label: "Docs"/);
  assert.doesNotMatch(consoleSource, /\["backlog", "Backlog"\]/);
  assert.match(consoleSource, /Overview/);
  assert.match(consoleSource, /Volver a la tabla/);

  // Dual Overview/Notes/Strategy chrome is gone — the project page is the table.
  assert.doesNotMatch(
    workspaceSource,
    /aria-label="Project views"[\s\S]*?>\s*Overview\s*</,
  );
  assert.doesNotMatch(workspaceSource, />\s*Tasks\s*</);
});
