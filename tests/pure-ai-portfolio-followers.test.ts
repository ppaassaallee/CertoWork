import assert from "node:assert/strict";
import test from "node:test";

import {
  PURE_AI_PORTFOLIO_FOLLOWER_ALIASES,
  buildPureAiFollowerMemberPatch,
  buildPureAiFollowerProjectPatch,
  buildPureAiFollowerWorkspaceRolesPatch,
  matchedPureAiFollowerMembers,
  portfolioShareAliasesWithFollowers,
  resolvePureAiPortfolioFollowers,
  summarizePureAiFollowerGrant,
} from "../src/lib/pureAiPortfolioFollowers";
import { PORTFOLIO_SHARE_ALIASES, resolvePortfolioShareTargets } from "../src/lib/portfolioMasterImport";

test("Pure AI follower aliases cover Regina, César, Rafael and Edgar", () => {
  assert.deepEqual([...PURE_AI_PORTFOLIO_FOLLOWER_ALIASES].sort(), [
    "cesar",
    "edgar",
    "rafael",
    "regina",
  ]);
  assert.ok(PORTFOLIO_SHARE_ALIASES.includes("edgar"));
  assert.ok(portfolioShareAliasesWithFollowers().includes("edgar"));
});

test("resolves follower members and promotes them to admin portfolio viewers", () => {
  const members = [
    { id: "ws_cesar", userId: "u-cesar", alias: "cesar", email: "cesar.a@getboldr.ai", status: "active" },
    { id: "ws_rafa", userId: "u-rafa", displayName: "Rafael Fuentes", email: "rafael.f@getboldr.ai", status: "active" },
    { id: "ws_regina", userId: "u-regina", alias: "regina", email: "regina@getboldr.ai", status: "active" },
    { id: "ws_edgar", userId: "u-edgar", alias: "edgar", email: "edgar@getboldr.ai", status: "active" },
    { id: "ws_other", userId: "u-other", alias: "nico", email: "nico@getboldr.ai", status: "active" },
  ];
  const share = resolvePureAiPortfolioFollowers(members);
  assert.deepEqual(share.missingAliases, []);
  assert.deepEqual(share.userIds.sort(), ["u-cesar", "u-edgar", "u-rafa", "u-regina"]);
  assert.equal(matchedPureAiFollowerMembers(members).filter((item) => item.member).length, 4);
  assert.deepEqual(buildPureAiFollowerMemberPatch(), { role: "admin", portfolioViewer: true });
  const followerMembers = matchedPureAiFollowerMembers(members)
    .map((item) => item.member)
    .filter(Boolean);
  assert.deepEqual(
    buildPureAiFollowerWorkspaceRolesPatch({ "nico@getboldr.ai": "member" }, followerMembers),
    {
      "nico@getboldr.ai": "member",
      "cesar.a@getboldr.ai": "admin",
      "rafael.f@getboldr.ai": "admin",
      "regina@getboldr.ai": "admin",
      "edgar@getboldr.ai": "admin",
    },
  );
});

test("project follower patch merges team + visibility without dropping existing access", () => {
  const share = resolvePortfolioShareTargets(
    [
      { id: "ws_edgar", userId: "u-edgar", alias: "edgar", email: "edgar@getboldr.ai", status: "active" },
      { id: "ws_regina", userId: "u-regina", alias: "regina", email: "regina@getboldr.ai", status: "active" },
    ],
    ["edgar", "regina"],
  );
  const patch = buildPureAiFollowerProjectPatch(
    {
      teamMemberIds: ["ws_existing"],
      teamMembers: ["existing"],
      visibleToUserIds: ["owner"],
      visibleToEmails: ["owner@getboldr.ai"],
      sharedWithUserIds: ["owner"],
    },
    share,
  );
  assert.ok(patch.teamMemberIds.includes("ws_existing"));
  assert.ok(patch.teamMemberIds.includes("ws_edgar"));
  assert.ok(patch.teamMemberIds.includes("ws_regina"));
  assert.ok(patch.visibleToUserIds.includes("owner"));
  assert.ok(patch.visibleToUserIds.includes("u-edgar"));
  assert.ok(patch.visibleToEmails.includes("edgar@getboldr.ai"));
  assert.equal(patch.visibility, "shared");
  assert.match(
    summarizePureAiFollowerGrant({ share, projectsUpdated: 12, membersPromoted: 2 }),
    /12 projects/,
  );
});
