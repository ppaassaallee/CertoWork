import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aliasFromEmail,
  effectiveMemberAlias,
  isInvitedMember,
  isJoinedWorkspaceMember,
  memberHasAlias,
  memberPublicLabel,
} from "../src/lib/workspaceCollaboration";

test("email local-part becomes the automatic alias", () => {
  assert.equal(aliasFromEmail("Jane.Doe+ops@Boldr.AI"), "jane doe");
  assert.equal(aliasFromEmail("x@y.com"), "x");
  assert.equal(effectiveMemberAlias({ email: "ana@example.com" }), "ana");
  assert.equal(memberPublicLabel({ alias: "Regina" }), "Regina");
  assert.equal(memberPublicLabel({ email: "x@y.com" } as any), "x");
  assert.equal(memberPublicLabel({ status: "invited", email: "agustin@getboldr.ai" }), "agustin");
  assert.equal(memberHasAlias({ alias: "Regina" }), true);
  assert.equal(memberHasAlias({ email: "ana@example.com" }), true);
  assert.equal(memberHasAlias({ displayName: "" }), false);
  assert.equal(isInvitedMember({ status: "invited", userId: "pending:a@b.com" }), true);
  assert.equal(isJoinedWorkspaceMember({ status: "active", userId: "uid-1" }), true);
  assert.equal(isJoinedWorkspaceMember({ status: "active", userId: "pending:a@b.com" }), false);
});

test("portfolio Member/PM dropdowns exclude pending invites and Needs alias", () => {
  const surfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
  assert.match(surfaces, /function portfolioMemberOptions/);
  assert.match(surfaces, /effectiveMemberAlias/);
  assert.match(surfaces, /!isInvitedMember\(member\) && isJoinedWorkspaceMember\(member\)/);
  assert.doesNotMatch(surfaces, /Pending invite \(no user yet\)/);
  assert.doesNotMatch(surfaces, /pendingMemberOptions/);
  assert.doesNotMatch(surfaces, /No people with an alias yet/);
});

test("assignee picker excludes pending invites and never shows Needs alias", () => {
  const picker = readFileSync(resolve("src/components/ProjectControls.tsx"), "utf8");
  assert.match(picker, /effectiveMemberAlias\(member\)/);
  assert.match(picker, /!isInvitedMember\(member\) && Boolean\(effectiveMemberAlias\(member\)\)/);
  assert.doesNotMatch(picker, /Invite pending — no user yet/);
  assert.doesNotMatch(picker, /Needs alias/);
  assert.match(picker, /No joined teammates yet/);
});
