import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesProjectContents } from "../src/lib/projectContents";

const items = [{ workItemType: "epic" }, { workItemType: "feature" }, { workItemType: "pbi", status: "done" }];
test("empty content excludes deleted but counts completed items", () => {
  assert.equal(matchesProjectContents([], { mode: "empty", kinds: [] }), true);
  assert.equal(matchesProjectContents([{ status: "deleted" }], { mode: "empty", kinds: [] }), true);
  assert.equal(matchesProjectContents(items, { mode: "empty", kinds: [] }), false);
});
test("exact content combinations exclude PBIs even when completed", () => {
  assert.equal(matchesProjectContents(items, { mode: "only", kinds: ["epic", "feature"] }), false);
  assert.equal(matchesProjectContents(items.slice(0, 2), { mode: "only", kinds: ["epic", "feature"] }), true);
  assert.equal(matchesProjectContents(items.slice(0, 1), { mode: "only", kinds: ["epic", "feature"] }), false);
  assert.equal(matchesProjectContents(items, { mode: "includes", kinds: ["epic", "feature"] }), true);
  assert.equal(matchesProjectContents(items, { mode: "excludes", kinds: ["pbi"] }), false);
});

test("project deletion fetches all scoped items and deletes parent last", () => {
  const source = readFileSync(new URL("../src/components/DelivereeWorkspace.tsx", import.meta.url), "utf8");
  const cascade = source.slice(source.indexOf("const deleteProjectItemsAndRecord"), source.indexOf("const permanentlyDeleteProjects"));
  assert.match(cascade, /where\("workspaceId", "==", workspace.id\)/);
  assert.match(cascade, /where\("projectId", "==", projectId\)/);
  assert.doesNotMatch(cascade, /openTasks|where\("status"/);
  assert.ok(cascade.indexOf("await batch.commit()") < cascade.indexOf('await deleteDoc(doc(db, "projects"'));
});
