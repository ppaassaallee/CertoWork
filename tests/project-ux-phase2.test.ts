import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const table = readFileSync(new URL("../src/components/NotionProjectTable.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("phase 2 densifies Notion table with sprint groups and hierarchy indent", () => {
  assert.match(table, /do-notion-group-head/);
  assert.match(table, /data-depth/);
  assert.match(table, /do-notion-kind/);
  assert.match(table, /do-notion-avatar/);
  assert.match(table, /header: "Name"/);
  assert.match(table, /header: "Status"/);
  assert.match(css, /\.do-notion-table thead th \{[\s\S]*?position: sticky/);
  assert.match(css, /\.do-notion-table td \{[\s\S]*?height: 40px/);
  assert.match(css, /\.do-notion-title-cell\[data-depth="1"\]/);
  assert.match(css, /\.do-notion-num \{[\s\S]*?tabular-nums/);
});
