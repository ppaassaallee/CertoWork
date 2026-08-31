import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  grantsWorkspacePortfolioAccess,
  isPortfolioViewerMember,
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

test("login membership writes grant portfolio access to non-viewers", () => {
  const auth = readFileSync(resolve("src/lib/AuthContext.tsx"), "utf8");
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(auth, /grantsWorkspacePortfolioAccess\(role\)/);
  assert.match(workspace, /portfolioViewer: role !== "viewer"/);
  assert.match(workspace, /canSeeMemberEmails/);
  assert.match(workspace, /data-testid="member-directory-name"/);
});
