import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isInvitedMember,
  isJoinedWorkspaceMember,
  memberHasAlias,
  memberPublicLabel,
} from "../src/lib/workspaceCollaboration";

test("member labels distinguish alias, pending, and missing alias", () => {
  assert.equal(memberPublicLabel({ alias: "Regina" }), "Regina");
  assert.equal(memberPublicLabel({ status: "invited" }), "Pending acceptance");
  assert.equal(memberPublicLabel({ email: "x@y.com" } as any), "Needs alias");
  assert.equal(memberHasAlias({ alias: "Regina" }), true);
  assert.equal(memberHasAlias({ displayName: "" }), false);
  assert.equal(isInvitedMember({ status: "invited", userId: "pending:a@b.com" }), true);
  assert.equal(isJoinedWorkspaceMember({ status: "active", userId: "uid-1" }), true);
  assert.equal(isJoinedWorkspaceMember({ status: "active", userId: "pending:a@b.com" }), false);
});

test("portfolio people dropdowns require aliases and label pending invites", () => {
  const surfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
  assert.match(surfaces, /function portfolioMemberOptions/);
  assert.match(surfaces, /readyMemberOptions/);
  assert.match(surfaces, /pendingMemberOptions/);
  assert.match(surfaces, /Pending invite \(no user yet\)/);
  assert.match(surfaces, /No people with an alias yet/);
  assert.match(surfaces, /Needs alias/);
  assert.match(surfaces, /memberHasAlias/);
});

test("assignee picker prefers aliased members and explains pending", () => {
  const picker = readFileSync(resolve("src/components/ProjectControls.tsx"), "utf8");
  assert.match(picker, /memberHasAlias\(member\) && !isInvitedMember\(member\)/);
  assert.match(picker, /Invite pending — no user yet/);
  assert.match(picker, /No people with an alias yet/);
});
