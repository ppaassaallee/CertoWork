import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

test("Certo Calm Authority tokens define required surfaces and accent", () => {
  const tokens = readFileSync(resolve(root, "src/styles/certo-tokens.css"), "utf8");
  for (const key of [
    "--surface-0",
    "--surface-1",
    "--surface-2",
    "--border",
    "--text-primary",
    "--text-secondary",
    "--text-muted",
    "--accent",
    "--accent-hover",
    "--accent-soft",
    "--status-success",
    "--status-warning",
    "--status-danger",
    "--radius-control",
    "--radius-card",
    "--space-4",
  ]) {
    assert.match(tokens, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(tokens, /\.cw-btn-primary/);
  assert.match(tokens, /Inter/);
});

test("index.css imports the design language tokens", () => {
  const css = readFileSync(resolve(root, "src/index.css"), "utf8");
  assert.match(css, /certo-tokens\.css/);
  assert.match(css, /Calm Authority: accent discipline/);
  assert.equal(css.includes("Manrope"), false);
});

test("project wizard create button stays a primary CTA", () => {
  const css = readFileSync(resolve(root, "src/index.css"), "utf8");
  const secondaryStart = css.indexOf("Calm Authority: accent discipline");
  const primaryStart = css.indexOf(".do-items-create > button:last-child");
  assert.ok(secondaryStart >= 0 && primaryStart > secondaryStart);
  const secondaryBlock = css.slice(secondaryStart, primaryStart);
  assert.equal(secondaryBlock.includes(".do-skill-foot button:last-child"), false);
  assert.match(css, /\.do-skill-foot button\.do-skill-create/);
});

test("header Create menu is anchored to the button, not the main pane bottom", () => {
  const css = readFileSync(resolve(root, "src/index.css"), "utf8");
  const workspace = readFileSync(resolve(root, "src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(css, /\.do-create-menu-list/);
  assert.match(css, /\.do-create-menu-list \{[\s\S]*position:\s*fixed/);
  assert.match(workspace, /do-create-menu-list/);
  assert.match(workspace, /createPortal/);
  assert.doesNotMatch(
    workspace,
    /createMenuOpen && \(\s*<div className="do-account-menu">/,
  );
});

test("DESIGN_LANGUAGE.md documents accent usage rules", () => {
  const doc = readFileSync(resolve(root, "DESIGN_LANGUAGE.md"), "utf8");
  assert.match(doc, /Certo Calm Authority/);
  assert.match(doc, /single primary button/i);
  assert.match(doc, /--accent-soft/);
});
