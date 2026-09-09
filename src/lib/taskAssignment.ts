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

export function patchTouchesAssignment(patch: Record<string, unknown> | null | undefined) {
  if (!patch) return false;
  return ASSIGNMENT_FIELD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
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

export function assignmentFieldsFromMembers(members: WorkspaceMember[] = []) {
  const labels = members.map((member) => memberAssigneeLabel(member)).filter(Boolean);
  return {
    assigneeIds: members.map((member) => String(member.id)),
    assignees: labels,
    owner: labels[0] || "",
    assignee: labels[0] || "",
  };
}

export function resolveAssigneeSwimlanePatch(
  swimlaneKey: string,
  members: WorkspaceMember[] = [],
): Record<string, unknown> {
  if (!swimlaneKey || swimlaneKey === "Unassigned") {
    return { assignee: "", owner: "", assignees: [], assigneeIds: [] };
  }
  const matched = members.filter((member) =>
    memberMatchesSelection(member, [], [swimlaneKey]),
  );
  if (matched.length) return assignmentFieldsFromMembers(matched);
  return { assignee: swimlaneKey, owner: swimlaneKey, assignees: [swimlaneKey], assigneeIds: [] };
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
    return assignmentFieldsFromMembers(matched);
  }
  return {
    assignee: assigneeName,
    owner: assigneeName,
    assignees: [assigneeName].filter(Boolean),
    assigneeIds: [],
  };
}

/**
 * Normalize an assignment-touching patch so Firestore never keeps stale assigneeIds
 * when only names change (kanban swimlane / automation), and always stores
 * canonical labels for known members.
 */
export function normalizeAssignmentPatch(
  _current: Record<string, unknown>,
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
      };
    }
    const matched = members.filter(
      (member) =>
        ids.includes(String(member.id)) ||
        (member.userId ? ids.includes(String(member.userId)) : false),
    );
    if (matched.length) {
      return { ...patch, ...assignmentFieldsFromMembers(matched) };
    }
    const labels = Array.isArray(patch.assignees)
      ? patch.assignees.map((item) => String(item || "").trim()).filter(Boolean)
      : [String(patch.assignee || patch.owner || "").trim()].filter(Boolean);
    return {
      ...patch,
      assigneeIds: ids,
      assignees: labels,
      assignee: labels[0] || "",
      owner: labels[0] || "",
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
    };
  }

  return {
    ...patch,
    ...resolveAssigneeNamePatch(primary || names[0], members, names),
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

export function buildAssignmentNotificationDocs({
  taskId,
  taskTitle,
  workspaceId,
  assignedByUserId,
  assignedByName,
  members,
  addedMemberIds,
}: {
  taskId: string;
  taskTitle: string;
  workspaceId: string;
  assignedByUserId: string;
  assignedByName?: string | null;
  members: CollaborationMember[];
  addedMemberIds: string[];
}) {
  const selected = new Set(addedMemberIds.map(String));
  return members
    .filter((member) => selected.has(String(member.id)) || selected.has(String(member.userId || "")))
    .filter((member) => {
      const uid = String(member.userId || "");
      return uid && uid !== assignedByUserId && !uid.startsWith("pending:");
    })
    .map((member) => ({
      type: "task_assigned" as const,
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
