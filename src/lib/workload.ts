import type { MyWorkActor } from "./myWorkItems";
import { isClosed, localDateKey } from "./workspaceDisplay";
import {
  memberPublicLabel,
  normalizeAlias,
  normalizeInviteEmail,
} from "./workspaceCollaboration";

export type WorkloadItem = {
  id: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  projectId: string | null;
  projectTitle: string;
  dueDate: string | null;
  estimateHours: number;
  status: string;
};

export type WorkloadPersonRow = {
  assigneeId: string;
  assigneeName: string;
  itemCount: number;
  estimateHours: number;
  capacityHours: number;
  loadRatio: number;
  overdueCount: number;
  items: WorkloadItem[];
};

export type WorkloadMember = {
  id?: string;
  userId?: string;
  acceptedMemberId?: string;
  acceptedUserId?: string;
  displayName?: string;
  email?: string;
  emailLower?: string;
  name?: string;
  alias?: string;
  weeklyCapacityHours?: number;
  capacityHours?: number;
};

export type MemberIdentity = {
  canonicalId: string;
  name: string;
  capacityHours: number;
};

function startOfWeek(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(now: Date): Date {
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function dueKey(task: any): string | null {
  const raw = task.dueDate || task.targetDate || task.endDate || null;
  if (!raw) return null;
  if (typeof raw === "string") return raw.slice(0, 10);
  if (raw?.toDate) return raw.toDate().toISOString().slice(0, 10);
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function inThisWeek(due: string | null, now: Date): boolean {
  if (!due) return false;
  const start = localDateKey(startOfWeek(now));
  const end = localDateKey(endOfWeek(now));
  return due >= start && due <= end;
}

function memberDisplayName(member: WorkloadMember): string {
  return (
    normalizeAlias(member.alias) ||
    normalizeAlias(member.displayName) ||
    normalizeAlias(member.name) ||
    memberPublicLabel(member as never) ||
    normalizeInviteEmail(member.email || member.emailLower || "") ||
    String(member.id || member.userId || "Member")
  );
}

function memberCapacityHours(member: WorkloadMember, fallback: number): number {
  const raw = Number(member.weeklyCapacityHours ?? member.capacityHours ?? fallback);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** Index every known seat / uid / email / label → one person. */
export function buildMemberIdentityMap(
  members: WorkloadMember[] = [],
  capacityFallback = 40,
): Map<string, MemberIdentity> {
  const map = new Map<string, MemberIdentity>();

  const index = (raw: unknown, identity: MemberIdentity) => {
    const key = String(raw || "").trim();
    if (!key) return;
    map.set(key, identity);
    map.set(key.toLowerCase(), identity);
  };

  for (const member of members) {
    const canonicalId = String(member.id || member.userId || "").trim();
    if (!canonicalId) continue;
    const identity: MemberIdentity = {
      canonicalId,
      name: memberDisplayName(member),
      capacityHours: memberCapacityHours(member, capacityFallback),
    };
    index(member.id, identity);
    index(member.userId, identity);
    index(member.acceptedMemberId, identity);
    index(member.acceptedUserId, identity);
    index(member.email, identity);
    index(member.emailLower, identity);
    index(member.alias, identity);
    index(member.displayName, identity);
    index(member.name, identity);
    index(memberPublicLabel(member as never), identity);
  }

  return map;
}

export function resolveMemberIdentity(
  token: string,
  identities: Map<string, MemberIdentity>,
): MemberIdentity | null {
  const key = String(token || "").trim();
  if (!key) return null;
  return identities.get(key) || identities.get(key.toLowerCase()) || null;
}

/**
 * Primary assignee tokens only. Prefer assigneeIds / assigneeId.
 * Fall back to owner/assignee labels only when no id is present — avoids
 * duplicating the same person under both a member id and a display name.
 */
export function primaryAssigneeTokens(task: any): string[] {
  const ids = [
    ...(Array.isArray(task?.assigneeIds) ? task.assigneeIds : []),
    task?.assigneeId,
    task?.assignedTo,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (ids.length) return Array.from(new Set(ids));

  const labels = [task?.ownerId, task?.owner, task?.assignee]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return Array.from(new Set(labels));
}

export function buildWorkloadRows(input: {
  tasks: any[];
  projects: any[];
  members: WorkloadMember[];
  capacityHoursPerPerson?: number;
  now?: Date;
  actor?: MyWorkActor | null;
  /** When estimates are missing, count each open item as this many hours (default 1). */
  hoursPerItemFallback?: number;
}): WorkloadPersonRow[] {
  const now = input.now || new Date();
  const capacity = input.capacityHoursPerPerson ?? 40;
  const hoursPerItem = input.hoursPerItemFallback ?? 1;
  const projectTitle = new Map(
    input.projects.map((project) => [
      String(project.id),
      String(project.title || project.name || project.id),
    ]),
  );
  const identities = buildMemberIdentityMap(input.members, capacity);

  const today = localDateKey(now);
  const byPerson = new Map<string, WorkloadItem[]>();

  for (const task of input.tasks) {
    if (isClosed(task.status)) continue;
    const due = dueKey(task);
    const overdue = Boolean(due && due < today);
    if (!inThisWeek(due, now) && !overdue) continue;

    const tokens = primaryAssigneeTokens(task);
    const targets = tokens.length ? tokens : ["unassigned"];
    const seenCanonical = new Set<string>();

    for (const token of targets) {
      const identity = resolveMemberIdentity(token, identities);
      const assigneeId =
        token === "unassigned"
          ? "unassigned"
          : identity?.canonicalId || token;
      if (seenCanonical.has(assigneeId)) continue;
      seenCanonical.add(assigneeId);

      const explicitHours = Number(task.estimateHours || task.estimatedHours || 0) || 0;
      const item: WorkloadItem = {
        id: String(task.id),
        title: String(task.title || task.name || "Untitled"),
        assigneeId,
        assigneeName:
          assigneeId === "unassigned"
            ? "Unassigned"
            : identity?.name || token,
        projectId: task.projectId ? String(task.projectId) : null,
        projectTitle: task.projectId
          ? projectTitle.get(String(task.projectId)) || ""
          : "General",
        dueDate: due,
        estimateHours: explicitHours,
        status: String(task.status || "open"),
      };
      const list = byPerson.get(assigneeId) || [];
      list.push(item);
      byPerson.set(assigneeId, list);
    }
  }

  const rows: WorkloadPersonRow[] = [];
  for (const [assigneeId, items] of byPerson) {
    const explicit = items.reduce((sum, item) => sum + item.estimateHours, 0);
    const estimateHours =
      explicit > 0 ? explicit : items.length * hoursPerItem;
    const overdueCount = items.filter(
      (item) => item.dueDate && item.dueDate < today,
    ).length;
    const identity = resolveMemberIdentity(assigneeId, identities);
    const capacityHours =
      assigneeId === "unassigned"
        ? capacity
        : identity?.capacityHours ?? capacity;
    rows.push({
      assigneeId,
      assigneeName:
        assigneeId === "unassigned"
          ? "Unassigned"
          : identity?.name || items[0]?.assigneeName || assigneeId,
      itemCount: items.length,
      estimateHours,
      capacityHours,
      loadRatio: capacityHours > 0 ? estimateHours / capacityHours : 0,
      overdueCount,
      items: items.sort((a, b) =>
        String(a.dueDate || "").localeCompare(String(b.dueDate || "")),
      ),
    });
  }

  return rows.sort((a, b) => b.loadRatio - a.loadRatio || b.itemCount - a.itemCount);
}
