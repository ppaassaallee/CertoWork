import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { es, enUS } from "date-fns/locale";
import { getLocale, type Locale } from "../../lib/i18n";
import {
  isAssignedToActor,
  type MyWorkActor,
} from "../../lib/myWorkItems";
import {
  projectHealth,
  taskWorkLane,
  type ProjectHealth,
} from "../../lib/projectPortfolio";
import { isClosed } from "../../lib/workspaceDisplay";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";

export type HomeItemRow = {
  id: string;
  title: string;
  projectId: string | null;
  projectTitle: string;
  status: string;
  dueIso: string | null;
  workItemType: string;
  priority: string | null;
  ageLabel?: string;
};

export type HomeActionRow = {
  id: string;
  kind: "approval" | "request" | "blocked" | "mention" | "routine_session";
  title: string;
  meta: string;
  actionLabel: "approve" | "respond" | "open" | "start";
  payload?: unknown;
};

export type HomeProjectCard = {
  id: string;
  title: string;
  shortName: string;
  health: ProjectHealth;
  pct: number;
  line: string;
  lineTone: "muted" | "warning" | "danger";
  milestonePast: boolean;
  blockedCount: number;
  ownerInitials: string;
};

export type HomeDayChip = {
  id: "due" | "blocked" | "approvals" | "projects";
  count: number;
  tone: "danger" | "warning" | "info" | "success";
};

export type HomeActivityRow = {
  id: string;
  text: string;
  verb?: string;
  object?: string;
  when: string;
  avatar?: string;
  itemId?: string | null;
};

export type EditorialPart = {
  text: string;
  tone?: "plain" | "link" | "danger";
  action?: "overdue" | "today" | "week" | "approvals" | "plan" | "project";
  projectId?: string;
};

export type QuietStat = {
  id: "open" | "overdue" | "done" | "projects" | "routines";
  value: number;
  label: string;
  tone: "plain" | "danger";
  action?: "overdue" | "today" | "week" | "projects" | "approvals";
};

export type HomeWeekDay = {
  iso: string;
  dayNum: string;
  weekday: string;
  isToday: boolean;
  isWeekend: boolean;
  items: HomeItemRow[];
  routines: Array<{ id: string; title: string }>;
  restLabel?: string;
};

export type HomeRoutineHint = {
  id: string;
  title: string;
  nextRunAt: string | null;
};

export type HomeMeetingChip = {
  id: string;
  title: string;
  start: string;
  meetingUrl: string | null;
  minutesUntil: number;
};

export type HomeCockpitModel = {
  greeting: string;
  longDate: string;
  editorial: EditorialPart[];
  editorialFallback: string;
  dayLine: string;
  dayChips: HomeDayChip[];
  dayLineTail: string;
  quietStats: QuietStat[];
  actions: HomeActionRow[];
  actionCounts: { approvals: number; requests: number; mentions: number };
  todayItems: HomeItemRow[];
  overdueItems: HomeItemRow[];
  weekItems: HomeItemRow[];
  defaultItemTab: "today" | "overdue" | "week";
  projects: HomeProjectCard[];
  next7Days: HomeWeekDay[];
  weekSubtitle: string;
  activity: HomeActivityRow[];
  nextMeetings: HomeMeetingChip[];
};

