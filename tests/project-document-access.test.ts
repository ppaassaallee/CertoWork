import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectDocumentSaveError } from "../src/lib/projectResources";

test("document errors distinguish file storage, metadata permissions and session expiry", () => {
  const error = (code: string) => Object.assign(new Error("Service failure"), { code });
  assert.match(projectDocumentSaveError(error("permission-denied"), "metadata"), /document record.*permission-denied/);
  assert.match(projectDocumentSaveError(error("storage\/unauthorized"), "upload"), /File storage denied/);
  assert.match(projectDocumentSaveError(error("storage\/unauthenticated"), "upload"), /session has expired/);
  assert.match(projectDocumentSaveError(error("storage\/quota-exceeded"), "upload"), /quota was exceeded/);
  assert.match(projectDocumentSaveError(error("unavailable"), "metadata"), /metadata: unavailable/);
});

test("project documents use the workspace access contract but personal knowledge remains private", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const read = rules.slice(rules.indexOf("function canReadKnowledgeItem"), rules.indexOf("match /knowledge_items"));
  assert.match(read, /data.userId == request.auth.uid/);
  assert.match(read, /data.projectId.size\(\) > 0/);
  assert.match(read, /canCreateWorkspaceRecord\(data.workspaceId\)/);
  const create = rules.slice(rules.indexOf("match /knowledge_items"), rules.indexOf("match /knowledge_folders"));
  assert.match(create, /incoming\(\).userId == request.auth.uid/);
  assert.match(create, /canCreateWorkspaceRecord\(incoming\(\).workspaceId\)/);
  assert.doesNotMatch(create, /allow create: if isSignedIn\(\);/);
});
