import assert from "node:assert/strict";
import test from "node:test";
import { isStaleAssetError } from "../src/lib/runtimeRecovery";

test("recognizes stale deployment chunk failures", () => {
  assert.equal(
    isStaleAssetError(
      new TypeError("Failed to fetch dynamically imported module: /assets/ProjectDetails-old.js"),
    ),
    true,
  );
  assert.equal(isStaleAssetError(new Error("ChunkLoadError: Loading chunk 42 failed")), true);
});

test("does not reload for ordinary application errors", () => {
  assert.equal(isStaleAssetError(new Error("Permission denied")), false);
  assert.equal(isStaleAssetError("OpenAI is unavailable"), false);
});
