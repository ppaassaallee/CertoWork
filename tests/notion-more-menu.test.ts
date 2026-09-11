import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const surfaces = readFileSync(new URL("../src/components/ProjectSurfaces.tsx", import.meta.url), "utf8");

test("Notion more menu is a full-width dropdown, not icon-sized buttons", () => {
  assert.match(css, /\.do-notion-top > button,\s*\n\.do-notion-top \.do-console-more > button \{/);
  assert.match(css, /\.do-notion-top \.do-console-more-menu button \{/);
  assert.match(css, /width: 100%/);
  assert.match(css, /\.do-notion-top \.do-console-more-menu \{[\s\S]*?width: 220px/);
  assert.doesNotMatch(css, /\.do-notion-top button \{/);
  assert.match(surfaces, /data-testid="notion-more-menu"/);
  assert.match(surfaces, /className="do-console-more-menu"/);
  assert.doesNotMatch(surfaces, /do-account-menu do-console-more-menu/);
});
