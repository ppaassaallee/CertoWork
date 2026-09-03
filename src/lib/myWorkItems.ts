import { isTodayTask, priorityRank } from "./appleWidget";
import type { MyWorkSection } from "./delivereeRoutes";
import { isCapturedWorkItem, needsCaptureReview } from "./captureRequests";
import { dateKey, isClosed, localDateKey } from "./workspaceDisplay";
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

function saturdayNoonFor(value: Date) {
  const target = new Date(value);
  target.setHours(12, 0, 0, 0);
  const day = target.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  target.setDate(target.getDate() + daysUntilSaturday);
  return target;
}

export function isThisWeekTask(
  item: Record<string, unknown> | null | undefined,
  now = new Date(),
) {
  if (!item || isClosed(String(item.status || ""))) return false;
  const sector = String(item.timeSector || "").toLowerCase();
  const expiresRaw = item.timeSectorExpiresAt as any;
  if (sector === "this_week") {
    if (expiresRaw?.toDate && expiresRaw.toDate().getTime() < now.getTime()) return false;
    if (typeof expiresRaw === "string" && Date.parse(expiresRaw) < now.getTime()) return false;
    return true;
  }
  const due = dateKey(item.dueDate || item.targetDate);
  if (!due) return false;
  const today = localDateKey(now);
  const weekEnd = localDateKey(saturdayNoonFor(now));
  return due >= today && due <= weekEnd;
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
  if (section === "today") {
    return mine.filter((item) => isTodayTask(item));
  }
  if (section === "this_week") {
    return mine.filter((item) => isThisWeekTask(item));
  }
  if (section === "captured") {
    return mine.filter((item) => isCapturedWorkItem(item) || needsCaptureReview(item));
  }
  return mine.filter((item) => !isWaitingWorkItem(item));
}

export function todayPlanGroups(items: Array<Record<string, unknown>> = []) {
  const sorted = [...items].sort((left, right) => {
    const rank =
      priorityRank(left?.priority, Boolean(left?.isOneThing)) -
      priorityRank(right?.priority, Boolean(right?.isOneThing));
    if (rank) return rank;
    return String(left?.title || left?.name || "").localeCompare(String(right?.title || right?.name || ""));
  });
  const mustFromPriority = sorted
    .filter((item) => priorityRank(item?.priority, Boolean(item?.isOneThing)) === 1)
    .slice(0, 2);
  const mustDos = mustFromPriority.length > 0 ? mustFromPriority : sorted.slice(0, 2);
  const mustIds = new Set(mustDos.map((item) => String(item.id || "")));
  const remaining = sorted.filter((item) => !mustIds.has(String(item.id || "")));
  const shouldFromPriority = remaining
    .filter((item) => priorityRank(item?.priority, Boolean(item?.isOneThing)) === 2)
    .slice(0, 8);
  const shouldDos = shouldFromPriority.length > 0 ? shouldFromPriority : remaining.slice(0, 8);
  const shouldIds = new Set(shouldDos.map((item) => String(item.id || "")));
  const couldDos = remaining.filter((item) => !shouldIds.has(String(item.id || "")));
  return { mustDos, shouldDos, couldDos };
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
