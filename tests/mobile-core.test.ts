import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isMobileCoreViewport,
  mobileCoreFallbackPath,
  mobileCoreTab,
} from "../src/lib/mobileCore";

test("mobile core keeps Home, My Work, Projects, and Notes", () => {
  assert.equal(isMobileCoreViewport(390), true);
  assert.equal(isMobileCoreViewport(1280), false);
  assert.equal(mobileCoreTab("/home"), "home");
  assert.equal(mobileCoreTab("/my-work"), "my-work");
  assert.equal(mobileCoreTab("/projects"), "projects");
  assert.equal(mobileCoreTab("/work/projects/abc/notes"), "notes");
});

test("mobile core sends power surfaces back to Home", () => {
  assert.equal(mobileCoreFallbackPath("/agents"), "/home");
  assert.equal(mobileCoreFallbackPath("/approvals"), "/home");
  assert.equal(mobileCoreFallbackPath("/feedback"), "/home");
  assert.equal(mobileCoreFallbackPath("/workspace"), "/home");
  assert.equal(mobileCoreFallbackPath("/settings"), "/home");
  assert.equal(mobileCoreFallbackPath("/more/warroom"), "/home");
  assert.equal(mobileCoreFallbackPath("/work/projects/abc/strategy"), "/work/projects/abc");
  assert.equal(mobileCoreFallbackPath("/my-work"), null);
  assert.equal(mobileCoreFallbackPath("/work/projects/abc"), null);
});

test("mobile core hides advanced chrome in the live shell", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const items = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");
  assert.match(css, /\.do-shell\.is-mobile-core \.do-mobile-advanced/);
  assert.match(css, /\.do-mobile-dock/);
  assert.match(workspace, /do-mobile-dock/);
  assert.match(workspace, /useMobileCore/);
  assert.match(workspace, /mobileCoreFallbackPath/);
  assert.match(workspace, /mobileIds/);
  assert.match(items, /do-mobile-advanced/);
  assert.match(items, /\["title", "status", "priority", "due"\]/);
});
