import {
  addDays,
  endOfMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  DELIVERY_STAGES,
  deliveryStageLabels,
  inferDeliveryStageFromPhase,
  normalizeDeliveryStage,
  type DeliveryStage,
} from "../../lib/projectDelivery";
import { hierarchyKind } from "../../lib/itemHierarchy";
import { taskWorkLane } from "../../lib/projectPortfolio";
import {
  isAssignedToActor,
  itemAssigneeIds,
  type MyWorkActor,
} from "../../lib/myWorkItems";
import {
  memberAvatar,
  memberPublicLabel,
  type WorkspaceMember,
} from "../../lib/workspaceCollaboration";

export type OverviewKpi = {
  id: string;
  label: string;
  value: number;
  subtitle: string | null;
  tone: "info" | "neutral" | "success" | "danger" | "warning";
};

export type OverviewRoadmapBar = {
  id: string;
  label: string;
  startIso: string;
  endIso: string;
  done: boolean;
  isMilestone: boolean;
};

export type OverviewRoadmapRow = {
  stage: DeliveryStage;
  label: string;
  startIso: string | null;
  endIso: string | null;
  progressPct: number | null;
  bars: OverviewRoadmapBar[];
};

export type OverviewTeamMember = {
  id: string;
  label: string;
  avatar: string;
  role: string;
};

export type OverviewMilestone = {
  id: string;
  title: string;
  dueIso: string;
  stageLabel: string;
  chip: "On track" | "At risk" | "Blocked" | "Pendiente";
};

export type OverviewProgress = {
  pct: number;
  completed: number;
  inProgress: number;
  overdue: number;
  pending: number;
};

export type ProjectOverviewModel = {
  title: string;
  description: string;
  initial: string;
  dateRangeLabel: string | null;
  kpis: OverviewKpi[];
  roadmap: OverviewRoadmapRow[];
  rangeStartIso: string | null;
  rangeEndIso: string | null;
  progress: OverviewProgress;
  team: OverviewTeamMember[];
  milestones: OverviewMilestone[];
  emptyDated: boolean;
};

export type MyWorkOverviewModel = {
  kpis: OverviewKpi[];
  progress: OverviewProgress;
  projectRows: Array<{
    projectId: string;
    label: string;
    stage: DeliveryStage;
    bars: OverviewRoadmapBar[];
  }>;
  rangeStartIso: string;
  rangeEndIso: string;
  upcoming: Array<{
    id: string;
    title: string;
    dueIso: string;
    projectName: string;
  }>;
};

function asIsoDay(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const slice = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) return slice;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed.toISOString().slice(0, 10) : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }
  if (typeof (value as { seconds?: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000)
      .toISOString()
      .slice(0, 10);
  }
  return null;
}

function asDate(value: unknown): Date | null {
  const iso = asIsoDay(value);
  if (!iso) return null;
  const d = parseISO(`${iso}T12:00:00`);
  return isValid(d) ? d : null;
}

