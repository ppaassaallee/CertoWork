import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_LIMIT,
  activeMemberId,
  canCreateWorkspace,
  canChangePasswordForProvider,
  canManageWorkspaceMembers,
  looksLikeEmail,
  memberAssignmentValue,
  memberAvatar,
  memberHasAlias,
  memberMatchesSelection,
  memberPublicLabel,
  memberStatusLabel,
  membershipPublicPatch,
  normalizeAlias,
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

test("workspace invite emails and assignment labels stay private", () => {
  assert.equal(normalizeInviteEmail("  Team.Member@Boldr.AI "), "team.member@boldr.ai");
  assert.equal(looksLikeEmail("ana@example.com"), true);
  assert.equal(normalizeAlias("ana@example.com"), "");
  assert.equal(memberAssignmentValue({ displayName: "Ana Ops", email: "ana@example.com" }), "Ana Ops");
  assert.equal(memberPublicLabel({ email: "ana@example.com" }), "Needs alias");
  assert.equal(memberPublicLabel({ alias: "Ana Ops", email: "ana@example.com" }), "Ana Ops");
  assert.equal(memberHasAlias({ displayName: "ana@example.com" }), false);
  assert.equal(memberAvatar({ emoji: "🦊" }), "🦊");
  assert.equal(roleLabel("admin"), "Admin");
  assert.equal(roleLabel("unknown"), "Member");
  assert.equal(canManageWorkspaceMembers("admin"), true);
  assert.equal(canManageWorkspaceMembers("member"), false);
});

test("assignment matching uses ids without exposing email", () => {
  const member = {
    id: "ws_user-1",
    userId: "user-1",
    alias: "Ana",
    email: "ana@example.com",
  };
  assert.equal(memberMatchesSelection(member, ["user-1"], []), true);
  assert.equal(memberMatchesSelection(member, [], ["ana@example.com"]), true);
  assert.equal(memberMatchesSelection(member, [], ["Ana"]), true);
});

test("membership public patch never stores email as alias", () => {
  const patch = membershipPublicPatch({ displayName: "person@company.com", emoji: "🚀" });
  assert.equal(patch.alias, undefined);
  assert.equal(patch.emoji, "🚀");
  assert.deepEqual(membershipPublicPatch({ alias: "Certo", emoji: "🎯" }), {
    emoji: "🎯",
    alias: "Certo",
    displayName: "Certo",
  });
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
