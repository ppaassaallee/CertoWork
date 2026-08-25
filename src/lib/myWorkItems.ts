import type { MyWorkSection } from "./delivereeRoutes";
import {
  memberMatchesSelection,
  memberPublicLabel,
  type WorkspaceMember,
} from "./workspaceCollaboration";

export type MyWorkActor = {
  userId: string;
  memberId?: string | null;
  email?: string | null;
};

const PLACEHOLDER_TOKENS = new Set([
  "",
  "unassigned",
  "unassig...",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
]);

function asList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (value == null) return [];
  const text = String(value).trim();
  return text ? [text] : [];
}

function isPlaceholderToken(value: string) {
  return PLACEHOLDER_TOKENS.has(value.trim().toLowerCase());
}

function assignmentTokens(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter((value) => value && !isPlaceholderToken(value));
}

export function itemAssigneeIds(item: Record<string, unknown> | null | undefined) {
  if (!item) return [];
  return assignmentTokens([
    ...asList(item.assigneeIds),
    ...asList(item.assigneeId),
    ...asList(item.assignedTo),
  ]);
}

export function itemAssigneeLabels(item: Record<string, unknown> | null | undefined) {
  if (!item) return [];
  return assignmentTokens([
    ...asList(item.assignees),
    ...asList(item.owner),
    ...asList(item.assignee),
    ...asList(item.assigneeEmails),
  ]);
}

export function itemHasAssignees(item: Record<string, unknown> | null | undefined) {
  return itemAssigneeIds(item).length > 0 || itemAssigneeLabels(item).length > 0;
}

function actorMember(actor: MyWorkActor, members: WorkspaceMember[] = []) {
  return (
    members.find(
      (member) =>
        (actor.userId && member.userId === actor.userId) ||
        (actor.memberId && member.id === actor.memberId),
    ) || null
  );
}

export function isAssignedToActor(
  item: Record<string, unknown> | null | undefined,
  actor: MyWorkActor,
  members: WorkspaceMember[] = [],
) {
  if (!item || !actor.userId) return false;
  const ids = itemAssigneeIds(item);
  const names = itemAssigneeLabels(item);
  const member = actorMember(actor, members);
  if (member && memberMatchesSelection(member, ids, names)) return true;

  const tokens = new Set(
    [
      actor.userId,
      actor.memberId,
      String(actor.email || "").trim().toLowerCase(),
      member?.id,
      member?.userId,
      member ? memberPublicLabel(member) : "",
      String(member?.email || member?.emailLower || "").trim().toLowerCase(),
    ]
      .map((value) => String(value || "").trim())
      .filter((value) => value && !isPlaceholderToken(value)),
  );

  return [...ids, ...names].some((value) => {
    const lowered = value.toLowerCase();
    return tokens.has(value) || tokens.has(lowered);
  });
}

export function isCreatedByActor(
  item: Record<string, unknown> | null | undefined,
  actor: MyWorkActor,
) {
  if (!item || !actor.userId) return false;
  return [item.createdBy, item.userId].some((value) => String(value || "") === actor.userId);
}

export function isWaitingWorkItem(item: Record<string, unknown> | null | undefined) {
  const value = String(
    item?.gtdActionType || item?.actionType || item?.globalStageId || "",
  ).toLowerCase();
  return value === "waiting" || value === "waiting_for" || value === "delegated";
}

/** My Work is a view. It never deletes records. */
export function isMyWorkItem(
  item: Record<string, unknown> | null | undefined,
  actor: MyWorkActor,
  members: WorkspaceMember[] = [],
) {
  return isAssignedToActor(item, actor, members) || isCreatedByActor(item, actor);
}

export function isMyWorkInboxItem(
  item: Record<string, unknown> | null | undefined,
  actor: MyWorkActor,
  members: WorkspaceMember[] = [],
) {
  return isMyWorkItem(item, actor, members) && !itemHasAssignees(item) && !isWaitingWorkItem(item);
}

export function isMyWorkAssignedItem(
  item: Record<string, unknown> | null | undefined,
  actor: MyWorkActor,
  members: WorkspaceMember[] = [],
) {
  return isMyWorkItem(item, actor, members);
}

export function filterMyWorkTasks(
  tasks: Array<Record<string, unknown>> = [],
  section: MyWorkSection,
  actor: MyWorkActor,
  members: WorkspaceMember[] = [],
) {
  const mine = tasks.filter((item) => isMyWorkItem(item, actor, members));
  if (section === "waiting") {
    return mine.filter((item) => isWaitingWorkItem(item));
  }
  if (section === "inbox") {
    return mine.filter((item) => isMyWorkInboxItem(item, actor, members));
  }
  return mine.filter((item) => !isWaitingWorkItem(item));
}

export function needsCreatorAssigneeRestore(
  item: Record<string, unknown> | null | undefined,
  actor: MyWorkActor,
) {
  return Boolean(item?.id) && isCreatedByActor(item, actor) && !itemHasAssignees(item);
}

export function creatorAssigneePatch(actor: MyWorkActor, members: WorkspaceMember[] = []) {
  const member = actorMember(actor, members);
  const assigneeId = String(member?.id || actor.memberId || "").trim();
  const name = member ? memberPublicLabel(member) : "";
  return {
    assigneeIds: assigneeId ? [assigneeId] : [],
    assignees: name ? [name] : [],
    owner: name,
    assignee: name,
    assigneeId: assigneeId || null,
  };
}

export function withCreatorAssignee<T extends Record<string, unknown>>(
  patch: T,
  actor: MyWorkActor,
  members: WorkspaceMember[] = [],
): T {
  if (itemHasAssignees(patch)) return patch;
  return {
    ...patch,
    ...creatorAssigneePatch(actor, members),
  };
}
