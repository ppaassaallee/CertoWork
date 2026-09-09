import {
  memberMatchesSelection,
  memberPublicLabel,
  normalizeInviteEmail,
  normalizeAlias,
  type WorkspaceMember,
} from "./workspaceCollaboration";
import type { CollaborationMember } from "./collaborationAccess";

export const ASSIGNMENT_FIELD_KEYS = [
  "assigneeIds",
  "assignees",
  "assignee",
  "owner",
  "assigneeId",
  "assignedTo",
] as const;

export const COLLABORATOR_FIELD_KEYS = [
  "collaboratorMemberIds",
  "collaboratorIds",
  "followers",
  "followerIds",
] as const;

export function patchTouchesAssignment(patch: Record<string, unknown> | null | undefined) {
  if (!patch) return false;
  return ASSIGNMENT_FIELD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}

export function patchTouchesCollaborators(patch: Record<string, unknown> | null | undefined) {
  if (!patch) return false;
  return COLLABORATOR_FIELD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
}

/** Stable label for task assignee arrays — prefer email over generic placeholders. */
export function memberAssigneeLabel(
  member: Pick<WorkspaceMember, "alias" | "displayName" | "email" | "emailLower" | "status">,
) {
  return (
    normalizeAlias(member.alias) ||
    normalizeAlias(member.displayName) ||
    normalizeInviteEmail(member.email || member.emailLower || "") ||
    memberPublicLabel(member)
  );
}

/** Certo model: exactly one primary assignee (0–1 ids). Extra members belong in collaborators. */
export function assignmentFieldsFromMembers(members: WorkspaceMember[] = []) {
  const primary = members[0];
  if (!primary) {
    return {
      assigneeIds: [] as string[],
      assignees: [] as string[],
      owner: "",
      assignee: "",
      assigneeId: "",
    };
  }
  const label = memberAssigneeLabel(primary);
  return {
    assigneeIds: [String(primary.id)],
    assignees: [label].filter(Boolean),
    owner: label || "",
    assignee: label || "",
    assigneeId: String(primary.id),
  };
}

export function collaboratorFieldsFromMembers(members: WorkspaceMember[] = []) {
  const labels = members.map((member) => memberAssigneeLabel(member)).filter(Boolean);
  return {
    collaboratorMemberIds: members.map((member) => String(member.id)),
    collaborators: labels,
  };
}

export function itemCollaboratorMemberIds(item: Record<string, unknown> | null | undefined) {
  if (!item) return [] as string[];
  const fromExplicit = Array.isArray(item.collaboratorMemberIds)
    ? item.collaboratorMemberIds.map((itemId) => String(itemId || "")).filter(Boolean)
    : [];
  if (fromExplicit.length) return [...new Set(fromExplicit)];
  const legacyFollowers = Array.isArray(item.followerIds)
    ? item.followerIds.map((itemId) => String(itemId || "")).filter(Boolean)
    : [];
  return [...new Set(legacyFollowers)];
}

/**
 * When legacy multi-assignee data exists, keep the first as assignee and move the rest
 * into collaborators (without dropping existing collaboratorMemberIds).
 */
export function splitMultiAssigneeToCollaborators(
  item: Record<string, unknown>,
  members: WorkspaceMember[] = [],
) {
  const ids = Array.isArray(item.assigneeIds)
    ? item.assigneeIds.map((itemId) => String(itemId || "")).filter(Boolean)
    : [];
  if (ids.length <= 1) return null;
  const [primaryId, ...extraIds] = ids;
  const primary = members.find((member) => member.id === primaryId);
  const extras = members.filter((member) => extraIds.includes(String(member.id)));
  const existing = itemCollaboratorMemberIds(item);
  const collaboratorIds = [...new Set([...existing, ...extraIds])];
  return {
    ...(primary
      ? assignmentFieldsFromMembers([primary])
      : {
          assigneeIds: [primaryId],
          assignees: [String(item.assignee || item.owner || "")].filter(Boolean),
          owner: String(item.owner || item.assignee || ""),
          assignee: String(item.assignee || item.owner || ""),
          assigneeId: primaryId,
        }),
    collaboratorMemberIds: collaboratorIds,
    collaborators: extras.length
      ? extras.map((member) => memberAssigneeLabel(member))
      : collaboratorIds,
  };
}

