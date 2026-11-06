import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canUseCertoRun } from "../src/run/access";
import { executeTool } from "../worker/mcp/remoteCore.js";

test("Run is denied by default, including other admins and unverified email", () => {
  assert.equal(canUseCertoRun(null), false);
  assert.equal(canUseCertoRun({ email: "other@example.com", emailVerified: true }), false);
  assert.equal(canUseCertoRun({ email: "alejandro@getboldr.ai", emailVerified: false }), false);
  assert.equal(canUseCertoRun({ email: "alejandro@getboldr.ai" }), false);
  assert.equal(canUseCertoRun({ email: "alejandro@getboldr.ai", emailVerified: true }), true);
});
test("Run route, navigation and writes enforce private rollout", () => {
  const shell = readFileSync("src/components/DelivereeWorkspace.tsx", "utf8");
  assert.match(shell, /runAllowed = canUseCertoRun\(user\)/);
  assert.match(shell, /centerView === "run" && !runAllowed/);
  assert.match(shell, /canManageMembers/); // Workspace role remains separate, not a Run grant.
  assert.match(shell, /\{runAllowed && <button[\s\S]*?data-testid="nav-certo-run"/);
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /request.auth.token.email_verified == true/);
  assert.match(rules, /canMutateRunRecord\(resource.data\) && canMutateRunRecord\(incoming\(\)\)/);
});
test("generic MCP tokens cannot fetch Run items by ID", async () => {
  const repo = {
    userCanAccess: async () => true,
    listItems: async () => [],
    getWorkspace: async () => ({ id: "ws", ownerId: "person" }),
    getMembership: async () => ({ status: "active", role: "owner" }),
    getItem: async () => ({ id: "private-run", workspaceId: "ws", runWorld: "Pure AI", title: "Private" }),
  };
  const token = { userId: "person", workspaceIds: ["ws"], scopes: ["read"] };
  await assert.rejects(() => executeTool(repo, token, "get_item", {workspace_id:"ws", item_id:"private-run"}), /not available through this token/);
});
