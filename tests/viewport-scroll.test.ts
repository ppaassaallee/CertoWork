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

test("landing is a bounded scrollport so phones can scroll the page", () => {
  const css = readFileSync(resolve("src/styles/landing.css"), "utf8");
  const app = readFileSync(resolve("src/App.tsx"), "utf8");
  const html = readFileSync(resolve("index.html"), "utf8");
  const firstRule = css.match(/\.do-signin\s*\{[^}]+\}/)?.[0] || "";
  assert.match(firstRule, /max-height:\s*100dvh/);
  assert.match(firstRule, /overflow-y:\s*auto/);
  assert.match(firstRule, /height:\s*100%/);
  assert.doesNotMatch(firstRule, /overflow:\s*hidden/);
  assert.match(css, /\.do-signin-bg\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /\.do-signin-vignette\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.do-signin-hero\s*\{[\s\S]*display:\s*block/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*min-height:\s*44px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(app, /do-signin-nav-extra/);
  assert.match(html, /viewport-fit=cover/);
});
