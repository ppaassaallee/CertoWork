import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isProjectFilePath, legacyStoragePath } from "../functions/src/projectFiles";

test("project file paths remain inside the authorized project prefix", () => {
  assert.equal(isProjectFilePath("project-docs/ws-a/project-a/file", "ws-a", "project-a"), true);
  assert.equal(isProjectFilePath("project-docs/ws-b/project-a/file", "ws-a", "project-a"), false);
  assert.equal(isProjectFilePath("project-docs/ws-a/project-b/file", "ws-a", "project-a"), false);
  assert.equal(isProjectFilePath("project-docs/ws-a/project-a/../project-b/file", "ws-a", "project-a"), false);
});

test("legacy Firebase URLs are parsed only for this Storage bucket", () => {
  const bucket = "example.firebasestorage.app";
  const path = "project-docs/ws-a/project-a/old file.pdf";
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=old`;
  assert.equal(legacyStoragePath(url, bucket), path);
  assert.equal(legacyStoragePath(url, "other.firebasestorage.app"), "");
  assert.equal(legacyStoragePath("https://attacker.example/o/file", bucket), "");
});

test("new project uploads persist paths without Firebase download tokens", () => {
  const workspace = readFileSync("src/components/DelivereeWorkspace.tsx", "utf8");
  const save = workspace.split("const addProjectDocument = async")[1]
    .split("const connectProjectDrive = async")[0];
  assert.match(save, /createProjectFileUpload/);
  assert.match(save, /storagePath = upload\.data\.storagePath/);
  assert.doesNotMatch(save, /getDownloadURL/);
  const project = readFileSync("src/components/ProjectSurfaces.tsx", "utf8");
  assert.match(project, /getProjectFileUrl/);
});
