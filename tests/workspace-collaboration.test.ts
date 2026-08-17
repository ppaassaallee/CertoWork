import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_LIMIT,
  activeMemberId,
  canCreateWorkspace,
  canChangePasswordForProvider,
  memberAssignmentValue,
  memberStatusLabel,
  normalizeInviteEmail,
  passwordProviderMessage,
  pendingMemberId,
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

test("workspace member ids and statuses are deterministic", () => {
  assert.equal(activeMemberId("ws-1", "user-1"), "ws-1_user-1");
  assert.equal(
    pendingMemberId("ws-1", "  New.Person+Ops@Boldr.AI "),
    "ws-1_invite_new_person_ops_boldr_ai",
  );
  assert.equal(memberStatusLabel("invited"), "Invited");
  assert.equal(memberStatusLabel("accepted"), "Accepted");
  assert.equal(memberStatusLabel(""), "Active");
});

test("password change guidance follows the sign-in provider", () => {
  assert.equal(canChangePasswordForProvider(["password"]), true);
  assert.equal(canChangePasswordForProvider(["google.com"]), false);
  assert.match(passwordProviderMessage(["password"]), /reset link/i);
  assert.match(passwordProviderMessage(["google.com"]), /Google Account/i);
});
