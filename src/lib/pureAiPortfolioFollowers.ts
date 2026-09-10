import { normalizeAccessEmail } from "./accessControl";
import {
  PORTFOLIO_SHARE_ALIASES,
  isPureAiWorkspace,
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

/**
 * Known emails for Pure AI admin followers. These MUST stay on
 * `workspaces.members` so invitees can discover Pure AI on login
 * (Firestore rules require email ∈ members to read the workspace).
 */
export const PURE_AI_PORTFOLIO_FOLLOWER_KNOWN_EMAILS = [
  "regina.gg@alliedglobal.com",
  "regine.gg@alliedglobal.com",
  "cesar.a@getboldr.ai",
  "cesar.ar@alliedglobal.com",
  "rafael.f@getboldr.ai",
] as const;

/** Bump when the follower set / seat list changes so Pure AI owner auto-grant re-runs. */
export const PURE_AI_PORTFOLIO_FOLLOWERS_KEY = "regina-cesar-rafael-edgar-v4";

export type PureAiFollowerShare = ReturnType<typeof resolvePortfolioShareTargets>;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function asList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function emailLocalPart(email: string) {
  return normalizeAccessEmail(email).split("@")[0] || "";
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

export function emailMatchesPureAiFollower(email?: string | null) {
  const normalized = normalizeAccessEmail(email);
  if (!normalized) return false;
  if (PURE_AI_PORTFOLIO_FOLLOWER_KNOWN_EMAILS.map((item) => normalizeAccessEmail(item)).includes(normalized)) {
    return true;
  }
  const local = emailLocalPart(normalized);
  return PURE_AI_PORTFOLIO_FOLLOWER_ALIASES.some(
    (alias) => local === alias || local.startsWith(`${alias}.`) || local.startsWith(alias),
  );
}

export function memberIsPureAiFollower(member: Pick<WorkspaceMember, "alias" | "displayName" | "email" | "emailLower">) {
  if (emailMatchesPureAiFollower(member.email || member.emailLower)) return true;
  return PURE_AI_PORTFOLIO_FOLLOWER_ALIASES.some((alias) => memberMatchesShareAlias(member as WorkspaceMember, alias));
}

export function isPersonalOrEmailNamedWorkspace(
  workspace?: { name?: string | null } | null,
  userEmail?: string | null,
) {
  const name = String(workspace?.name || "").trim().toLowerCase();
  if (!name) return false;
  if (name === "personal focus" || name === "personal" || name.includes("personal focus")) return true;
  const email = normalizeAccessEmail(userEmail);
  if (email && name === email) return true;
  return name.includes("@");
}

/** Prefer Pure AI for follower emails so they never land on an empty Personal Focus. */
export function pickPreferredWorkspace<T extends { id: string; name?: string | null }>(
  workspaces: T[],
  options?: { userEmail?: string | null; storedId?: string | null },
) {
  if (!workspaces.length) return null;
  const stored = options?.storedId
    ? workspaces.find((item) => item.id === options.storedId) || null
    : null;
  const pureAi = workspaces.find((item) => isPureAiWorkspace(item)) || null;
  if (
    pureAi &&
    emailMatchesPureAiFollower(options?.userEmail) &&
    (!stored || isPersonalOrEmailNamedWorkspace(stored, options?.userEmail) || !isPureAiWorkspace(stored))
  ) {
    return pureAi;
  }
  return stored || workspaces[0];
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
  extraEmails: string[] = [],
) {
  const roles = { ...(currentRoles || {}) };
  for (const member of members) {
    if (!member) continue;
    const email = normalizeAccessEmail(member.email || member.emailLower);
    if (!email) continue;
    roles[email] = "admin";
  }
  for (const email of extraEmails) {
    const normalized = normalizeAccessEmail(email);
    if (!normalized) continue;
    roles[normalized] = "admin";
  }
  return roles;
}

export function buildPureAiFollowerMembersList(
  currentMembers: Array<string | null | undefined> | null | undefined,
  extraEmails: string[] = [],
) {
  return unique([
    ...(currentMembers || []).map((item) => normalizeAccessEmail(item)),
    ...extraEmails.map((item) => normalizeAccessEmail(item)),
  ]);
}

export function pureAiFollowerSeatEmails(members: WorkspaceMember[] = []) {
  const fromMembers = matchedPureAiFollowerMembers(members)
    .map((item) => normalizeAccessEmail(item.member?.email || item.member?.emailLower))
    .filter(Boolean);
  return unique([...PURE_AI_PORTFOLIO_FOLLOWER_KNOWN_EMAILS, ...fromMembers]);
}

export function pureAiFollowerEmailsMissingFromWorkspace(
  workspace?: { members?: Array<string | null | undefined> | null } | null,
  members: WorkspaceMember[] = [],
) {
  const seated = new Set(
    (workspace?.members || []).map((item) => normalizeAccessEmail(item)).filter(Boolean),
  );
  return pureAiFollowerSeatEmails(members).filter((email) => !seated.has(email));
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
    ...PURE_AI_PORTFOLIO_FOLLOWER_KNOWN_EMAILS.map((email) => normalizeAccessEmail(email)),
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
  seatsEnsured?: number;
  projectsFailed?: number;
}) {
  const names = input.share.labels.length
    ? input.share.labels.join(", ")
    : PURE_AI_PORTFOLIO_FOLLOWER_ALIASES.join(", ");
  const missing = input.share.missingAliases.length
    ? ` Missing active members: ${input.share.missingAliases.join(", ")} (email seats still ensured).`
    : "";
  const seats =
    input.seatsEnsured && input.seatsEnsured > 0 ? ` Ensured ${input.seatsEnsured} email seat(s).` : "";
  const failed =
    input.projectsFailed && input.projectsFailed > 0
      ? ` ${input.projectsFailed} project(s) skipped (invalid or locked).`
      : "";
  return `Granted Pure AI portfolio follow to ${names} on ${input.projectsUpdated} projects; promoted ${input.membersPromoted} to admin.${seats}${failed}${missing}`;
}
