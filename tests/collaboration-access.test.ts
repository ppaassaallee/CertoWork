import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildTaskAccessPatch } from "../src/lib/accessControl";
import {
  collaborationShareGrant,
  collaboratorAccessFromMembers,
  isShareableAuthUserId,
  shareableAuthUserId,
  withCollaboratorAccess,
} from "../src/lib/collaborationAccess";

const invited = {
  id: "ws_invite_agustin_getboldr_ai",
  userId: "pending:agustin@getboldr.ai",
  email: "agustin@getboldr.ai",
  emailLower: "agustin@getboldr.ai",
  status: "invited",
};

const active = {
  id: "ws_user-agustin",
  userId: "uid-agustin",
  email: "agustin@getboldr.ai",
  emailLower: "agustin@getboldr.ai",
  status: "active",
};

test("pending invite user ids are not treated as Firebase auth uids", () => {
  assert.equal(isShareableAuthUserId("pending:agustin@getboldr.ai"), false);
  assert.equal(isShareableAuthUserId("uid-agustin"), true);
  assert.equal(shareableAuthUserId(invited), "");
  assert.equal(shareableAuthUserId(active), "uid-agustin");
});

test("sharing an invited teammate grants their email so they can see the work after they join", () => {
  const grant = collaborationShareGrant(invited);
  assert.equal(grant.userId, "");
  assert.equal(grant.email, "agustin@getboldr.ai");
  const patch = withCollaboratorAccess(
    { visibleToUserIds: ["owner-uid"], visibleToEmails: ["owner@certo.work"] },
    grant,
  );
  assert.deepEqual(patch.visibleToUserIds, ["owner-uid"]);
  assert.ok(patch.visibleToEmails.includes("agustin@getboldr.ai"));
  assert.equal(patch.sharedWithUserIds.includes("pending:agustin@getboldr.ai"), false);
});

test("sharing an active teammate grants their auth uid", () => {
  const grant = collaborationShareGrant(active);
  const patch = withCollaboratorAccess({}, grant);
  assert.deepEqual(patch.visibleToUserIds, ["uid-agustin"]);
  assert.deepEqual(patch.sharedWithUserIds, ["uid-agustin"]);
  assert.deepEqual(patch.visibleToEmails, ["agustin@getboldr.ai"]);
});

test("assigning a teammate writes member id plus email/uid access fields", () => {
  const patch = buildTaskAccessPatch({
    task: { assigneeIds: [active.id], title: "Send proposal" },
    workspaceId: "ws",
    userId: "owner-uid",
    email: "owner@certo.work",
    members: [active, invited],
  });
  assert.deepEqual(patch.assigneeIds, ["ws_user-agustin"]);
  assert.ok(patch.visibleToUserIds.includes("uid-agustin"));
  assert.ok(patch.visibleToEmails.includes("agustin@getboldr.ai"));
  assert.ok(patch.accessMemberIds.includes("ws_user-agustin"));
});

test("assigning an invited teammate still grants email access", () => {
  const patch = buildTaskAccessPatch({
    task: { assigneeIds: [invited.id] },
    workspaceId: "ws",
    userId: "owner-uid",
    email: "owner@certo.work",
    members: [invited],
  });
  assert.ok(patch.visibleToEmails.includes("agustin@getboldr.ai"));
  assert.equal(patch.visibleToUserIds.includes("pending:agustin@getboldr.ai"), false);
  assert.deepEqual(collaboratorAccessFromMembers([invited], [invited.id]).emails, [
    "agustin@getboldr.ai",
  ]);
});

test("project share and item share look up members by id instead of pending user ids", () => {
  const projectSurfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
  const workItems = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const invite = readFileSync(resolve("src/components/InviteActivate.tsx"), "utf8");
  const rules = readFileSync(resolve("firestore.rules"), "utf8");

  assert.match(projectSurfaces, /collaborationShareGrant/);
  assert.match(projectSurfaces, /value=\{member\.id\}/);
  assert.doesNotMatch(projectSurfaces, /value=\{member\.userId \|\| member\.id\}/);
  assert.match(workItems, /withCollaboratorAccess/);
  assert.match(workItems, /value=\{member\.id\}/);
  assert.match(workspace, /members: workspaceMembers/);
  assert.match(workspace, /buildProjectCollaboratorAccessPatch/);
  assert.match(workspace, /Only the workspace owner or an admin can invite people/);
  assert.match(workspace, /resendWorkspaceInvite/);
  assert.match(workspace, /Remove invite/);
  assert.match(workspace, /pendingInviteDirectory/);
  assert.match(workspace, /invite && inviteIsExpired\(invite\)/);
  assert.match(invite, /pendingMemberId/);
  assert.match(invite, /acceptedMemberId/);
  assert.match(rules, /match \/access_requests\/\{id\}/);
  assert.match(rules, /isWorkspaceAdmin\(incoming\(\)\.workspaceId\)/);
});
