import { normalizeInviteEmail, type WorkspaceMember } from "./workspaceCollaboration";

export type CollaborationMember = Pick<
  WorkspaceMember,
  "id" | "userId" | "email" | "emailLower" | "status"
>;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function asIdList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

export function isPendingUserId(value?: string | null) {
  return String(value || "").startsWith("pending:");
}

export function isShareableAuthUserId(value?: string | null) {
  const id = String(value || "").trim();
  return Boolean(id) && !isPendingUserId(id) && !id.includes("@") && !id.includes(":");
}

export function shareableAuthUserId(member?: CollaborationMember | null) {
  if (!member) return "";
  const status = String(member.status || "active").toLowerCase();
  if (["removed", "rejected", "revoked", "invited"].includes(status)) return "";
  return isShareableAuthUserId(member.userId) ? String(member.userId) : "";
}

export function shareableEmail(member?: CollaborationMember | null) {
  return normalizeInviteEmail(member?.emailLower || member?.email || "");
}

export function collaborationShareGrant(member: CollaborationMember) {
  return {
    memberId: String(member.id || ""),
    userId: shareableAuthUserId(member),
    email: shareableEmail(member),
  };
}

export function collaboratorAccessFromMembers(
  members: CollaborationMember[] = [],
  selectedIds: string[] = [],
) {
  const selected = new Set(selectedIds.map((value) => String(value)));
  const matched = members.filter(
    (member) => selected.has(String(member.id || "")) || selected.has(String(member.userId || "")),
  );
  return {
    memberIds: unique(matched.map((member) => String(member.id || ""))),
    userIds: unique(matched.map(shareableAuthUserId)),
    emails: unique(matched.map(shareableEmail)),
  };
}

export function withCollaboratorAccess(
  current: {
    visibleToUserIds?: unknown;
    visibleToEmails?: unknown;
    sharedWithUserIds?: unknown;
  },
  grant: { userId?: string | null; email?: string | null },
) {
  return {
    visibleToUserIds: unique([...asIdList(current.visibleToUserIds), grant.userId]),
    visibleToEmails: unique([
      ...asIdList(current.visibleToEmails).map((item) => normalizeInviteEmail(item)),
      grant.email,
    ]),
    sharedWithUserIds: unique([...asIdList(current.sharedWithUserIds), grant.userId]),
  };
}

export function replaceAccessId(values: unknown, fromId: string, toId: string) {
  const next = asIdList(values).map((item) => (fromId && item === fromId ? toId : item));
  return unique(next);
}

export function buildProjectCollaboratorAccessPatch({
  project,
  members = [],
  actorUserId,
  actorEmail,
}: {
  project?: Record<string, unknown> | null;
  members?: CollaborationMember[];
  actorUserId?: string | null;
  actorEmail?: string | null;
}) {
  const record = project || {};
  const selectedIds = unique([
    ...asIdList(record.teamMemberIds),
    ...asIdList(record.sponsorIds),
    String(record.projectManagerId || ""),
    String(record.productOwnerId || ""),
    String(record.sponsorId || ""),
  ]);
  const collab = collaboratorAccessFromMembers(members, selectedIds);
  return {
    visibleToUserIds: unique([
      actorUserId,
      ...asIdList(record.visibleToUserIds),
      ...collab.userIds,
    ]),
    visibleToEmails: unique([
      actorEmail,
      ...asIdList(record.visibleToEmails).map((item) => normalizeInviteEmail(item)),
      ...collab.emails,
    ]),
    sharedWithUserIds: unique([...asIdList(record.sharedWithUserIds), ...collab.userIds]),
  };
}
