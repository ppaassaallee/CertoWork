import { inviteIsUsable, inviteStatus, inviteWasConsumed } from "./inviteLifecycle";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type WorkspaceMember = {
  id: string;
  workspaceId?: string;
  userId?: string;
  email?: string;
  emailLower?: string;
  displayName?: string;
  alias?: string;
  emoji?: string;
  role?: WorkspaceRole | string;
  status?: string;
  teamIds?: string[];
  financeAccess?: boolean;
};

export type WorkspaceTeam = {
  id: string;
  workspaceId?: string;
  name?: string;
  description?: string;
  memberEmails?: string[];
  status?: string;
};

export const WORKSPACE_LIMIT = 3;
export const DEFAULT_MEMBER_EMOJI = "🙂";
export const MEMBER_EMOJI_CHOICES = ["🙂", "🚀", "🎯", "🧠", "💼", "🌿", "⚡", "🦊", "🐧", "⭐", "🔥", "🛠️"];

export const WORKSPACE_ROLES: Array<{ value: WorkspaceRole; label: string; help: string }> = [
  { value: "admin", label: "Admin", help: "Can manage workspace setup and most work." },
  { value: "member", label: "Member", help: "Can collaborate on projects and tasks." },
  { value: "viewer", label: "Viewer", help: "Can follow work with limited changes." },
];

export function canCreateWorkspace(count: number) {
  return count < WORKSPACE_LIMIT;
}

export function workspaceMemberEmails(workspace: { members?: unknown } | null | undefined) {
  if (!workspace || !Array.isArray(workspace.members)) return [];
  return workspace.members
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

export function canSeeWorkspaceDocument(
  workspace: { id?: string; ownerId?: string; members?: unknown } | null | undefined,
  user: { uid?: string; email?: string | null } | null | undefined,
  memberWorkspaceIds: Iterable<string> = [],
) {
  if (!workspace || !user?.uid) return false;
  if (workspace.ownerId && workspace.ownerId === user.uid) return true;
  const email = normalizeInviteEmail(user.email || "");
  if (email && workspaceMemberEmails(workspace).includes(email)) return true;
  const workspaceId = String(workspace.id || "");
  if (!workspaceId) return false;
  for (const id of memberWorkspaceIds) {
    if (id === workspaceId) return true;
  }
  return false;
}

export function normalizeInviteEmail(value: string) {
  return value.trim().toLowerCase();
}

export function looksLikeEmail(value?: string | null) {
  return /.+@.+\..+/.test(String(value || "").trim());
}

export function normalizeAlias(value?: string | null) {
  const alias = String(value || "").trim().replace(/\s+/g, " ");
  if (!alias || looksLikeEmail(alias)) return "";
  return alias.slice(0, 32);
}

export function normalizeMemberEmoji(value?: string | null) {
  const emoji = String(value || "").trim();
  if (!emoji || looksLikeEmail(emoji)) return DEFAULT_MEMBER_EMOJI;
  return Array.from(emoji)[0] || DEFAULT_MEMBER_EMOJI;
}

export function suggestedAlias(member: Pick<WorkspaceMember, "alias" | "displayName">, fallbackName?: string | null) {
  return (
    normalizeAlias(member.alias) ||
    normalizeAlias(member.displayName) ||
    normalizeAlias(fallbackName)
  );
}

export function memberHasAlias(member: Pick<WorkspaceMember, "alias" | "displayName">) {
  return Boolean(normalizeAlias(member.alias) || normalizeAlias(member.displayName));
}

export function memberPublicLabel(member: Pick<WorkspaceMember, "alias" | "displayName" | "status">) {
  return (
    normalizeAlias(member.alias) ||
    normalizeAlias(member.displayName) ||
    (String(member.status || "").toLowerCase() === "invited" ? "Invited teammate" : "Needs alias")
  );
}

export function memberManageLabel(
  member: Pick<WorkspaceMember, "alias" | "displayName" | "email" | "emailLower" | "status">,
) {
  return (
    normalizeAlias(member.alias) ||
    normalizeAlias(member.displayName) ||
    normalizeInviteEmail(member.email || member.emailLower || "") ||
    (String(member.status || "").toLowerCase() === "invited" ? "Invited teammate" : "Teammate")
  );
}

export function inviteManageLabel(invite: {
  email?: string | null;
  emailLower?: string | null;
  displayName?: string | null;
}) {
  return (
    normalizeAlias(invite.displayName) ||
    normalizeInviteEmail(invite.email || invite.emailLower || "") ||
    "Pending invite"
  );
}

export function isInvitedMember(
  member: Pick<WorkspaceMember, "status" | "userId">,
) {
  const status = String(member.status || "").toLowerCase();
  return (
    status === "invited" ||
    status === "pending" ||
    String(member.userId || "").startsWith("pending:")
  );
}

export function isJoinedWorkspaceMember(
  member: Pick<WorkspaceMember, "status" | "userId">,
) {
  const status = String(member.status || "active").toLowerCase();
  if (["removed", "rejected", "revoked", "invited", "pending"].includes(status)) return false;
  const userId = String(member.userId || "");
  return Boolean(userId) && !userId.startsWith("pending:");
}

export function joinedWorkspaceEmails(members: WorkspaceMember[] = []) {
  const emails = new Set<string>();
  for (const member of members) {
    if (!isJoinedWorkspaceMember(member)) continue;
    const email = normalizeInviteEmail(member.email || member.emailLower || "");
    if (email) emails.add(email);
  }
  return emails;
}

export function activeDirectoryMembers(members: WorkspaceMember[] = []) {
  return members.filter((member) => isAssignableMember(member) && !isInvitedMember(member));
}

export type PendingInviteRow = {
  key: string;
  email: string;
  role?: string;
  invite?: Record<string, any> | null;
  member?: WorkspaceMember | null;
  deliveryStatus?: string;
};

function preferredUsableInvite(invites: Array<Record<string, any>> = []) {
  const usable = invites.filter((invite) => inviteIsUsable(invite));
  return (
    usable.find((invite) => String(invite.inviteToken || "").trim()) ||
    usable[0] ||
    null
  );
}

export function pendingInviteDirectory(
  members: WorkspaceMember[] = [],
  invites: Array<Record<string, any>> = [],
): PendingInviteRow[] {
  const joinedEmails = joinedWorkspaceEmails(members);
  const invitesByEmail = new Map<string, Array<Record<string, any>>>();
  for (const invite of invites) {
    const email = normalizeInviteEmail(invite.email || invite.emailLower || "");
    if (!email) continue;
    const current = invitesByEmail.get(email) || [];
    current.push(invite);
    invitesByEmail.set(email, current);
  }
  const rows = new Map<string, PendingInviteRow>();
  for (const [email, emailInvites] of invitesByEmail) {
    if (joinedEmails.has(email)) continue;
    if (emailInvites.some((invite) => inviteWasConsumed(invite) && inviteStatus(invite) === "accepted")) continue;
    const invite = preferredUsableInvite(emailInvites);
    if (!invite) continue;
    rows.set(email, {
      key: String(invite.id || email),
      email,
      role: invite.role,
      invite,
      member: null,
      deliveryStatus: invite.emailDeliveryStatus,
    });
  }
  for (const member of members) {
    if (!isInvitedMember(member)) continue;
    const email = normalizeInviteEmail(member.email || member.emailLower || "");
    if (!email || joinedEmails.has(email)) continue;
    const current = rows.get(email);
    if (current) {
      current.member = member;
      current.role = current.role || member.role;
      continue;
    }
    if (invitesByEmail.has(email)) continue;
    rows.set(email, {
      key: member.id || email,
      email,
      role: member.role,
      invite: null,
      member,
    });
  }
  return [...rows.values()].sort((left, right) => left.email.localeCompare(right.email));
}

export function memberLabel(member: Pick<WorkspaceMember, "alias" | "displayName" | "status">) {
  return memberPublicLabel(member);
}

export function memberAssignmentValue(member: Pick<WorkspaceMember, "alias" | "displayName" | "status">) {
  return memberPublicLabel(member);
}

export function memberAvatar(member: Pick<WorkspaceMember, "emoji" | "alias" | "displayName">) {
  return member.emoji?.trim() ? normalizeMemberEmoji(member.emoji) : DEFAULT_MEMBER_EMOJI;
}

export function isAssignableMember(member: Pick<WorkspaceMember, "status">) {
  const status = String(member.status || "active").toLowerCase();
  return !["removed", "rejected", "revoked"].includes(status);
}

export function memberMatchesSelection(
  member: Pick<WorkspaceMember, "id" | "userId" | "alias" | "displayName" | "email" | "emailLower">,
  selectedIds: string[] = [],
  selectedNames: string[] = [],
) {
  const ids = selectedIds.map((value) => String(value));
  const names = selectedNames.map((value) => String(value).trim()).filter(Boolean);
  const publicLabel = memberPublicLabel(member);
  const email = normalizeInviteEmail(member.email || member.emailLower || "");
  return (
    ids.includes(String(member.id)) ||
    (member.userId ? ids.includes(String(member.userId)) : false) ||
    names.includes(publicLabel) ||
    names.includes(normalizeAlias(member.alias)) ||
    names.includes(normalizeAlias(member.displayName)) ||
    (email ? names.some((name) => normalizeInviteEmail(name) === email) : false)
  );
}

export function roleLabel(value?: string) {
  const role = String(value || "member").toLowerCase();
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "viewer") return "Viewer";
  return "Member";
}

