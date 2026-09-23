import assert from "node:assert/strict";
import test from "node:test";
import {
  firestoreUsageConsoleUrl,
  isFirestoreQuotaError,
  isFirestoreQuotaMessage,
  workspaceLoadErrorMessage,
} from "../src/lib/workspaceLoadError";

test("quota failures are identified and explained without blaming the user", () => {
  const error = { code: "resource-exhausted", message: "Quota exceeded." };
  assert.equal(isFirestoreQuotaError(error), true);
  assert.match(workspaceLoadErrorMessage(error), /data service has reached its usage limit/);
  assert.match(workspaceLoadErrorMessage(error), /not the problem/);
  assert.equal(isFirestoreQuotaMessage(workspaceLoadErrorMessage(error)), true);
});

test("other workspace failures keep an appropriate recovery message", () => {
  assert.match(workspaceLoadErrorMessage({ code: "permission-denied" }), /membership/);
  assert.match(workspaceLoadErrorMessage(new Error("offline")), /connection/);
  assert.match(workspaceLoadErrorMessage(new Error("Workspace owner lookup timed out")), /couldn't confirm your workspace data/);
});

test("usage console URL points at the Certo Firebase project", () => {
  assert.match(firestoreUsageConsoleUrl(), /gen-lang-client-0277783597/);
  assert.match(firestoreUsageConsoleUrl(), /usage\/details/);
});
