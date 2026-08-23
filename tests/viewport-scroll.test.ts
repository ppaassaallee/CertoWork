import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("app shell locks to the viewport and allows pane scrolling", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(css, /\.do-shell\s*\{[^}]*max-height:\s*100dvh/s);
  assert.match(css, /\.do-sidebar\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.do-main\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.do-sidebar-scroll\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.do-thread-viewport\s*\{[^}]*overflow-y:\s*auto/s);
});
