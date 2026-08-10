import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_LIMIT,
  canCreateWorkspace,
  memberAssignmentValue,
  normalizeInviteEmail,
  roleLabel,
} from "../src/lib/workspaceCollaboration";

test("workspace creation is capped at three workspaces", () => {
  assert.equal(WORKSPACE_LIMIT, 3);
  assert.equal(canCreateWorkspace(0), true);
  assert.equal(canCreateWorkspace(2), true);
  assert.equal(canCreateWorkspace(3), false);
});

test("workspace invite emails and assignment labels are stable", () => {
  assert.equal(normalizeInviteEmail("  Team.Member@Boldr.AI "), "team.member@boldr.ai");
  assert.equal(memberAssignmentValue({ displayName: "Ana Ops", email: "ana@example.com" }), "Ana Ops");
  assert.equal(memberAssignmentValue({ email: "ana@example.com" }), "ana@example.com");
  assert.equal(roleLabel("admin"), "Admin");
  assert.equal(roleLabel("unknown"), "Member");
});
