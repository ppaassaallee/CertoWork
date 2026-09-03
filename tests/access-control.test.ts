import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  grantsWorkspacePortfolioAccess,
  isPortfolioViewerMember,
  projectAccessLookupIds,
  projectAccessNameValues,
  shouldTryWorkspacePortfolioQuery,
} from "../src/lib/accessControl";

test("workspace members who are not viewers can see the full project portfolio", () => {
  assert.equal(grantsWorkspacePortfolioAccess("member"), true);
  assert.equal(grantsWorkspacePortfolioAccess("admin"), true);
  assert.equal(grantsWorkspacePortfolioAccess("owner"), true);
  assert.equal(grantsWorkspacePortfolioAccess(""), true);
  assert.equal(grantsWorkspacePortfolioAccess("viewer"), false);
  assert.equal(isPortfolioViewerMember({ role: "member" }), true);
  assert.equal(isPortfolioViewerMember({ role: "admin" }), true);
  assert.equal(isPortfolioViewerMember({ role: "viewer" }), false);
  assert.equal(isPortfolioViewerMember({ role: "viewer", portfolioViewer: true }), true);
  assert.equal(isPortfolioViewerMember(null), false);
});

test("portfolio query tries the workspace list unless the member is a known viewer", () => {
  assert.equal(shouldTryWorkspacePortfolioQuery({ isOwner: true, member: null }), true);
  assert.equal(shouldTryWorkspacePortfolioQuery({ isOwner: false, member: null }), true);
  assert.equal(
    shouldTryWorkspacePortfolioQuery({ isOwner: false, member: { role: "member" } }),
    true,
  );
  assert.equal(
    shouldTryWorkspacePortfolioQuery({ isOwner: false, member: { role: "viewer" } }),
    false,
  );
});

test("project role lookups include membership id, uid, and email", () => {
  const ids = projectAccessLookupIds({
    workspaceId: "pure-ai",
    userId: "uid-regina",
    email: "ReginaGuardia@gmail.com",
    memberIds: ["invite-regina"],
  });
  assert.ok(ids.includes("pure-ai_uid-regina"));
  assert.ok(ids.includes("uid-regina"));
  assert.ok(ids.includes("invite-regina"));
  assert.ok(ids.includes("reginaguardia@gmail.com"));
  assert.deepEqual(
    projectAccessNameValues({
      alias: "regina",
      displayName: "Regina Guardia",
      email: "regine.gg@alliedglobal.com",
    }).sort(),
    ["Regina Guardia", "Regina", "regina", "regine", "regine.gg"].sort(),
  );
});

test("login membership writes grant portfolio access to non-viewers", () => {
  const auth = readFileSync(resolve("src/lib/AuthContext.tsx"), "utf8");
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(auth, /grantsWorkspacePortfolioAccess\(role\)/);
  assert.match(workspace, /portfolioViewer: role !== "viewer"/);
  assert.match(workspace, /canSeeMemberEmails/);
  assert.match(workspace, /data-testid="member-directory-name"/);
  assert.match(workspace, /Invite link copied/);
  assert.match(workspace, /for \(const project of activeProjects\)/);
});

test("project search opens the portfolio list instead of staying on the dashboard", () => {
  const projectSurfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
  const commandPalette = readFileSync(resolve("src/components/CommandPalette.tsx"), "utf8");
  assert.match(projectSurfaces, /if \(next\.trim\(\) && view === "dashboard"\) setView\("overview"\)/);
  assert.match(commandPalette, /normalize\("NFD"\)/);
});
