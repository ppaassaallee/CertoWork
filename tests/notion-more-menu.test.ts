import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const surfaces = readFileSync(new URL("../src/components/ProjectSurfaces.tsx", import.meta.url), "utf8");
const chrome = readFileSync(
  new URL("../src/features/projects/chrome/ProjectPageChrome.tsx", import.meta.url),
  "utf8",
);

test("Notion more menu is a full-width dropdown in the project header", () => {
  assert.match(css, /\.do-project-page-header \.do-console-more-menu \{/);
  assert.match(css, /\.do-project-page-header \.do-console-more-menu button \{/);
  assert.match(css, /width: 220px/);
  assert.match(surfaces, /data-testid="notion-more-menu"/);
  assert.match(chrome, /data-testid="notion-more-button"/);
  assert.doesNotMatch(surfaces, /do-account-menu do-console-more-menu/);
});
