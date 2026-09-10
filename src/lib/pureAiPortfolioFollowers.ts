import { normalizeAccessEmail } from "./accessControl";
import {
  PORTFOLIO_SHARE_ALIASES,
  memberMatchesShareAlias,
  resolvePortfolioShareTargets,
} from "./portfolioMasterImport";
import type { WorkspaceMember } from "./workspaceCollaboration";
import { isAssignableMember, normalizeAlias } from "./workspaceCollaboration";

/** People who should follow every Pure AI project and hold admin portfolio access. */
export const PURE_AI_PORTFOLIO_FOLLOWER_ALIASES = [
  "cesar",
  "rafael",
  "regina",
  "edgar",
] as const;

/** Bump when the follower set changes so Pure AI owner auto-grant re-runs. */
export const PURE_AI_PORTFOLIO_FOLLOWERS_KEY = "regina-cesar-rafael-edgar-v2";

export type PureAiFollowerShare = ReturnType<typeof resolvePortfolioShareTargets>;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function asList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

/** Ensure portfolio share aliases include the Pure AI admin followers (e.g. Edgar). */
export function portfolioShareAliasesWithFollowers(
  aliases: readonly string[] = PORTFOLIO_SHARE_ALIASES,
) {
  return unique([...aliases, ...PURE_AI_PORTFOLIO_FOLLOWER_ALIASES]);
}

export function resolvePureAiPortfolioFollowers(members: WorkspaceMember[]) {
  return resolvePortfolioShareTargets(members, PURE_AI_PORTFOLIO_FOLLOWER_ALIASES);
}

export function matchedPureAiFollowerMembers(members: WorkspaceMember[]) {
  const active = members.filter(isAssignableMember);
  return PURE_AI_PORTFOLIO_FOLLOWER_ALIASES.map((alias) => {
    const member = active.find((candidate) => memberMatchesShareAlias(candidate, alias));
    return { alias, member: member || null };
  });
}

export function buildPureAiFollowerMemberPatch() {
  return {
    role: "admin" as const,
    portfolioViewer: true,
  };
}

export function buildPureAiFollowerWorkspaceRolesPatch(
  currentRoles: Record<string, string> | null | undefined,
  members: Array<WorkspaceMember | null | undefined>,
) {
  const roles = { ...(currentRoles || {}) };
  for (const member of members) {
    if (!member) continue;
    const email = normalizeAccessEmail(member.email || member.emailLower);
    if (!email) continue;
    roles[email] = "admin";
  }
  return roles;
}

export function buildPureAiFollowerProjectPatch(
  project: Record<string, unknown> | null | undefined,
  share: Pick<PureAiFollowerShare, "userIds" | "memberIds" | "emails" | "labels">,
) {
  const record = project || {};
  const teamMemberIds = unique([...asList(record.teamMemberIds), ...share.memberIds]);
  const teamMembers = unique([
    ...asList(record.teamMembers).map((label) => normalizeAlias(label) || label),
    ...share.labels,
  ]);
  const visibleToUserIds = unique([...asList(record.visibleToUserIds), ...share.userIds]);
  const visibleToEmails = unique([
    ...asList(record.visibleToEmails).map((email) => normalizeAccessEmail(email)),
    ...share.emails.map((email) => normalizeAccessEmail(email)),
  ]);
  const sharedWithUserIds = unique([...asList(record.sharedWithUserIds), ...share.userIds]);
  return {
    teamMemberIds,
    teamMembers,
    visibleToUserIds,
    visibleToEmails,
    sharedWithUserIds,
    visibility: sharedWithUserIds.length || teamMemberIds.length ? ("shared" as const) : ("private" as const),
  };
}

export function summarizePureAiFollowerGrant(input: {
  share: PureAiFollowerShare;
  projectsUpdated: number;
  membersPromoted: number;
}) {
  const names = input.share.labels.length
    ? input.share.labels.join(", ")
    : PURE_AI_PORTFOLIO_FOLLOWER_ALIASES.join(", ");
  const missing = input.share.missingAliases.length
    ? ` Missing in workspace: ${input.share.missingAliases.join(", ")}.`
    : "";
  return `Granted Pure AI portfolio follow to ${names} on ${input.projectsUpdated} projects; promoted ${input.membersPromoted} to admin.${missing}`;
}