export function resolveAssigneeSwimlanePatch(
  swimlaneKey: string,
  members: WorkspaceMember[] = [],
): Record<string, unknown> {
  if (!swimlaneKey || swimlaneKey === "Unassigned") {
    return { assignee: "", owner: "", assignees: [], assigneeIds: [], assigneeId: "" };
  }
  const matched = members.filter((member) =>
    memberMatchesSelection(member, [], [swimlaneKey]),
  );
  if (matched.length) return assignmentFieldsFromMembers(matched.slice(0, 1));
  return {
    assignee: swimlaneKey,
    owner: swimlaneKey,
    assignees: [swimlaneKey],
    assigneeIds: [],
    assigneeId: "",
  };
}

export function resolveAssigneeNamePatch(
  assigneeName: string,
  members: WorkspaceMember[] = [],
  _currentAssignees: string[] = [],
): Record<string, unknown> {
  const matched = members.filter((member) =>
    memberMatchesSelection(member, [], [assigneeName]),
  );
  if (matched.length) {
    return assignmentFieldsFromMembers(matched.slice(0, 1));
  }
  return {
    assignee: assigneeName,
    owner: assigneeName,
    assignees: [assigneeName].filter(Boolean),
    assigneeIds: [],
    assigneeId: "",
  };
}

/**
 * Normalize an assignment-touching patch so Firestore never keeps stale assigneeIds
 * when only names change, and always stores a single primary assignee.
 */
export function normalizeAssignmentPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  members: WorkspaceMember[] = [],
): Record<string, unknown> {
  if (!patchTouchesAssignment(patch)) return { ...patch };

  const hasIds = Object.prototype.hasOwnProperty.call(patch, "assigneeIds");
  if (hasIds) {
    const ids = Array.isArray(patch.assigneeIds)
      ? patch.assigneeIds.map((item) => String(item || "")).filter(Boolean)
      : [];
    if (!ids.length) {
      return {
        ...patch,
        assigneeIds: [],
        assignees: [],
        assignee: "",
        owner: "",
        assigneeId: "",
      };
    }
    const primaryId = ids[0];
    const extras = ids.slice(1);
    const matched = members.find(
      (member) =>
        String(member.id) === primaryId ||
        (member.userId ? String(member.userId) === primaryId : false),
    );
    const labels = Array.isArray(patch.assignees)
      ? patch.assignees.map((item) => String(item || "").trim()).filter(Boolean)
      : [String(patch.assignee || patch.owner || "").trim()].filter(Boolean);
    const assignment = matched
      ? assignmentFieldsFromMembers([matched])
      : {
          assigneeIds: [primaryId],
          assignees: labels.slice(0, 1),
          assignee: labels[0] || "",
          owner: labels[0] || "",
          assigneeId: primaryId,
        };

    if (!extras.length) return { ...patch, ...assignment };

    const existingCollaborators = itemCollaboratorMemberIds({
      ...current,
      ...patch,
    });
    return {
      ...patch,
      ...assignment,
      collaboratorMemberIds: [...new Set([...existingCollaborators, ...extras])],
    };
  }

  const primary = String(patch.assignee || patch.owner || "").trim();
  const names = Array.isArray(patch.assignees)
    ? patch.assignees.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!primary && !names.length) {
    return {
      ...patch,
      assigneeIds: [],
      assignees: [],
      assignee: "",
      owner: "",
      assigneeId: "",
    };
  }

  return {
    ...patch,
    ...resolveAssigneeNamePatch(primary || names[0], members, names),
  };
}

export function normalizeCollaboratorsPatch(
  patch: Record<string, unknown>,
  members: WorkspaceMember[] = [],
): Record<string, unknown> {
  if (!patchTouchesCollaborators(patch)) return { ...patch };
  const ids = Array.isArray(patch.collaboratorMemberIds)
    ? patch.collaboratorMemberIds.map((item) => String(item || "")).filter(Boolean)
    : Array.isArray(patch.followerIds)
      ? patch.followerIds.map((item) => String(item || "")).filter(Boolean)
      : [];
  const matched = members.filter(
    (member) =>
      ids.includes(String(member.id)) ||
      (member.userId ? ids.includes(String(member.userId)) : false),
  );
  if (matched.length) return { ...patch, ...collaboratorFieldsFromMembers(matched) };
  return {
    ...patch,
    collaboratorMemberIds: ids,
    collaborators: Array.isArray(patch.collaborators)
      ? patch.collaborators.map(String)
      : [],
  };
}

