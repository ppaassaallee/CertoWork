import assert from "node:assert/strict";
import test from "node:test";
import { isFirestoreQuotaError, workspaceLoadErrorMessage } from "../src/lib/workspaceLoadError";

test("quota failures are identified and explained without blaming the user", () => {
  const error = { code: "resource-exhausted", message: "Quota exceeded." };
  assert.equal(isFirestoreQuotaError(error), true);
  assert.match(workspaceLoadErrorMessage(error), /data service has reached its usage limit/);
  assert.match(workspaceLoadErrorMessage(error), /not the problem/);
});

test("other workspace failures keep an appropriate recovery message", () => {
  assert.match(workspaceLoadErrorMessage({ code: "permission-denied" }), /membership/);
  assert.match(workspaceLoadErrorMessage(new Error("offline")), /connection/);
});
