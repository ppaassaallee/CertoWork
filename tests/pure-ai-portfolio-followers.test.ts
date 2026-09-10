import assert from "node:assert/strict";
import test from "node:test";

import {
  PURE_AI_PORTFOLIO_FOLLOWER_ALIASES,
  PURE_AI_PORTFOLIO_FOLLOWER_KNOWN_EMAILS,
  PURE_AI_PORTFOLIO_FOLLOWERS_KEY,
  buildPureAiFollowerMemberPatch,
  buildPureAiFollowerMembersList,
  buildPureAiFollowerProjectPatch,
  buildPureAiFollowerWorkspaceRolesPatch,
  emailMatchesPureAiFollower,
  isPersonalOrEmailNamedWorkspace,
  matchedPureAiFollowerMembers,
  pickPreferredWorkspace,
  portfolioShareAliasesWithFollowers,
  pureAiFollowerEmailsMissingFromWorkspace,
  resolvePureAiPortfolioFollowers,
  summarizePureAiFollowerGrant,
} from "../src/lib/pureAiPortfolioFollowers";
import { PORTFOLIO_SHARE_ALIASES, resolvePortfolioShareTargets } from "../src/lib/portfolioMasterImport";
import { dueInviteEmailRetry, dueInviteReminder } from "../src/lib/inviteLifecycle";

test("Pure AI follower aliases cover Regina, César, Rafael and Edgar", () => {
  assert.deepEqual([...PURE_AI_PORTFOLIO_FOLLOWER_ALIASES].sort(), [
    "cesar",
    "edgar",
    "rafael",
    "regina",
  ]);
  assert.equal(PURE_AI_PORTFOLIO_FOLLOWERS_KEY, "regina-cesar-rafael-edgar-v4");
  assert.ok(PORTFOLIO_SHARE_ALIASES.includes("edgar"));
  assert.ok(portfolioShareAliasesWithFollowers().includes("edgar"));
  assert.ok(PURE_AI_PORTFOLIO_FOLLOWER_KNOWN_EMAILS.includes("regina.gg@alliedglobal.com"));
  assert.equal(emailMatchesPureAiFollower("regina.gg@alliedglobal.com"), true);
  assert.equal(emailMatchesPureAiFollower("other@alliedglobal.com"), false);
});

test("prefers Pure AI over Personal Focus / email-named workspaces for followers", () => {
  const workspaces = [
    { id: "personal", name: "regina.gg@alliedglobal.com" },
    { id: "pure", name: "Pure AI Workspace" },
  ];
  assert.equal(isPersonalOrEmailNamedWorkspace(workspaces[0], "regina.gg@alliedglobal.com"), true);
  assert.equal(
    pickPreferredWorkspace(workspaces, {
      userEmail: "regina.gg@alliedglobal.com",
      storedId: "personal",
    })?.id,
    "pure",
  );
  assert.equal(
    pickPreferredWorkspace(workspaces, {
      userEmail: "someone@else.com",
      storedId: "personal",
    })?.id,
    "personal",
  );
});

test("resolves follower members and promotes them to admin portfolio viewers", () => {
  const members = [
    { id: "ws_cesar", userId: "u-cesar", alias: "cesar", email: "cesar.a@getboldr.ai", status: "active" },
    { id: "ws_rafa", userId: "u-rafa", displayName: "Rafael Fuentes", email: "rafael.f@getboldr.ai", status: "active" },
    { id: "ws_regina", userId: "u-regina", alias: "regina", email: "regina.gg@alliedglobal.com", status: "active" },
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
      "regina.gg@alliedglobal.com": "admin",
      "edgar@getboldr.ai": "admin",
    },
  );
  assert.deepEqual(
    pureAiFollowerEmailsMissingFromWorkspace({ members: ["cesar.a@getboldr.ai"] }, members).sort(),
    [
      "cesar.ar@alliedglobal.com",
      "edgar@getboldr.ai",
      "rafael.f@getboldr.ai",
      "regina.gg@alliedglobal.com",
      "regine.gg@alliedglobal.com",
    ],
  );
  assert.ok(
    buildPureAiFollowerMembersList(["owner@getboldr.ai"], ["regina.gg@alliedglobal.com"]).includes(
      "regina.gg@alliedglobal.com",
    ),
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
  assert.ok(patch.visibleToEmails.includes("regina.gg@alliedglobal.com"));
  assert.equal(patch.visibility, "shared");
  assert.match(
    summarizePureAiFollowerGrant({ share, projectsUpdated: 12, membersPromoted: 2, seatsEnsured: 3 }),
    /Ensured 3 email seat/,
  );
});

test("invite email retry fires when the first send never left Brevo", () => {
  const createdAt = Date.now() - 3 * 60 * 1000;
  assert.equal(
    dueInviteReminder({ status: "pending", createdAt, emailDeliveryStatus: "not_sent" }),
    null,
  );
  const retry = dueInviteEmailRetry({
    status: "pending",
    createdAt,
    emailDeliveryStatus: "not_sent",
    emailRetryCount: 0,
  });
  assert.ok(retry);
  assert.equal(retry?.kind, "invite");
  assert.equal(
    dueInviteEmailRetry({
      status: "pending",
      createdAt,
      emailDeliveryStatus: "sent",
    }),
    null,
  );
});
