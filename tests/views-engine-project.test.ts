import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("views engine flag and project items surface are gated", () => {
  const example = readFileSync(resolve(".env.example"), "utf8");
  const flag = readFileSync(
    resolve("src/features/views/viewsEngineFlag.ts"),
    "utf8",
  );
  const surfaces = readFileSync(
    resolve("src/components/ProjectSurfaces.tsx"),
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
  assert.match(surfaces, /viewsEngineOn && notionMode === "list"/);
  assert.match(surfaces, /data-testid="project-items"/);
  assert.match(adapter, /groupBy: isProject \? "epic" : null/);
  assert.match(adapter, /showSubtasks: true/);
});
