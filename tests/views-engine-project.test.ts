import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("views engine flag and project items use Asana hybrid surface", () => {
  const example = readFileSync(resolve(".env.example"), "utf8");
  const flag = readFileSync(
    resolve("src/features/views/viewsEngineFlag.ts"),
    "utf8",
  );
  const surfaces = readFileSync(
    resolve("src/components/ProjectSurfaces.tsx"),
    "utf8",
  );
  const projectItemsSurface = readFileSync(
    resolve("src/features/views/ProjectItemsViewsSurface.tsx"),
    "utf8",
  );
  const adapter = readFileSync(
    resolve("src/features/views/adapters/taskAdapter.ts"),
    "utf8",
  );
  assert.match(example, /VITE_VIEWS_ENGINE=0/);
  assert.match(flag, /VITE_VIEWS_ENGINE/);
  assert.match(flag, /isViewsEngineEnabled/);
  assert.match(surfaces, /ProjectItemsViewsSurface/);
  assert.match(surfaces, /data-testid="project-items"/);
  assert.match(surfaces, /listBody=\{/);
  assert.doesNotMatch(surfaces, /viewsEngineOn && notionMode === "list"/);
  assert.match(projectItemsSurface, /WorkItemsCenter/);
  assert.match(projectItemsSurface, /applyView/);
  assert.match(projectItemsSurface, /project-items-asana-list/);
  assert.doesNotMatch(projectItemsSurface, /from ["'].\/ViewGrid["']/);
  assert.doesNotMatch(projectItemsSurface, /<ViewGrid[\s>]/);
  assert.match(adapter, /groupBy: isProject \? "epic" : null/);
  assert.match(adapter, /showSubtasks: true/);
});
