import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("timeline task editor is docked without replacing the timeline", () => {
  const source = read("src/components/WorkItemsCenter.tsx");
  assert.match(source, /mode === "gantt" \? editor : createPortal\(editor, document.body\)/);
  assert.match(source, /docked=\{mode === "gantt"\}/);
  assert.match(source, /layout=\{mode === "gantt" \? "panel" : undefined\}/);
  assert.match(source, /selectedItemId=\{selectedItemId\}/);
  assert.match(source, /!isItemModalV2Enabled\(\) && mode !== "gantt"/);
});

test("docked editor keeps the calendar clickable and all properties scrollable", () => {
  const source = read("src/features/items/ItemModal/ItemModal.tsx");
  const css = read("src/features/items/ItemModal/ItemModal.css");
  assert.match(source, /onClick=\{docked && layout === "panel" \? undefined : onClose\}/);
  assert.match(source, /aria-modal=\{!\(docked && layout === "panel"\)\}/);
  assert.match(css, /\.cw-item-modal-backdrop\.is-docked::before \{ display: none; \}/);
  assert.match(css, /\.is-docked \.cw-item-props \{ flex-shrink: 0; overflow: visible; \}/);
  assert.match(read("src/index.css"), /@media \(max-width: 900px\)/);
});
