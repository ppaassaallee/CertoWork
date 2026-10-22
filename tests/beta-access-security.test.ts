import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const rules = readFileSync("firestore.rules", "utf8");
const server = readFileSync("functions/src/betaAccess.ts", "utf8");
const client = readFileSync("src/components/DelivereeWorkspace.tsx", "utf8");

test("beta signup is self-service but global triage cannot use client Firestore rules", () => {
  const scope = rules.split("match /access_requests/{id} {")[1].split("match /workspace_members/")[0];
  assert.match(scope, /id == request\.auth\.uid/);
  assert.match(scope, /incoming\(\)\.status == 'pending'/);
  assert.match(scope, /incoming\(\)\.emailLower == authEmailLower\(\)/);
  assert.match(scope, /allow list, update, delete: if false/);
  assert.doesNotMatch(client, /getDocsFromServer\(query\(collection\(db, "access_requests"/);
  assert.match(client, /"listBetaAccessRequests"/);
  assert.match(client, /"decideBetaAccessRequest"/);
});

test("beta decisions require the sole designated approver and verify account email", () => {
  assert.match(server, /process\.env\.BETA_APPROVER_UID/);
  assert.match(server, /uid !== approverUid/);
  assert.match(server, /getAuth\(\)\.getUser\(requestId\)/);
  assert.match(server, /account\.emailVerified/);
  assert.match(server, /email !== accountEmail/);
  assert.match(server, /db\.runTransaction/);
});

test("revoke cannot erase an accepted invitation's active workspace access", () => {
  const revoke = client.split("const revokeWorkspaceInvite =")[1].split("const approveAccessRequest =")[0];
  assert.match(revoke, /if \(!inviteIsUsable\(invite\)\)/);
  assert.match(revoke, /member\.status === "active"/);
  const repair = readFileSync("scripts/repair-workspace-invite.mjs", "utf8");
  assert.match(repair, /row\.status === "accepted"/);
  assert.match(repair, /member\.status !== "active"/);
  assert.match(repair, /db\.runTransaction/);
});