export function isWorkspaceOwnerRole(value?: string) {
  return String(value || "").toLowerCase() === "owner";
}

export function canManageWorkspaceMembers(role?: string, isOwner = false) {
  if (isOwner) return true;
  const value = String(role || "").toLowerCase();
  return value === "owner" || value === "admin";
}

export function canOperateInvoices(
  role?: string,
  isOwner = false,
  financeAccess = false,
) {
  return canManageWorkspaceMembers(role, isOwner) || Boolean(financeAccess);
}

export function pendingMemberId(workspaceId: string, email: string) {
  return `${workspaceId}_invite_${normalizeInviteEmail(email).replace(/[^a-z0-9]/g, "_")}`;
}

export function activeMemberId(workspaceId: string, userId: string) {
  return `${workspaceId}_${userId}`;
}

export function memberStatusLabel(value?: string) {
  const status = String(value || "active").toLowerCase();
  if (status === "invited") return "Invited";
  if (status === "accepted") return "Accepted";
  if (status === "removed") return "Removed";
  return "Active";
}

export function canChangePasswordForProvider(providerIds: string[] = []) {
  return providerIds.includes("password");
}

export function passwordProviderMessage(providerIds: string[] = []) {
  if (canChangePasswordForProvider(providerIds)) {
    return "Send a secure reset link to change the password for this email/password account.";
  }
  if (providerIds.includes("google.com")) {
    return "This account signs in with Google. Change the password in Google Account settings.";
  }
  return "Password changes depend on the sign-in provider for this account.";
}

export function createInviteCode() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function membershipPublicPatch(input: {
  displayName?: string | null;
  alias?: string | null;
  emoji?: string | null;
}) {
  const alias = normalizeAlias(input.alias) || normalizeAlias(input.displayName);
  const patch: Record<string, string> = {
    emoji: normalizeMemberEmoji(input.emoji),
  };
  if (alias) {
    patch.alias = alias;
    patch.displayName = alias;
  }
  return patch;
}