function shortRange(start: string, end: string) {
  const fmt = (iso: string) => {
    const d = parseISO(`${iso}T12:00:00`);
    if (!isValid(d)) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (start === end) return fmt(start);
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  if (startYear === endYear) return `${fmt(start)} – ${fmt(end)}, ${endYear}`;
  return `${fmt(start)}, ${startYear} – ${fmt(end)}, ${endYear}`;
}

export function isExecutableItem(item: any): boolean {
  const kind = hierarchyKind(item);
  return kind !== "epic" && kind !== "feature";
}

export function itemStageForOverview(
  item: any,
  project: any,
): DeliveryStage {
  const explicit = String(item?.deliveryStage || "")
    .trim()
    .toLowerCase();
  if ((DELIVERY_STAGES as readonly string[]).includes(explicit)) {
    return explicit as DeliveryStage;
  }
  const inferred =
    inferDeliveryStageFromPhase(item?.productPhase) ||
    inferDeliveryStageFromPhase(item?.phase);
  if (inferred) return inferred;
  return normalizeDeliveryStage(project);
}

export function projectDateRange(
  project: any,
  tasks: any[],
): { start: string | null; end: string | null; label: string | null } {
  const projectDates = [
    project?.startDate,
    project?.targetDate,
    project?.dueDate,
    project?.revisedDueDate,
    project?.originalDueDate,
    project?.endDate,
  ]
    .map(asIsoDay)
    .filter(Boolean) as string[];

  let start: string | null = null;
  let end: string | null = null;

  if (projectDates.length) {
    const sorted = [...projectDates].sort();
    start = sorted[0];
    end = sorted[sorted.length - 1];
  } else {
    const itemDates = tasks
      .flatMap((task) => [asIsoDay(task?.startDate), asIsoDay(task?.dueDate), asIsoDay(task?.targetDate)])
      .filter(Boolean) as string[];
    if (!itemDates.length) return { start: null, end: null, label: null };
    const sorted = [...itemDates].sort();
    start = sorted[0];
    end = sorted[sorted.length - 1];
  }

  return { start, end, label: start && end ? shortRange(start, end) : null };
}

export function countCompletedVsPriorMonth(
  tasks: any[],
  now = new Date(),
): { pct: number; computable: boolean } {
  const withCompleted = tasks.filter((task) => asDate(task?.completedAt));
  if (!withCompleted.length) return { pct: 0, computable: false };

  const thisStart = startOfMonth(now);
  const thisEnd = endOfMonth(now);
  const priorStart = startOfMonth(subMonths(now, 1));
  const priorEnd = endOfMonth(subMonths(now, 1));

  let thisCount = 0;
  let priorCount = 0;
  for (const task of withCompleted) {
    const d = asDate(task.completedAt)!;
    if (d >= thisStart && d <= thisEnd) thisCount += 1;
    else if (d >= priorStart && d <= priorEnd) priorCount += 1;
  }

  if (priorCount === 0) return { pct: 0, computable: false };
  const pct = Math.round(((thisCount - priorCount) / priorCount) * 100);
  if (pct === 0) return { pct: 0, computable: false };
  return { pct, computable: true };
}

export function countInProgressUpdatedThisWeek(
  tasks: any[],
  now = new Date(),
): { count: number; computable: boolean } {
  const inProgress = tasks.filter((task) => taskWorkLane(task) === "in_progress");
  const withUpdated = inProgress.filter((task) => asDate(task?.updatedAt));
  if (!withUpdated.length) return { count: 0, computable: false };
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const count = withUpdated.filter((task) => {
    const d = asDate(task.updatedAt)!;
    return d >= weekStart && d <= now;
  }).length;
  return { count, computable: true };
}

function itemStartEnd(item: any): { start: string; end: string } | null {
  const start =
    asIsoDay(item?.startDate) ||
    asIsoDay(item?.dueDate) ||
    asIsoDay(item?.targetDate);
  const end =
    asIsoDay(item?.dueDate) ||
    asIsoDay(item?.targetDate) ||
    asIsoDay(item?.startDate);
  if (!start || !end) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

function milestoneChip(
  milestone: any,
  todayIso: string,
): OverviewMilestone["chip"] {
  const status = String(milestone?.status || "").toLowerCase();
  if (["blocked", "blocking"].includes(status)) return "Blocked";
  if (["at_risk", "at risk", "risk"].includes(status)) return "At risk";
  if (["on_track", "on track", "active", "in_progress"].includes(status))
    return "On track";
  if (["done", "completed", "closed"].includes(status)) return "On track";
  if (["not_started", "pending", "open", ""].includes(status)) {
    const due = asIsoDay(milestone?.dueDate || milestone?.targetDate);
    if (due && due < todayIso) return "At risk";
    return "Pendiente";
  }
  const due = asIsoDay(milestone?.dueDate || milestone?.targetDate);
  if (due && due < todayIso) return "At risk";
  return "Pendiente";
}

export function buildProjectOverview(input: {
  project: any;
  tasks: any[];
  milestones?: any[];
  members?: WorkspaceMember[];
  now?: Date;
}): ProjectOverviewModel {
  const { project, tasks, milestones = [], members = [] } = input;
  const now = input.now || new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const title = String(project?.title || project?.name || "Untitled project").trim();
  const description = String(
    project?.outcome || project?.objective || project?.description || "",
  ).trim();
  const initial = (title.charAt(0) || "P").toUpperCase();

  const range = projectDateRange(project, tasks);

  let epicCount = 0;
  let executableCount = 0;
  let inProgress = 0;
  let done = 0;
  let overdue = 0;
  let blocked = 0;
  let pending = 0;
  let donutInProgress = 0;
  let donutPending = 0;

  for (const task of tasks) {
    const kind = hierarchyKind(task);
    if (kind === "epic") epicCount += 1;
    if (isExecutableItem(task)) executableCount += 1;
    const lane = taskWorkLane(task);
    const due = asIsoDay(task?.dueDate || task?.targetDate);
    const isOverdue = lane !== "done" && Boolean(due && due < todayIso);
    if (lane === "done") done += 1;
    else if (lane === "in_progress") inProgress += 1;
    else if (lane === "blocked") blocked += 1;
    else pending += 1;
    if (isOverdue) overdue += 1;

    if (lane === "done") {
      /* done already counted */
    } else if (isOverdue) {
      /* overdue slice */
    } else if (lane === "in_progress") {
      donutInProgress += 1;
    } else {
      donutPending += 1;
    }
  }

  const weekDelta = countInProgressUpdatedThisWeek(tasks, now);
  const mom = countCompletedVsPriorMonth(
    tasks.filter((task) => taskWorkLane(task) === "done"),
    now,
  );

  const kpis: OverviewKpi[] = [
    {
      id: "items",
      label: "Ítems",
      value: tasks.length,
      subtitle:
        tasks.length > 0
          ? `${epicCount} épicas · ${executableCount} ejecutables`
          : null,
      tone: "info",
    },
    {
      id: "in_progress",
      label: "En curso",
      value: inProgress,
      subtitle:
        weekDelta.computable && weekDelta.count > 0
          ? `↑ ${weekDelta.count} esta semana`
          : null,
      tone: "neutral",
    },
    {
      id: "done",
      label: "Completados",
      value: done,
      subtitle:
        mom.computable
          ? `${mom.pct > 0 ? "↑" : "↓"} ${Math.abs(mom.pct)}% vs mes anterior`
          : null,
      tone: "success",
    },
    {
      id: "overdue",
      label: "Atrasados",
      value: overdue,
      subtitle: blocked > 0 ? `${blocked} bloqueado${blocked === 1 ? "" : "s"}` : null,
      tone: "danger",
    },
  ];

  const stageBuckets = new Map<DeliveryStage, any[]>();
  for (const stage of DELIVERY_STAGES) stageBuckets.set(stage, []);

  const datedCandidates = [
    ...tasks.filter((task) => {
      const kind = hierarchyKind(task);
      if (kind === "epic") return Boolean(itemStartEnd(task));
      return false;
    }),
    ...milestones.filter((m) => itemStartEnd(m)),
  ];

  // Fallback: top-level dated items if no epics/milestones with dates
  const barsSource =
    datedCandidates.length > 0
      ? datedCandidates
      : tasks.filter(
          (task) =>
            !task?.parentId &&
            !task?.epicId &&
            !task?.featureId &&
            itemStartEnd(task),
        );

  for (const item of barsSource) {
    const stage = itemStageForOverview(item, project);
    stageBuckets.get(stage)?.push(item);
  }

  const roadmap: OverviewRoadmapRow[] = DELIVERY_STAGES.map((stage) => {
    const items = stageBuckets.get(stage) || [];
    const stageTasks = tasks.filter(
      (task) => itemStageForOverview(task, project) === stage,
    );
    const executable = stageTasks.filter(isExecutableItem);
    const doneExec = executable.filter((task) => taskWorkLane(task) === "done");

    const dates = items
      .map(itemStartEnd)
      .filter(Boolean) as Array<{ start: string; end: string }>;
    const starts = dates.map((d) => d.start).sort();
    const ends = dates.map((d) => d.end).sort();
    const startIso = starts.length ? starts[0] : null;
    const endIso = ends.length ? ends[ends.length - 1] : null;

    const bars: OverviewRoadmapBar[] = items.slice(0, 6).map((item) => {
      const span = itemStartEnd(item)!;
      const isMilestone = Boolean(
        item?.isMilestone ||
          milestones.some((m) => m.id === item.id) ||
          String(item?.type || "").toLowerCase() === "milestone",
      );
      return {
        id: String(item.id),
        label: String(item.title || item.name || "Untitled"),
        startIso: span.start,
        endIso: span.end,
        done:
          ["done", "completed", "closed"].includes(
            String(item.status || "").toLowerCase(),
          ) || taskWorkLane(item) === "done",
        isMilestone,
      };
    });

    return {
      stage,
      label: deliveryStageLabels[stage],
      startIso,
      endIso,
      progressPct:
        executable.length > 0
          ? Math.round((doneExec.length / executable.length) * 100)
          : null,
      bars,
    };
  });

  const progressPct = tasks.length
    ? Math.round((done / tasks.length) * 100)
    : 0;

  const team = resolveOverviewTeam(project, tasks, members);

  const upcomingMilestones: OverviewMilestone[] = [...milestones]
    .filter((m) => {
      const st = String(m?.status || "").toLowerCase();
      return !["done", "completed", "closed"].includes(st);
    })
    .map((m) => ({
      id: String(m.id),
      title: String(m.title || m.name || "Milestone"),
      dueIso: asIsoDay(m.dueDate || m.targetDate) || "",
      stageLabel: deliveryStageLabels[itemStageForOverview(m, project)],
      chip: milestoneChip(m, todayIso),
    }))
    .filter((m) => m.dueIso)
    .sort((a, b) => a.dueIso.localeCompare(b.dueIso))
    .slice(0, 4);

  const emptyDated = !barsSource.length;

  return {
    title,
    description,
    initial,
    dateRangeLabel: range.label,
    kpis,
    roadmap,
    rangeStartIso: range.start,
    rangeEndIso: range.end,
    progress: {
      pct: progressPct,
      completed: done,
      inProgress: donutInProgress,
      overdue,
      pending: donutPending,
    },
    team,
    milestones: upcomingMilestones,
    emptyDated,
  };
}

export function resolveOverviewTeam(
  project: any,
  tasks: any[],
  members: WorkspaceMember[],
): OverviewTeamMember[] {
  const roleById = new Map<string, string>();
  const pushRole = (id: unknown, role: string) => {
    const key = String(id || "").trim();
    if (!key) return;
    if (!roleById.has(key)) roleById.set(key, role);
  };
  pushRole(project?.projectManagerId, "Project Manager");
  pushRole(project?.solutionArchitectId, "Solution Architect");
  pushRole(project?.ownerId, "Owner");

  const ids = new Set<string>();
  for (const id of [
    ...(Array.isArray(project?.teamMemberIds) ? project.teamMemberIds : []),
    project?.projectManagerId,
    project?.solutionArchitectId,
    project?.ownerId,
  ]) {
    const key = String(id || "").trim();
    if (key) ids.add(key);
  }
  for (const task of tasks) {
    for (const id of itemAssigneeIds(task)) ids.add(id);
  }

  const matched: OverviewTeamMember[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    const keys = [member.id, member.userId, member.email, member.emailLower]
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    if (!keys.some((k) => ids.has(k))) continue;
    if (seen.has(member.id)) continue;
    seen.add(member.id);
    const role =
      roleById.get(member.id) ||
      roleById.get(String(member.userId || "")) ||
      String(member.role || "Member");
    matched.push({
      id: member.id,
      label: memberPublicLabel(member),
      avatar: memberAvatar(member),
      role: role === "member" ? "Member" : role,
    });
  }

  // Name-only roles from project strings when no member id matched
  if (!matched.length) {
    for (const [label, role] of [
      [project?.projectManager, "Project Manager"],
      [project?.solutionArchitect, "Solution Architect"],
      [project?.owner, "Owner"],
    ] as Array<[unknown, string]>) {
      const name = String(label || "").trim();
      if (!name) continue;
      matched.push({
        id: `label:${name}`,
        label: name,
        avatar: "🙂",
        role,
      });
    }
  }

  return matched.slice(0, 12);
}

export function buildMyWorkOverview(input: {
  tasks: any[];
  projects: any[];
  actor: MyWorkActor;
  members?: WorkspaceMember[];
  now?: Date;
}): MyWorkOverviewModel {
  const { tasks, projects, actor, members = [] } = input;
  const now = input.now || new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const horizonEnd = addDays(now, 28);
  const horizonEndIso = horizonEnd.toISOString().slice(0, 10);
  const rangeStartIso = todayIso;
  const rangeEndIso = horizonEndIso;

  const mine = tasks.filter((task) => isAssignedToActor(task, actor, members));

  let assigned = mine.length;
  let dueToday = 0;
  let overdue = 0;
  let completedWeek = 0;
  let inProgress = 0;
  let done = 0;
  let pending = 0;
  let hasCompletedAt = false;

  for (const task of mine) {
    const lane = taskWorkLane(task);
    if (lane === "done") {
      done += 1;
      const completed = asDate(task?.completedAt);
      if (completed) {
        hasCompletedAt = true;
        if (completed >= weekStart && completed <= now) completedWeek += 1;
      }
    } else if (lane === "in_progress") inProgress += 1;
    else pending += 1;

    if (lane !== "done") {
      const due = asIsoDay(task?.dueDate || task?.targetDate);
      if (due === todayIso) dueToday += 1;
      if (due && due < todayIso) overdue += 1;
    }
  }

  const kpis: OverviewKpi[] = [
    {
      id: "assigned",
      label: "Asignados a mí",
      value: assigned,
      subtitle: null,
      tone: "info",
    },
    {
      id: "due_today",
      label: "Vencen hoy",
      value: dueToday,
      subtitle: null,
      tone: "warning",
    },
    {
      id: "overdue",
      label: "Atrasados",
      value: overdue,
      subtitle: null,
      tone: "danger",
    },
    {
      id: "done_week",
      label: "Completados esta semana",
      value: hasCompletedAt ? completedWeek : 0,
      subtitle: null,
      tone: "success",
    },
  ];

  const projectById = new Map(
    projects.map((p) => [String(p.id), p] as const),
  );

  const byProject = new Map<string, any[]>();
  for (const task of mine) {
    const span = itemStartEnd(task);
    if (!span) continue;
    if (span.end < todayIso || span.start > horizonEndIso) {
      // include if overlaps next 4 weeks
      if (!(span.start <= horizonEndIso && span.end >= todayIso)) continue;
    }
    const pid = String(task.projectId || "");
    if (!pid) continue;
    if (!byProject.has(pid)) byProject.set(pid, []);
    byProject.get(pid)!.push(task);
  }

  const projectRows = [...byProject.entries()]
    .slice(0, 6)
    .map(([projectId, items]) => {
      const project = projectById.get(projectId);
      const stage = normalizeDeliveryStage(project || { deliveryStage: "build" });
      return {
        projectId,
        label: String(project?.title || project?.name || "Project"),
        stage,
        bars: items.slice(0, 8).map((item) => {
          const span = itemStartEnd(item)!;
          return {
            id: String(item.id),
            label: String(item.title || item.name || "Item"),
            startIso: span.start,
            endIso: span.end,
            done: taskWorkLane(item) === "done",
            isMilestone: false,
          };
        }),
      };
    });

  const upcoming = mine
    .map((task) => ({
      id: String(task.id),
      title: String(task.title || task.name || "Item"),
      dueIso: asIsoDay(task?.dueDate || task?.targetDate) || "",
      projectName: String(
        projectById.get(String(task.projectId || ""))?.title ||
          projectById.get(String(task.projectId || ""))?.name ||
          "",
      ),
      lane: taskWorkLane(task),
    }))
    .filter((row) => row.dueIso && row.lane !== "done" && row.dueIso >= todayIso)
    .sort((a, b) => a.dueIso.localeCompare(b.dueIso))
    .slice(0, 5)
    .map(({ lane: _lane, ...rest }) => rest);

  const progressPct = mine.length ? Math.round((done / mine.length) * 100) : 0;

  return {
    kpis,
    progress: {
      pct: progressPct,
      completed: done,
      inProgress,
      overdue,
      pending,
    },
    projectRows,
    rangeStartIso,
    rangeEndIso,
    upcoming,
  };
}

export const STAGE_COLOR_VAR: Record<DeliveryStage, string> = {
  define: "var(--status-success)",
  onboarding: "var(--status-neutral)",
  build: "var(--status-info)",
  deploy: "var(--stage-deploy)",
  operations: "var(--status-warning)",
};

export const STAGE_SOFT_VAR: Record<DeliveryStage, string> = {
  define: "var(--status-success-soft)",
  onboarding: "var(--status-neutral-soft)",
  build: "var(--status-info-soft)",
  deploy: "var(--stage-deploy-soft)",
  operations: "var(--status-warning-soft)",
};
