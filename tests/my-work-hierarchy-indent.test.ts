import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hierarchyChildren, hierarchyRoots } from "../src/lib/itemHierarchy";

const workItems = readFileSync(new URL("../src/components/WorkItemsCenter.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("standalone items of every kind remain roots while linked items nest", () => {
  const epic = { id: "epic", workItemType: "epic" };
  const feature = { id: "feature", workItemType: "feature", parentId: "epic" };
  const pbi = { id: "pbi", workItemType: "pbi" };
  const task = { id: "task", workItemType: "task", parentId: "feature" };
  const standaloneFeature = { id: "standalone-feature", workItemType: "feature" };
  const standaloneTask = { id: "standalone-task", workItemType: "task" };
  const items = [epic, feature, pbi, task, standaloneFeature, standaloneTask];

  assert.deepEqual(hierarchyRoots(items).map((item) => item.id), ["epic", "pbi", "standalone-feature", "standalone-task"]);
  assert.deepEqual(hierarchyChildren(items, "epic").map((item) => item.id), ["feature"]);
  assert.deepEqual(hierarchyChildren(items, "feature").map((item) => item.id), ["task"]);
});

test("the visual tree indents once per real parent link, not by item type", () => {
  assert.match(workItems, /paddingLeft: tree\.depth \* 24/);
  assert.match(workItems, /className=\{`do-items-title\$\{tree\?\.depth \? " is-nested" : ""\}`\}/);
  assert.doesNotMatch(workItems, /rootContext/);
  assert.match(styles.match(/\.do-items-children \{[^}]+\}/)?.[0] || "", /padding: 0;/);
  assert.match(styles.match(/\.do-items-section-head\.do-items-row\.is-icon-list \{[^}]+\}/)?.[0] || "", /gap: 4px;/);
  assert.match(styles, /\.do-items-title\.is-nested::before \{/);
});
