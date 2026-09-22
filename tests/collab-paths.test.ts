import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COLLAB_PATH,
  collabProjectIdFromLocation,
  collabProjectPath,
  isCollabPath,
  projectRoomName,
} from "../src/lib/collab/paths.ts";

test("collab path helpers", () => {
  assert.equal(COLLAB_PATH, "/collab");
  assert.equal(isCollabPath("/collab"), true);
  assert.equal(isCollabPath("/collab/projects/p1"), true);
  assert.equal(isCollabPath("/home"), false);
  assert.equal(collabProjectPath("p1"), "/collab/projects/p1");
  assert.equal(collabProjectIdFromLocation("/collab/projects/abc"), "abc");
  assert.equal(collabProjectIdFromLocation("/collab", "?project=xyz"), "xyz");
  assert.equal(projectRoomName("Atlas"), "Room · Atlas");
});

test("Chatwoot integration is fully removed", () => {
  const removed = readFileSync(resolve("docs/collab/REMOVED.md"), "utf8");
  assert.match(removed, /ChatCollabModule/);
  assert.match(removed, /worker\/collab\.js/);
  assert.match(removed, /CHATWOOT_URL/);
  const worker = readFileSync(resolve("worker/index.js"), "utf8");
  assert.doesNotMatch(worker, /proxyChatwoot|isChatwootProxyPath|CHATWOOT_/);
  assert.doesNotMatch(worker, /\/api\/collab\/sso/);
  const shell = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(shell, /CollabArea/);
  assert.doesNotMatch(shell, /ChatCollabModule|ProductSwitcher|warmCollabSession/);
  assert.doesNotMatch(shell, /collabClient|collabModule/);
});
