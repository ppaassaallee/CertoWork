import assert from "node:assert/strict";
import test from "node:test";
import { dataManagementAuditBody, fieldErrors } from "../server/lib/schemas";

test("data-management audit rejects a malformed body with field errors", () => {
  const result = dataManagementAuditBody.safeParse({ userId: "u1" });
  assert.equal(result.success, false);
  if (!result.success) {
    const fields = fieldErrors(result.error);
    assert.ok(fields.some((field) => field.path === "workspaceId"));
  }
});

test("data-management audit accepts a workspace-scoped body", () => {
  const result = dataManagementAuditBody.safeParse({
    userId: "u1",
    workspaceId: "ws1",
  });
  assert.equal(result.success, true);
});