function asIsoDay(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const day = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }
  if (typeof (value as { seconds?: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString().slice(0, 10);
  }
  return null;
}

function titleOf(row: any) {
  return String(row?.title || row?.name || "Untitled");
}

export function shortProjectName(title: string, project?: any): string {
  const explicit = String(project?.shortName || project?.short_name || "").trim();
  if (explicit) return explicit;
  let name = String(title || "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Drop trailing client/year debris after last middot when still long
  if (name.length > 42 && name.includes("·")) {
    const parts = name.split("·").map((p) => p.trim()).filter(Boolean);
    name = parts.slice(0, 2).join(" · ");
  }
  if (name.length > 42) name = `${name.slice(0, 40)}…`;
  return name || String(title || "Project");
}

function relativeAge(value: unknown, locale: Locale, now = new Date()) {
  const ms =
    typeof (value as { toMillis?: () => number })?.toMillis === "function"
      ? (value as { toMillis: () => number }).toMillis()
      : typeof (value as { seconds?: number })?.seconds === "number"
        ? (value as { seconds: number }).seconds * 1000
        : typeof value === "string"
          ? Date.parse(value)
          : typeof value === "number"
            ? value
            : 0;
  if (!ms) return locale === "es" ? "hace un rato" : "just now";
  const hours = Math.max(0, Math.round((now.getTime() - ms) / 3_600_000));
  if (hours < 1) return locale === "es" ? "hace un rato" : "just now";
  if (hours < 24) return locale === "es" ? `hace ${hours} h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return locale === "es" ? `hace ${days} d` : `${days}d ago`;
}

function dueAgeLabel(dueIso: string | null, todayIso: string, locale: Locale) {
  if (!dueIso) return "";
  const days = differenceInCalendarDays(parseISO(todayIso), parseISO(dueIso));
  if (days === 0) return locale === "es" ? "hoy" : "today";
  if (days > 0) {
    if (days >= 60) {
      const months = Math.max(1, Math.round(days / 30));
      return locale === "es" ? `hace ${months} m` : `${months}mo ago`;
    }
    return locale === "es" ? `hace ${days} d` : `${days}d ago`;
  }
  return dueIso.slice(5).replace("-", " ");
}

function greetingFor(name: string, locale: Locale, now = new Date()) {
  const hour = now.getHours();
  const first = name.trim().split(/\s+/)[0] || (locale === "es" ? "ahí" : "there");
  if (locale === "es") {
    if (hour < 12) return `Buenos días, ${first}.`;
    if (hour < 19) return `Buenas tardes, ${first}.`;
    return `Buenas noches, ${first}.`;
  }
  if (hour < 12) return `Good morning, ${first}.`;
  if (hour < 19) return `Good afternoon, ${first}.`;
  return `Good evening, ${first}.`;
}

function projectPct(projectTasks: any[]) {
  const open = projectTasks.filter((task) => !isClosed(task.status));
  const done = projectTasks.filter((task) => taskWorkLane(task) === "done").length;
  const total = done + open.length;
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

/** Deterministic health + milestone honesty for Home rows. */
export function homeProjectStatus(
  project: any,
  projectTasks: any[],
  projectRisks: any[],
  pct: number,
  now: Date,
  locale: Locale = "es",
): {
  health: ProjectHealth;
  milestoneIso: string | null;
  milestoneLabel: string;
  lineTone: "muted" | "warning" | "danger";
  milestonePast: boolean;
} {
  const milestoneIso = asIsoDay(
    project.revisedDueDate || project.dueDate || project.targetDate || project.originalDueDate,
  );
  let health = projectHealth(project, projectTasks, projectRisks);
  let lineTone: "muted" | "warning" | "danger" = "muted";
  let milestoneLabel = "";
  let milestonePast = false;

  if (milestoneIso) {
    const days = differenceInCalendarDays(parseISO(milestoneIso), startOfDay(now));
    const parsed = parseISO(milestoneIso);
    const dateBit = isValid(parsed)
      ? format(parsed, "MMM d", { locale: locale === "es" ? es : enUS })
      : milestoneIso;
    if (days < 0) {
      milestonePast = true;
      const ago = Math.abs(days);
      const age =
        ago >= 60
          ? locale === "es"
            ? `vencido hace ${Math.max(1, Math.round(ago / 30))} m`
            : `${Math.max(1, Math.round(ago / 30))}mo overdue`
          : locale === "es"
            ? `vencido hace ${ago} d`
            : `${ago}d overdue`;
      milestoneLabel = `${locale === "es" ? "hito" : "milestone"} ${dateBit} · ${age}`;
      lineTone = "danger";
      if (health === "on_track") health = "at_risk";
      if (pct === 0) health = health === "blocked" ? "blocked" : "at_risk";
    } else if (days <= 7) {
      milestoneLabel =
        locale === "es"
          ? `hito ${dateBit} · en ${days} d`
          : `milestone ${dateBit} · in ${days}d`;
      lineTone = "warning";
      if (health === "on_track" && days <= 2) health = "at_risk";
    } else {
      milestoneLabel = locale === "es" ? `hito ${dateBit}` : `milestone ${dateBit}`;
    }
  }

  if (pct === 0 && milestonePast && health === "on_track") {
    health = "at_risk";
  }

  return { health, milestoneIso, milestoneLabel, lineTone, milestonePast };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function buildEditorial(input: {
  locale: Locale;
  now: Date;
  todayCount: number;
  overdueCount: number;
  approvalCount: number;
  blockedCount: number;
  tomorrowItems: HomeItemRow[];
  doneToday: number;
  hasWeeklyPlan: boolean;
}): EditorialPart[] {
  const { locale, now } = input;
  const dow = now.getDay(); // 0 Sun
  const hour = now.getHours();
  const isWeekend = dow === 0 || dow === 6;

  if (isWeekend) {
    const parts: EditorialPart[] = [];
    if (input.todayCount === 0) {
      parts.push({
        text: locale === "es" ? "Nada vence hoy. " : "Nothing due today. ",
      });
    } else {
      parts.push({
        text: locale === "es" ? "Hoy tienes " : "Today you have ",
      });
      parts.push({
        text:
          locale === "es"
            ? `${input.todayCount} ítem${input.todayCount === 1 ? "" : "s"}`
            : `${input.todayCount} item${input.todayCount === 1 ? "" : "s"}`,
        tone: "link",
        action: "today",
      });
      parts.push({ text: ". " });
    }

    const tomorrowByProject = new Map<string, { count: number; title: string; id: string }>();
    for (const item of input.tomorrowItems) {
      const key = item.projectId || item.projectTitle || "x";
      const cur = tomorrowByProject.get(key) || {
        count: 0,
        title: item.projectTitle || (locale === "es" ? "sin proyecto" : "no project"),
        id: item.projectId || "",
      };
      cur.count += 1;
      tomorrowByProject.set(key, cur);
    }
    const top = [...tomorrowByProject.values()].sort((a, b) => b.count - a.count)[0];
    const tomorrowTotal = input.tomorrowItems.length;

    if (tomorrowTotal > 0 && top) {
      parts.push({
        text:
          locale === "es"
            ? "Tu semana arranca mañana con "
            : "Your week starts tomorrow with ",
      });
      parts.push({
        text:
          locale === "es"
            ? `${top.count} ítem${top.count === 1 ? "" : "s"} en ${top.title}`
            : `${top.count} item${top.count === 1 ? "" : "s"} in ${top.title}`,
        tone: "link",
        action: top.id ? "project" : "week",
        projectId: top.id || undefined,
      });
    } else {
      parts.push({
        text:
          locale === "es"
            ? "Tu semana arranca mañana."
            : "Your week starts tomorrow.",
      });
    }

    if (input.overdueCount > 0) {
      parts.push({ text: locale === "es" ? ", y " : ", and " });
      parts.push({
        text:
          locale === "es"
            ? `${input.overdueCount} ítems siguen vencidos`
            : `${input.overdueCount} items are still overdue`,
        tone: "danger",
        action: "overdue",
      });
      if (input.hasWeeklyPlan) {
        parts.push({
          text:
            locale === "es"
              ? ": un buen candidato para el "
              : ": a good fit for ",
        });
        parts.push({
          text: locale === "es" ? "Plan semanal" : "Weekly plan",
          tone: "link",
          action: "plan",
        });
        parts.push({
          text: locale === "es" ? " del lunes a las 8." : " on Monday at 8.",
        });
      } else {
        parts.push({ text: "." });
      }
    } else {
      parts.push({ text: "." });
    }
    return parts;
  }

  if (hour >= 18) {
    const parts: EditorialPart[] = [];
    parts.push({
      text:
        locale === "es"
          ? `Hoy cerraste ${input.doneToday}. `
          : `You closed ${input.doneToday} today. `,
    });
    if (input.overdueCount > 0) {
      parts.push({
        text: locale === "es" ? "Siguen " : "Still ",
      });
      parts.push({
        text:
          locale === "es"
            ? `${input.overdueCount} vencidos`
            : `${input.overdueCount} overdue`,
        tone: "danger",
        action: "overdue",
      });
      parts.push({
        text: locale === "es" ? " para mañana." : " for tomorrow.",
      });
    } else if (input.todayCount > 0) {
      parts.push({
        text:
          locale === "es"
            ? "Queda algo por mover a mañana."
            : "A few things can move to tomorrow.",
      });
    } else {
      parts.push({
        text: locale === "es" ? "Día limpio." : "Clean day.",
      });
    }
    return parts;
  }

  // Weekday morning / daytime
  const parts: EditorialPart[] = [];
  if (input.todayCount > 0) {
    parts.push({
      text: locale === "es" ? "Hoy vencen " : "Due today: ",
    });
    parts.push({
      text: String(input.todayCount),
      tone: "link",
      action: "today",
    });
  } else {
    parts.push({
      text: locale === "es" ? "Nada vence hoy" : "Nothing due today",
    });
  }
  if (input.blockedCount > 0) {
    parts.push({ text: locale === "es" ? ", " : ", " });
    parts.push({
      text:
        locale === "es"
          ? `${input.blockedCount} bloqueado${input.blockedCount === 1 ? "" : "s"}`
          : `${input.blockedCount} blocked`,
      tone: "link",
      action: "approvals",
    });
  }
  if (input.approvalCount > 0) {
    parts.push({ text: locale === "es" ? ", " : ", " });
    parts.push({
      text:
        locale === "es"
          ? `${input.approvalCount} aprobación${input.approvalCount === 1 ? "" : "es"}`
          : `${input.approvalCount} approval${input.approvalCount === 1 ? "" : "s"}`,
      tone: "link",
      action: "approvals",
    });
  }
  if (input.overdueCount > 0) {
    parts.push({ text: locale === "es" ? ", y " : ", and " });
    parts.push({
      text:
        locale === "es"
          ? `${input.overdueCount} vencidos`
          : `${input.overdueCount} overdue`,
      tone: "danger",
      action: "overdue",
    });
  }
  parts.push({ text: "." });
  return parts;
}

export function buildHomeCockpitData(input: {
  userName: string;
  actor: MyWorkActor;
  tasks: any[];
  projects: any[];
  risks?: any[];
  members?: WorkspaceMember[];
  reviewItems?: any[];
  accessRequests?: any[];
  activityItems?: any[];
  routines?: HomeRoutineHint[];
  routinesRan7d?: number;
  /** Pending guided ritual sessions for the action queue. */
  routineSessions?: Array<{
    id: string;
    recipeId: string;
    status: string;
    estimatedMinutes?: number | null;
    condensed?: boolean;
    weekOf?: string;
  }>;
  now?: Date;
  locale?: Locale;
  calendarEvents?: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    meetingUrl?: string | null;
    privacy?: string;
  }>;
}): HomeCockpitModel {
  const locale = input.locale || getLocale();
  const now = input.now || new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const tomorrowIso = addDays(startOfDay(now), 1).toISOString().slice(0, 10);
  const weekEndIso = addDays(startOfDay(now), 7).toISOString().slice(0, 10);
  const weekStartIso = startOfWeek(now, { weekStartsOn: 1 }).toISOString().slice(0, 10);
  const members = input.members || [];
  const risks = input.risks || [];
  const projects = input.projects || [];
  const projectById = new Map(projects.map((p) => [String(p.id), p] as const));
  const routines = input.routines || [];

  const mine = (input.tasks || []).filter((task) =>
    isAssignedToActor(task, input.actor, members),
  );
  const openMine = mine.filter((task) => taskWorkLane(task) !== "done" && !isClosed(task.status));

  const toRow = (task: any): HomeItemRow => {
    const dueIso = asIsoDay(task.dueDate || task.targetDate);
    return {
      id: String(task.id),
      title: titleOf(task),
      projectId: task.projectId ? String(task.projectId) : null,
      projectTitle: titleOf(projectById.get(String(task.projectId || "")) || {}),
      status: String(task.status || "open"),
      dueIso,
      workItemType: String(task.workItemType || task.itemType || task.type || "task"),
      priority: task.priority != null ? String(task.priority) : null,
      ageLabel: dueAgeLabel(dueIso, todayIso, locale),
    };
  };

  const todayItems = openMine
    .filter((task) => asIsoDay(task.dueDate || task.targetDate) === todayIso)
    .map(toRow);
  const overdueItems = openMine
    .filter((task) => {
      const due = asIsoDay(task.dueDate || task.targetDate);
      return due && due < todayIso;
    })
    .map(toRow)
    .sort((a, b) => String(a.dueIso).localeCompare(String(b.dueIso)));
  const weekItems = openMine
    .filter((task) => {
      const due = asIsoDay(task.dueDate || task.targetDate);
      return due && due >= todayIso && due < weekEndIso;
    })
    .map(toRow);
  const tomorrowItems = openMine
    .filter((task) => asIsoDay(task.dueDate || task.targetDate) === tomorrowIso)
    .map(toRow);

  const blockedMine = openMine
    .filter((task) => String(task.status || "").toLowerCase() === "blocked")
    .map(toRow);

  const doneThisWeek = mine.filter((task) => {
    if (taskWorkLane(task) !== "done" && !isClosed(task.status)) return false;
    const day = asIsoDay(task.completedAt || task.updatedAt);
    return day != null && day >= weekStartIso && day <= todayIso;
  }).length;

  const doneToday = mine.filter((task) => {
    if (taskWorkLane(task) !== "done" && !isClosed(task.status)) return false;
    return asIsoDay(task.completedAt || task.updatedAt) === todayIso;
  }).length;

  const actions: HomeActionRow[] = [];
  for (const session of input.routineSessions || []) {
    const isWrap = session.recipeId === "wrap-review";
    const name = isWrap
      ? "WRAP Review"
      : session.recipeId === "weekly-plan"
        ? locale === "es"
          ? "Plan semanal"
          : "Weekly plan"
        : session.recipeId === "close-day"
          ? locale === "es"
            ? "Cerrar el día"
            : "Close the day"
          : session.recipeId;
    const mins =
      session.estimatedMinutes ||
      (isWrap ? 12 : session.recipeId === "close-day" ? 2 : 7);
    const missed = session.status === "missed" || session.condensed;
    actions.push({
      id: `routine-${session.id}`,
      kind: "routine_session",
      title: missed
        ? locale === "es"
          ? `${session.weekOf || "Semana"} sin revisar · Hacerla en ${Math.max(8, mins - 4)} min (resumida)`
          : `${session.weekOf || "Week"} missed · Do it in ${Math.max(8, mins - 4)} min (condensed)`
        : session.recipeId === "close-day"
          ? locale === "es"
            ? `Cerrar el día · ~${mins} min`
            : `Close the day · ~${mins} min`
          : locale === "es"
            ? `Tu ${name} está lista`
            : `Your ${name} is ready`,
      meta: `~${missed ? Math.max(8, mins - 4) : mins} min · ${locale === "es" ? "Empezar" : "Start"}`,
      actionLabel: "start",
      payload: session,
    });
  }
  for (const item of input.reviewItems || []) {
    actions.push({
      id: `approval-${item.id}`,
      kind: "approval",
      title: titleOf(item) || String(item.summary || item.why || "Approval"),
      meta: `${locale === "es" ? "Aprobación" : "Approval"} · ${relativeAge(item.createdAt, locale, now)}`,
      actionLabel: "approve",
      payload: item,
    });
  }
  for (const request of input.accessRequests || []) {
    const who = String(request.displayName || request.email || "Someone");
    actions.push({
      id: `request-${request.id}`,
      kind: "request",
      title: locale === "es" ? `${who} pide acceso` : `${who} requests access`,
      meta: `Request · ${relativeAge(request.requestedAt || request.updatedAt, locale, now)}`,
      actionLabel: "respond",
      payload: request,
    });
  }
  for (const item of blockedMine.slice(0, 6)) {
    actions.push({
      id: `blocked-${item.id}`,
      kind: "blocked",
      title: item.title,
      meta: `${locale === "es" ? "Bloqueado" : "Blocked"} · ${item.projectTitle || "—"}`,
      actionLabel: "open",
      payload: item,
    });
  }
  const actionQueue = actions.slice(0, 6);
  const actionCounts = {
    approvals: (input.reviewItems || []).length,
    requests: (input.accessRequests || []).length,
    mentions: 0,
  };

  const openProjects = projects.filter((project) => !isClosed(project.status));
  const projectCards: HomeProjectCard[] = openProjects
    .map((project) => {
      const projectTasks = (input.tasks || []).filter(
        (task) => String(task.projectId) === String(project.id),
      );
      const projectRisks = risks.filter(
        (risk) => String(risk.projectId) === String(project.id),
      );
      const pct = projectPct(projectTasks);
      const status = homeProjectStatus(project, projectTasks, projectRisks, pct, now, locale);
      const blocked = projectTasks.filter(
        (task) => String(task.status || "").toLowerCase() === "blocked",
      ).length;
      const owner =
        members.find((m) => m.userId === project.ownerId || m.userId === project.createdBy) ||
        null;
      const healthLabel =
        status.health === "on_track"
          ? locale === "es"
            ? "en fecha"
            : "on track"
          : status.health === "blocked"
            ? locale === "es"
              ? "bloqueado"
              : "blocked"
            : pct === 0 && status.milestonePast
              ? locale === "es"
                ? "sin avance"
                : "no progress"
              : locale === "es"
                ? "en riesgo"
                : "at risk";

      const lineBits = [`${pct}%`];
      if (status.milestoneLabel) lineBits.push(status.milestoneLabel);
      else lineBits.push(healthLabel);
      if (blocked) {
        lineBits.push(
          locale === "es"
            ? `${blocked} bloqueado${blocked === 1 ? "" : "s"}`
            : `${blocked} blocked`,
        );
      }

      return {
        id: String(project.id),
        title: titleOf(project),
        shortName: shortProjectName(titleOf(project), project),
        health: status.health,
        pct,
        line: lineBits.join(" · "),
        lineTone: status.lineTone,
        milestonePast: status.milestonePast,
        blockedCount: blocked,
        ownerInitials: initials(
          String(owner?.displayName || owner?.email || project.ownerName || "?"),
        ),
      };
    })
    .sort((a, b) => {
      if (a.blockedCount !== b.blockedCount) return b.blockedCount - a.blockedCount;
      if (a.milestonePast !== b.milestonePast) return a.milestonePast ? -1 : 1;
      if (a.health !== b.health) {
        const rank = { blocked: 0, at_risk: 1, on_track: 2 } as const;
        return rank[a.health] - rank[b.health];
      }
      return a.shortName.localeCompare(b.shortName);
    })
    .slice(0, 6);

  const dueCount = todayItems.length + overdueItems.length;
  const dayChips: HomeDayChip[] = [
    { id: "due" as const, count: dueCount, tone: "danger" as const },
    { id: "blocked" as const, count: blockedMine.length, tone: "warning" as const },
    {
      id: "approvals" as const,
      count: actionCounts.approvals,
      tone: "info" as const,
    },
  ].filter((chip) => chip.count > 0);

  const hasWeeklyPlan = routines.some((r) =>
    /plan\s*semanal|weekly\s*plan/i.test(r.title),
  );

  const editorial = buildEditorial({
    locale,
    now,
    todayCount: todayItems.length,
    overdueCount: overdueItems.length,
    approvalCount: actionCounts.approvals,
    blockedCount: blockedMine.length,
    tomorrowItems,
    doneToday,
    hasWeeklyPlan: hasWeeklyPlan || true, // point to plan even before recipe ships
  });

  const editorialFallback =
    locale === "es"
      ? `${overdueItems.length} vencidos · ${todayItems.length} hoy · ${actionCounts.approvals} aprobaciones`
      : `${overdueItems.length} overdue · ${todayItems.length} today · ${actionCounts.approvals} approvals`;

  const quietStats: QuietStat[] = [
    {
      id: "open",
      value: openMine.length,
      label:
        locale === "es"
          ? `ítems abiertos · ${openProjects.length} proyectos`
          : `open items · ${openProjects.length} projects`,
      tone: "plain",
      action: "today",
    },
    {
      id: "overdue",
      value: overdueItems.length,
      label: locale === "es" ? "vencidos" : "overdue",
      tone: overdueItems.length > 0 ? "danger" : "plain",
      action: "overdue",
    },
    {
      id: "done",
      value: doneThisWeek,
      label: locale === "es" ? "completados esta semana" : "completed this week",
      tone: "plain",
      action: "week",
    },
    {
      id: "projects",
      value: openProjects.length,
      label: locale === "es" ? "proyectos activos" : "active projects",
      tone: "plain",
      action: "projects",
    },
    {
      id: "routines",
      value: input.routinesRan7d ?? 0,
      label: locale === "es" ? "rutinas corrieron · 7 d" : "routines ran · 7d",
      tone: "plain",
    },
  ];

  const dateLocale = locale === "es" ? es : enUS;
  const longDate = format(now, "EEEE d 'de' MMMM", { locale: dateLocale });
  const longDateEn = format(now, "EEEE, MMMM d", { locale: enUS });

  const next7Days: HomeWeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(startOfDay(now), index);
    const iso = day.toISOString().slice(0, 10);
    const items = openMine
      .filter((task) => asIsoDay(task.dueDate || task.targetDate) === iso)
      .map(toRow);
    const dayRoutines = routines
      .filter((routine) => {
        const runDay = asIsoDay(routine.nextRunAt);
        return runDay === iso;
      })
      .map((routine) => ({ id: routine.id, title: routine.title }));

    // Seed default WRAP / Plan chips when recipes not yet activated but weekend/Monday/Friday
    if (!dayRoutines.length && index > 0) {
      const dow = day.getDay();
      if (dow === 1) {
        dayRoutines.push({ id: "weekly-plan", title: locale === "es" ? "Plan semanal" : "Weekly plan" });
      }
      if (dow === 5) {
        dayRoutines.push({ id: "wrap-review", title: "WRAP Review" });
      }
    }

    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    return {
      iso,
      dayNum: format(day, "d"),
      weekday: format(day, "EEE", { locale: dateLocale }),
      isToday: index === 0,
      isWeekend,
      items,
      routines: dayRoutines,
      restLabel:
        index === 0 && !items.length && isWeekend
          ? locale === "es"
            ? "Descanso"
            : "Rest"
          : undefined,
    };
  });

  const weekItemCount = next7Days.reduce((n, d) => n + d.items.length, 0);
  const nextRoutine = routines
    .map((r) => ({ ...r, day: asIsoDay(r.nextRunAt) }))
    .filter((r) => r.day && r.day >= todayIso)
    .sort((a, b) => String(a.day).localeCompare(String(b.day)))[0];
  let weekSubtitle =
    locale === "es"
      ? `${weekItemCount} ítem${weekItemCount === 1 ? "" : "s"}`
      : `${weekItemCount} item${weekItemCount === 1 ? "" : "s"}`;
  if (nextRoutine?.day) {
    const parsed = parseISO(nextRoutine.day);
    const when = isValid(parsed)
      ? format(parsed, "EEE HH:mm", { locale: dateLocale })
      : nextRoutine.day;
    weekSubtitle += ` · ${nextRoutine.title} ${when}`;
  } else {
    weekSubtitle +=
      locale === "es" ? " · Plan semanal lun 08:00" : " · Weekly plan Mon 08:00";
  }

  const activity: HomeActivityRow[] = (input.activityItems || [])
    .slice(0, 6)
    .map((item, index) => ({
      id: String(item.id || `act-${index}`),
      text: String(item.summary || item.text || item.action || "Update"),
      verb: item.verb ? String(item.verb) : undefined,
      object: item.objectTitle ? String(item.objectTitle) : undefined,
      when: relativeAge(item.createdAt || item.at, locale, now),
      avatar: item.avatar || undefined,
      itemId: item.itemId ? String(item.itemId) : null,
    }));

  if (activity.length < 6) {
    const recent = [...openMine, ...mine.filter((t) => taskWorkLane(t) === "done")]
      .sort((a, b) =>
        String(b.updatedAt?.toMillis?.() || b.updatedAt || "").localeCompare(
          String(a.updatedAt?.toMillis?.() || a.updatedAt || ""),
        ),
      )
      .slice(0, 6 - activity.length);
    for (const task of recent) {
      activity.push({
        id: `task-${task.id}`,
        text: titleOf(task),
        verb: locale === "es" ? "actualizó" : "updated",
        object: titleOf(task),
        when: relativeAge(task.updatedAt, locale, now),
        itemId: String(task.id),
      });
    }
  }

  const defaultItemTab: "today" | "overdue" | "week" =
    todayItems.length > 0
      ? "today"
      : overdueItems.length > 0
        ? "overdue"
        : "week";

  const dayLine = editorial.map((p) => p.text).join("");

  const nowMs = now.getTime();
  const nextMeetings: HomeMeetingChip[] = (input.calendarEvents || [])
    .filter((event) => {
      const start = Date.parse(event.start);
      return Number.isFinite(start) && start >= nowMs - 5 * 60_000 && String(event.start).slice(0, 10) === todayIso;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, 3)
    .map((event) => ({
      id: event.id,
      title: event.privacy === "busy" ? (locale === "es" ? "Ocupado" : "Busy") : event.title,
      start: event.start,
      meetingUrl: event.meetingUrl || null,
      minutesUntil: Math.max(0, Math.round((Date.parse(event.start) - nowMs) / 60_000)),
    }));

  return {
    greeting: greetingFor(input.userName, locale, now),
    longDate: locale === "es" ? longDate : longDateEn,
    editorial,
    editorialFallback,
    dayLine,
    dayChips,
    dayLineTail: "",
    quietStats,
    actions: actionQueue,
    actionCounts,
    todayItems,
    overdueItems,
    weekItems,
    defaultItemTab,
    projects: projectCards,
    next7Days,
    weekSubtitle,
    activity: activity.slice(0, 6),
    nextMeetings,
  };
}
