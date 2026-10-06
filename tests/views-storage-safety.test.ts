import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storage = readFileSync(new URL("../src/lib/views/storage.ts", import.meta.url), "utf8");
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

test("saved views are queried within Firestore's personal/team read rules", () => {
  assert.match(storage, /where\("workspaceId", "==", workspaceId\), where\("scope", "==", "team"\)/);
  assert.match(storage, /where\("workspaceId", "==", workspaceId\), where\("ownerId", "==", userId\)/);
  assert.doesNotMatch(storage, /where\("surface", "==", surface\)/);
});

test("optional view fields are omitted rather than sent as undefined to Firestore", () => {
  assert.match(storage, /input\.icon !== undefined \? \{ icon: input\.icon \}/);
  assert.match(storage, /input\.showSubtasks !== undefined \? \{ showSubtasks: input\.showSubtasks \}/);
  assert.match(storage, /filter\(\(\[, value\]\) => value !== undefined\)/);
});

test("workspace owners without a membership row can manage their saved views", () => {
  const savedViews = rules.slice(rules.indexOf("match /saved_views/{id}"), rules.indexOf("match /dayPlans/{planId}"));
  assert.match(savedViews, /isWorkspaceMember\(resource\.data\.workspaceId\) \|\| isWorkspaceOwner\(resource\.data\.workspaceId\)/);
  assert.match(savedViews, /isWorkspaceMember\(incoming\(\)\.workspaceId\) \|\| isWorkspaceOwner\(incoming\(\)\.workspaceId\)/);
});
