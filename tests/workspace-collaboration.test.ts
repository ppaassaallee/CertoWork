import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_LIMIT,
  activeMemberId,
  canCreateWorkspace,
  canChangePasswordForProvider,
  canManageWorkspaceMembers,
  canSeeWorkspaceDocument,
  looksLikeEmail,
  memberAssignmentValue,
  memberAvatar,
  memberHasAlias,
  memberMatchesSelection,
  memberManageLabel,
  memberPublicLabel,
  memberStatusLabel,
  memberVisibleEmail,
  membershipPublicPatch,
  normalizeAlias,
  normalizeInviteEmail,
  passwordProviderMessage,
  pendingInviteDirectory,
  pendingMemberId,
  roleLabel,
  isJoinedWorkspaceMember,
} from "../src/lib/workspaceCollaboration";

test("workspace creation is capped at three workspaces", () => {
  assert.equal(WORKSPACE_LIMIT, 3);
  assert.equal(canCreateWorkspace(0), true);
  assert.equal(canCreateWorkspace(2), true);
  assert.equal(canCreateWorkspace(3), false);
});

test("a user only sees workspaces they own, are listed on, or belong to", () => {
  const allied = { uid: "allied-1", email: "roberto.ri@alliedglobal.com" };
  const boldr = {
    id: "fR1twiCu17nlX5YMYPLt",
    ownerId: "boldr-owner",
    name: "Boldr Ai Workspace",
    members: ["alejandro@getboldr.ai", "rafael.f@getboldr.ai"],
  };
  const pureAi = {
    id: "BZwDzExcupV1EuBrJysG",
    ownerId: "boldr-owner",
    name: "Pure Ai Workspace",
    members: ["roberto.ri@alliedglobal.com", "alejandro.ms@alliedglobal.com"],
  };
  const owned = {
    id: "personal",
    ownerId: "allied-1",
    name: "Personal Focus",
    members: ["roberto.ri@alliedglobal.com"],
  };
  assert.equal(canSeeWorkspaceDocument(boldr, allied), false);
  assert.equal(canSeeWorkspaceDocument(boldr, allied, ["BZwDzExcupV1EuBrJysG"]), false);
  assert.equal(canSeeWorkspaceDocument(pureAi, allied), true);
  assert.equal(canSeeWorkspaceDocument(owned, allied), true);
  assert.equal(canSeeWorkspaceDocument(boldr, { uid: "x", email: "other@example.com" }, ["fR1twiCu17nlX5YMYPLt"]), true);
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

test("workspace admin labels show invite emails instead of unknown user", () => {
  assert.equal(
    memberManageLabel({
      status: "invited",
      email: "agustin@getboldr.ai",
    }),
    "agustin@getboldr.ai",
  );
  assert.equal(
    memberManageLabel(
      {
        status: "invited",
        email: "agustin@getboldr.ai",
      },
      false,
    ),
    "Invited teammate",
  );
  assert.equal(
    memberPublicLabel({
      status: "invited",
      email: "agustin@getboldr.ai",
    }),
    "Invited teammate",
  );
  assert.equal(memberVisibleEmail({ email: "ana@example.com" }, false), "");
  assert.equal(memberVisibleEmail({ email: "Ana@Example.com" }, true), "ana@example.com");
});

test("pending invite directory keeps invited people visible until they join", () => {
  const rows = pendingInviteDirectory(
    [
      {
        id: "ws_invite_agustin_getboldr_ai",
        email: "agustin@getboldr.ai",
        status: "invited",
        role: "member",
        userId: "pending:agustin@getboldr.ai",
      },
      {
        id: "ws_owner",
        email: "ana@certo.work",
        status: "active",
        alias: "Ana",
      },
    ],
    [
      {
        id: "inv-1",
        email: "agustin@getboldr.ai",
        role: "member",
        inviteType: "workspace_member",
        emailDeliveryStatus: "sent",
      },
    ],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "agustin@getboldr.ai");
  assert.equal(rows[0].invite?.id, "inv-1");
  assert.equal(rows[0].member?.id, "ws_invite_agustin_getboldr_ai");
});

test("pending invite directory drops people who already joined", () => {
  const members = [
    {
      id: "ws_invite_adriana_o_getboldr_ai",
      email: "adriana.o@getboldr.ai",
      status: "accepted",
      role: "admin",
      userId: "pending:adriana.o@getboldr.ai",
    },
    {
      id: "ws_uid-adriana",
      email: "adriana.o@getboldr.ai",
      status: "active",
      role: "admin",
      userId: "uid-adriana",
    },
    {
      id: "ws_invite_agustin_getboldr_ai",
      email: "agustin@getboldr.ai",
      status: "invited",
      role: "admin",
      userId: "pending:agustin@getboldr.ai",
    },
  ];
  assert.equal(isJoinedWorkspaceMember(members[1]), true);
  assert.equal(isJoinedWorkspaceMember(members[2]), false);
  const rows = pendingInviteDirectory(members, [
    {
      id: "inv-adriana",
      email: "adriana.o@getboldr.ai",
      role: "admin",
      status: "pending",
      emailDeliveryStatus: "sent",
    },
    {
      id: "inv-agustin",
      email: "agustin@getboldr.ai",
      role: "admin",
      status: "pending",
      emailDeliveryStatus: "not_sent",
    },
    {
      id: "inv-closed",
      email: "rafael.f@getboldr.ai",
      role: "admin",
      status: "accepted",
    },
  ]);
  assert.equal(rows.map((row) => row.email).join(","), "agustin@getboldr.ai");
  assert.equal(rows[0].invite?.id, "inv-agustin");
});

test("pending invite directory hides leftover Boldr invite rows after accept or revoke", () => {
  const leftoverStubs = [
    {
      id: "ws_invite_adriana",
      email: "adriana.o@getboldr.ai",
      status: "invited",
      role: "admin",
      userId: "pending:adriana.o@getboldr.ai",
    },
    {
      id: "ws_invite_agustin",
      email: "agustin@getboldr.ai",
      status: "invited",
      role: "admin",
      userId: "pending:agustin@getboldr.ai",
    },
    {
      id: "ws_invite_cesar",
      email: "cesar.a@getboldr.ai",
      status: "invited",
      role: "admin",
      userId: "pending:cesar.a@getboldr.ai",
    },
    {
      id: "ws_invite_josue",
      email: "josue@getboldr.ai",
      status: "invited",
      role: "admin",
      userId: "pending:josue@getboldr.ai",
    },
    {
      id: "ws_invite_rafael",
      email: "rafael.f@getboldr.ai",
      status: "invited",
      role: "admin",
      userId: "pending:rafael.f@getboldr.ai",
    },
  ];
  const rows = pendingInviteDirectory(leftoverStubs, [
    { id: "a1", email: "adriana.o@getboldr.ai", status: "accepted", role: "admin" },
    { id: "a2", email: "adriana.o@getboldr.ai", status: "pending", role: "admin", emailDeliveryStatus: "sent", inviteToken: "AAA" },
    { id: "a3", email: "adriana.o@getboldr.ai", status: "pending", role: "admin" },
    { id: "g1", email: "agustin@getboldr.ai", status: "revoked", role: "admin" },
    { id: "c1", email: "cesar.a@getboldr.ai", status: "revoked", role: "admin" },
    { id: "j1", email: "josue@getboldr.ai", status: "accepted", role: "admin" },
    { id: "r1", email: "rafael.f@getboldr.ai", status: "revoked", role: "admin" },
    { id: "new", email: "nuevo@getboldr.ai", status: "pending", role: "member", inviteToken: "NEW" },
  ]);
  assert.equal(rows.map((row) => row.email).join(","), "nuevo@getboldr.ai");
});
