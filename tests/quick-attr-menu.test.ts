import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const menu = readFileSync(resolve("src/components/QuickAttrMenu.tsx"), "utf8");
const workItems = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");

test("quick action click opens a portaled single or multi select menu", () => {
  assert.match(menu, /data-testid="quick-attr-menu"/);
  assert.match(menu, /aria-label=\{ariaLabel\}/);
  assert.match(menu, /createPortal/);
  assert.match(menu, /Single select/);
  assert.match(menu, /Multi-select/);
  assert.match(menu, /do-quick-attr-create/);
  assert.match(workItems, /<QuickAttrMenu/);
  assert.match(workItems, /mode=\{column === "tags" \? "multi" : "single"\}/);
  assert.match(workItems, /Create tag/);
  assert.match(workItems, /Add delivery entity/);
  assert.match(workItems, /Add client entity/);
  assert.match(workItems, /Create sprint/);
  assert.match(workItems, /Create project/);
  assert.match(workItems, /Create \$\{workItemLabel\(allowed\[0\]\)\}/);
  assert.match(workItems, /onRenameWorkCategory/);
  assert.match(workItems, /onRenameControlledOption/);
  assert.match(workItems, /Multi-select. The first person stays the owner./);
  assert.match(menu, /Rename \$\{option.label\}/);
  assert.match(workItems, /\.do-quick-attr-menu/);
});
