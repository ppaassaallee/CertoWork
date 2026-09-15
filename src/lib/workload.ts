import type { MyWorkActor } from "./myWorkItems";
import { isClosed, localDateKey } from "./workspaceDisplay";

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

function itemAssignees(task: any): string[] {
  const ids = [
    ...(Array.isArray(task.assigneeIds) ? task.assigneeIds : []),
    task.assigneeId,
    task.owner,
    task.ownerId,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
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

export function buildWorkloadRows(input: {
  tasks: any[];
  projects: any[];
  members: Array<{ id?: string; userId?: string; displayName?: string; email?: string; name?: string }>;
  capacityHoursPerPerson?: number;
  now?: Date;
  actor?: MyWorkActor | null;
}): WorkloadPersonRow[] {
  const now = input.now || new Date();
  const capacity = input.capacityHoursPerPerson ?? 40;
  const projectTitle = new Map(
    input.projects.map((project) => [
      String(project.id),
      String(project.title || project.name || project.id),
    ]),
  );
  const memberName = new Map<string, string>();
  for (const member of input.members) {
    const id = String(member.userId || member.id || "");
    if (!id) continue;
    memberName.set(
      id,
      String(member.displayName || member.name || member.email || id),
    );
  }

  const today = localDateKey(now);
  const byPerson = new Map<string, WorkloadItem[]>();

  for (const task of input.tasks) {
    if (isClosed(task.status)) continue;
    const due = dueKey(task);
    // Include undated open work lightly? Prefer this-week due + overdue for capacity.
    const overdue = Boolean(due && due < today);
    if (!inThisWeek(due, now) && !overdue) continue;
    const assignees = itemAssignees(task);
    const targets = assignees.length ? assignees : ["unassigned"];
    for (const assigneeId of targets) {
      const item: WorkloadItem = {
        id: String(task.id),
        title: String(task.title || task.name || "Untitled"),
        assigneeId,
        assigneeName:
          assigneeId === "unassigned"
            ? "Unassigned"
            : memberName.get(assigneeId) || assigneeId,
        projectId: task.projectId ? String(task.projectId) : null,
        projectTitle: task.projectId
          ? projectTitle.get(String(task.projectId)) || ""
          : "General",
        dueDate: due,
        estimateHours: Number(task.estimateHours || task.estimatedHours || 0) || 0,
        status: String(task.status || "open"),
      };
      const list = byPerson.get(assigneeId) || [];
      list.push(item);
      byPerson.set(assigneeId, list);
    }
  }

  const rows: WorkloadPersonRow[] = [];
  for (const [assigneeId, items] of byPerson) {
    const estimateHours = items.reduce((sum, item) => sum + item.estimateHours, 0);
    const overdueCount = items.filter(
      (item) => item.dueDate && item.dueDate < today,
    ).length;
    rows.push({
      assigneeId,
      assigneeName: items[0]?.assigneeName || assigneeId,
      itemCount: items.length,
      estimateHours,
      capacityHours: capacity,
      loadRatio: capacity > 0 ? estimateHours / capacity : 0,
      overdueCount,
      items: items.sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || ""))),
    });
  }

  return rows.sort((a, b) => b.loadRatio - a.loadRatio || b.itemCount - a.itemCount);
}
