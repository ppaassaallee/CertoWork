import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

test("DunTasks system tokens include hues, ai-glow, and black primary", () => {
  const tokens = read("src/styles/certo-tokens.css");
  for (const key of [
    "--btn-primary-bg",
    "--radius-btn",
    "--ai-glow",
    "--hue-blue",
    "--hue-blue-soft",
    "--hue-purple",
    "--hue-gray-soft",
  ]) {
    assert.match(tokens, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(tokens, /\.cw-kbd/);
  assert.match(tokens, /\.cw-destructive/);
  assert.match(tokens, /\.cw-media/);
  assert.match(tokens, /\.cw-semantic-chip/);
  assert.match(tokens, /\.cw-btn-primary \{[\s\S]*var\(--btn-primary-bg\)/);
});

test("system UI primitives exist", () => {
  assert.match(read("src/components/ui/Kbd.tsx"), /export function Kbd/);
  assert.match(
    read("src/components/ui/DestructiveDialog.tsx"),
    /data-testid="destructive-dialog"/,
  );
  assert.doesNotMatch(
    read("src/components/ui/DestructiveDialog.tsx"),
    /estás seguro|are you sure/i,
  );
  assert.match(read("src/components/ui/MediaPicker.tsx"), /data-testid="media-picker"/);
  assert.match(read("src/components/ui/EmptyState.tsx"), /schematic/);
});

test("CommandPalette v2 has scope, create-empty, and footer shortcuts", () => {
  const source = read("src/components/CommandPalette.tsx");
  assert.match(source, /scopeLabel/);
  assert.match(source, /onCreateItem/);
  assert.match(source, /onCreateProject/);
  assert.match(source, /Create item/);
  assert.match(source, /do-cmdk-footer/);
  assert.match(source, /Kbd/);
});

test("critical destructive flows no longer use window.confirm", () => {
  const source = read("src/components/DelivereeWorkspace.tsx");
  assert.match(source, /DestructiveDialog/);
  assert.match(source, /setDestructiveDialog/);
  assert.doesNotMatch(
    source,
    /window\.confirm\(\s*`Move "\$\{entityTitle\(project\)\}"/,
  );
  assert.doesNotMatch(
    source,
    /window\.confirm\(`Remove \$\{label\} from this workspace\?`\)/,
  );
  assert.doesNotMatch(
    source,
    /window\.confirm\(\s*`Delete all \$\{projectCount\} Pure AI projects/,
  );
});
