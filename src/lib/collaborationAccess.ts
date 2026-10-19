import {
  memberAssignmentValue,
  normalizeInviteEmail,
  type WorkspaceMember,
} from "./workspaceCollaboration";

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

export const PROJECT_ASSIGNEE_SHARE_HINT =
  "Adding someone shares the whole project. They can see every item, not only this task.";

const CLOSED_MEMBER_STATUSES = new Set(["removed", "rejected", "revoked"]);

function memberShareName(
  member: CollaborationMember & {
    alias?: string | null;
    displayName?: string | null;
    name?: string | null;
  },
) {
  return String(
    member.alias || member.displayName || member.name || shareableEmail(member) || "",
  ).trim();
}

function memberMatchesAssignmentLabel(
  member: CollaborationMember & {
    alias?: string | null;
    displayName?: string | null;
    name?: string | null;
  },
  label: string,
) {
  const needle = label.trim().toLowerCase();
  if (!needle) return false;
  const values = [
    memberAssignmentValue({
      alias: member.alias || undefined,
      displayName: member.displayName || undefined,
      email: member.email,
      emailLower: member.emailLower,
      status: member.status,
    }),
    member.alias,
    member.displayName,
    member.name,
    member.email,
    member.emailLower,
    shareableEmail(member),
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return values.includes(needle);
}

/** People already on an item: assignee ids, collaborator ids, or a saved assignee name. */
export function peopleAssignedOnItems(
  items: Array<Record<string, unknown>>,
  members: CollaborationMember[] = [],
) {
  const openMembers = members.filter(
    (member) => !CLOSED_MEMBER_STATUSES.has(String(member.status || "").toLowerCase()),
  );
  const byId = new Map(openMembers.map((member) => [String(member.id || ""), member]));
  const found = new Map<string, { id: string; name: string }>();
  const remember = (member: CollaborationMember | undefined) => {
    const id = String(member?.id || "").trim();
    if (!member || !id || found.has(id)) return;
    found.set(id, { id, name: memberShareName(member) });
  };
  for (const item of items) {
    const ids = unique([
      ...asIdList(item.assigneeIds),
      ...asIdList(item.collaboratorMemberIds),
      String(item.assigneeId || ""),
    ]);
    for (const id of ids) remember(byId.get(id));
    const labels = unique([
      ...asIdList(item.assignees),
      ...asIdList(item.collaborators),
      String(item.owner || ""),
      String(item.assignee || ""),
    ]);
    for (const label of labels) {
      remember(openMembers.find((member) => memberMatchesAssignmentLabel(member, label)));
    }
  }
  return [...found.values()];
}

/**
 * Add people to the project without removing anyone already on it.
 * Returns null when every id is already a project member.
 */
export function mergeProjectMembers(
  project: { teamMemberIds?: unknown; teamMembers?: unknown } | null | undefined,
  additions: Array<{ id?: string | null; name?: string | null }>,
) {
  const ids = asIdList(project?.teamMemberIds);
  const names = asIdList(project?.teamMembers);
  const known = new Set(ids);
  let changed = false;
  for (const addition of additions) {
    const id = String(addition.id || "").trim();
    if (!id || known.has(id)) continue;
    known.add(id);
    ids.push(id);
    const name = String(addition.name || "").trim();
    if (name && !names.includes(name)) names.push(name);
    changed = true;
  }
  if (!changed) return null;
  return { teamMemberIds: ids, teamMembers: names };
}

/** Share the whole project with anyone already assigned on these items. */
export function projectSharePatchForItems(
  project: { teamMemberIds?: unknown; teamMembers?: unknown } | null | undefined,
  items: Array<Record<string, unknown>>,
  members: CollaborationMember[] = [],
) {
  return mergeProjectMembers(project, peopleAssignedOnItems(items, members));
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