export function assignmentDiff(
  previous: { assigneeIds?: unknown } | null | undefined,
  next: { assigneeIds?: unknown } | null | undefined,
) {
  const before = new Set(
    (Array.isArray(previous?.assigneeIds) ? previous!.assigneeIds : []).map((item) => String(item)),
  );
  const after = new Set(
    (Array.isArray(next?.assigneeIds) ? next!.assigneeIds : []).map((item) => String(item)),
  );
  const added = [...after].filter((id) => id && !before.has(id));
  const removed = [...before].filter((id) => id && !after.has(id));
  return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

export function collaboratorDiff(
  previous: { collaboratorMemberIds?: unknown; followerIds?: unknown } | null | undefined,
  next: { collaboratorMemberIds?: unknown; followerIds?: unknown } | null | undefined,
) {
  const before = new Set(itemCollaboratorMemberIds(previous as Record<string, unknown>));
  const after = new Set(itemCollaboratorMemberIds(next as Record<string, unknown>));
  const added = [...after].filter((id) => id && !before.has(id));
  const removed = [...before].filter((id) => id && !after.has(id));
  return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

export function buildAssignmentNotificationDocs({
  taskId,
  taskTitle,
  workspaceId,
  assignedByUserId,
  assignedByName,
  members,
  addedMemberIds,
  type = "task_assigned",
}: {
  taskId: string;
  taskTitle: string;
  workspaceId: string;
  assignedByUserId: string;
  assignedByName?: string | null;
  members: CollaborationMember[];
  addedMemberIds: string[];
  type?: "task_assigned" | "task_collaborator";
}) {
  const selected = new Set(addedMemberIds.map(String));
  return members
    .filter((member) => selected.has(String(member.id)) || selected.has(String(member.userId || "")))
    .filter((member) => {
      const uid = String(member.userId || "");
      return uid && uid !== assignedByUserId && !uid.startsWith("pending:");
    })
    .map((member) => ({
      type,
      taskId,
      taskTitle,
      workspaceId,
      userId: String(member.userId),
      memberId: String(member.id || ""),
      email: normalizeInviteEmail(member.email || member.emailLower || ""),
      assignedByUserId,
      assignedByName: assignedByName || "",
      read: false,
      createdAt: new Date().toISOString(),
    }));
}

export function remapAssigneeIds(
  values: unknown,
  fromId: string,
  toId: string,
) {
  if (!fromId || !toId || !Array.isArray(values)) return Array.isArray(values) ? values.map(String) : [];
  return [...new Set(values.map((item) => {
    const value = String(item || "");
    return value === fromId ? toId : value;
  }).filter(Boolean))];
}

const ARRAY_ID_FIELDS = [
  "assigneeIds",
  "accessMemberIds",
  "teamMemberIds",
  "sponsorIds",
  "collaboratorMemberIds",
  "followerIds",
] as const;

const SCALAR_ID_FIELDS = [
  "assigneeId",
  "projectManagerId",
  "productOwnerId",
  "sponsorId",
] as const;

/** Pure remap of pending member id → active member id on a task/project record. */
export function buildMemberIdRemapPatch(
  record: Record<string, unknown>,
  fromId: string,
  toId: string,
  extras?: { userId?: string; email?: string },
): Record<string, unknown> | null {
  if (!fromId || !toId || fromId === toId) return null;
  const patch: Record<string, unknown> = {};
  let changed = false;

  for (const field of ARRAY_ID_FIELDS) {
    const before = Array.isArray(record[field])
      ? (record[field] as unknown[]).map((item) => String(item || "")).filter(Boolean)
      : [];
    if (!before.includes(fromId)) continue;
    patch[field] = remapAssigneeIds(before, fromId, toId);
    changed = true;
  }

  for (const field of SCALAR_ID_FIELDS) {
    if (String(record[field] || "") === fromId) {
      patch[field] = toId;
      changed = true;
    }
  }

  if (extras?.userId) {
    const userId = String(extras.userId);
    const visible = Array.isArray(record.visibleToUserIds)
      ? (record.visibleToUserIds as unknown[]).map(String)
      : [];
    const shared = Array.isArray(record.sharedWithUserIds)
      ? (record.sharedWithUserIds as unknown[]).map(String)
      : [];
    if (userId && !visible.includes(userId)) {
      patch.visibleToUserIds = [...new Set([...visible, userId])];
      changed = true;
    }
    if (userId && !shared.includes(userId)) {
      patch.sharedWithUserIds = [...new Set([...shared, userId])];
      changed = true;
    }
  }

  if (extras?.email) {
    const email = normalizeInviteEmail(extras.email);
    const emails = Array.isArray(record.visibleToEmails)
      ? (record.visibleToEmails as unknown[]).map((item) => normalizeInviteEmail(String(item)))
      : [];
    if (email && !emails.includes(email)) {
      patch.visibleToEmails = [...new Set([...emails, email])];
      changed = true;
    }
  }

  return changed ? patch : null;
}
