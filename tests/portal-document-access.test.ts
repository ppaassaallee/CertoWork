import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
// Functions is a CommonJS package; use its actual module boundary under tsx/Node.
const { isPublishedDocumentPath } = createRequire(import.meta.url)("../functions/src/clientPortal/documentAccess.ts");

test("portal document URLs can only sign objects under the published project", () => {
  assert.equal(isPublishedDocumentPath("project-docs/ws-a/prj-a/file.pdf", "ws-a", "prj-a"), true);
  assert.equal(isPublishedDocumentPath("project-docs/ws-b/prj-a/file.pdf", "ws-a", "prj-a"), false);
  assert.equal(isPublishedDocumentPath("project-docs/ws-a/prj-b/file.pdf", "ws-a", "prj-a"), false);
  assert.equal(isPublishedDocumentPath("project-docs/ws-a/prj-a/", "ws-a", "prj-a"), false);
  assert.equal(isPublishedDocumentPath("project-docs/ws-a/prj-a/../prj-b/file.pdf", "ws-a", "prj-a"), false);
});

test("portal download signs the stored source path and checks active membership", () => {
  const source = readFileSync("functions/src/clientPortal/index.ts", "utf8");
  const download = source.split("export const getPortalDocumentUrl =")[1].split("export const createPortalRequest =")[0];
  assert.match(download, /member\?\.status !== "active"/);
  assert.match(download, /source\.clientFolder !== true/);
  assert.match(download, /String\(source\.storagePath \|\| ""\)/);
  assert.doesNotMatch(download, /request\.data\?\.storagePath/);
});
