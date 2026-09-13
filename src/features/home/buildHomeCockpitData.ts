import { addDays, format, isValid, parseISO, startOfDay } from "date-fns";
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
};

export type HomeActionRow = {
  id: string;
  kind: "approval" | "request" | "blocked" | "mention";
  title: string;
  meta: string;
  actionLabel: "approve" | "respond" | "open";
  payload?: unknown;
};

export type HomeProjectCard = {
  id: string;
  title: string;
  health: ProjectHealth;
  pct: number;
  line: string;
};

export type HomeDayChip = {
  id: "due" | "blocked" | "approvals" | "projects";
  count: number;
  tone: "danger" | "warning" | "info" | "success";
};

export type HomeActivityRow = {
  id: string;
  text: string;
  when: string;
  avatar?: string;
};

export type HomeCockpitModel = {
  greeting: string;
  longDate: string;
  dayLine: string;
  dayChips: HomeDayChip[];
  dayLineTail: string;
  actions: HomeActionRow[];
  todayItems: HomeItemRow[];
  overdueItems: HomeItemRow[];
  weekItems: HomeItemRow[];
  projects: HomeProjectCard[];
  next7Days: Array<{ iso: string; label: string; isToday: boolean; items: HomeItemRow[] }>;
  activity: HomeActivityRow[];
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

function relativeAge(value: unknown, locale: Locale) {
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
  const hours = Math.max(0, Math.round((Date.now() - ms) / 3_600_000));
  if (hours < 1) return locale === "es" ? "hace un rato" : "just now";
  if (hours < 24) return locale === "es" ? `hace ${hours} h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return locale === "es" ? `hace ${days} d` : `${days}d ago`;
}

function greetingFor(name: string, locale: Locale, now = new Date()) {
  const hour = now.getHours();
  const first = name.trim().split(/\s+/)[0] || (locale === "es" ? "ahí" : "there");
  if (locale === "es") {
    if (hour < 12) return `Buenos días, ${first}`;
    if (hour < 19) return `Buenas tardes, ${first}`;
    return `Buenas noches, ${first}`;
  }
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 19) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

function projectPct(projectTasks: any[]) {
  const open = projectTasks.filter((task) => !isClosed(task.status));
  if (!open.length) return 0;
  const done = projectTasks.filter((task) => taskWorkLane(task) === "done").length;
  const total = done + open.length;
  return total ? Math.round((done / total) * 100) : 0;
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
  now?: Date;
  locale?: Locale;
}): HomeCockpitModel {
  const locale = input.locale || getLocale();
  const now = input.now || new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const weekEndIso = addDays(startOfDay(now), 7).toISOString().slice(0, 10);
  const members = input.members || [];
  const risks = input.risks || [];
  const projects = input.projects || [];
  const projectById = new Map(projects.map((p) => [String(p.id), p] as const));

  const mine = (input.tasks || []).filter((task) =>
    isAssignedToActor(task, input.actor, members),
  );
  const openMine = mine.filter((task) => taskWorkLane(task) !== "done" && !isClosed(task.status));

  const toRow = (task: any): HomeItemRow => ({
    id: String(task.id),
    title: titleOf(task),
    projectId: task.projectId ? String(task.projectId) : null,
    projectTitle: titleOf(projectById.get(String(task.projectId || "")) || {}),
    status: String(task.status || "open"),
    dueIso: asIsoDay(task.dueDate || task.targetDate),
    workItemType: String(
      task.workItemType || task.itemType || task.type || "task",
    ),
    priority: task.priority != null ? String(task.priority) : null,
  });

  const todayItems = openMine
    .filter((task) => asIsoDay(task.dueDate || task.targetDate) === todayIso)
    .map(toRow);
  const overdueItems = openMine
    .filter((task) => {
      const due = asIsoDay(task.dueDate || task.targetDate);
      return due && due < todayIso;
    })
    .map(toRow);
  const weekItems = openMine
    .filter((task) => {
      const due = asIsoDay(task.dueDate || task.targetDate);
      return due && due >= todayIso && due < weekEndIso;
    })
    .map(toRow);

  const blockedMine = openMine
    .filter((task) => String(task.status || "").toLowerCase() === "blocked")
    .map(toRow);

  const actions: HomeActionRow[] = [];
  for (const item of input.reviewItems || []) {
    actions.push({
      id: `approval-${item.id}`,
      kind: "approval",
      title: titleOf(item) || String(item.summary || item.why || "Approval"),
      meta: `${locale === "es" ? "Aprobación" : "Approval"} · ${relativeAge(item.createdAt, locale)}`,
      actionLabel: "approve",
      payload: item,
    });
  }
  for (const request of input.accessRequests || []) {
    const who = String(request.displayName || request.email || "Someone");
    actions.push({
      id: `request-${request.id}`,
      kind: "request",
      title:
        locale === "es"
          ? `${who} pide acceso`
          : `${who} requests access`,
      meta: `Request · ${relativeAge(request.requestedAt || request.updatedAt, locale)}`,
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

  const openProjects = projects.filter((project) => !isClosed(project.status));
  const projectCards: HomeProjectCard[] = openProjects
    .slice(0, 6)
    .map((project) => {
      const projectTasks = (input.tasks || []).filter(
        (task) => String(task.projectId) === String(project.id),
      );
      const projectRisks = risks.filter(
        (risk) => String(risk.projectId) === String(project.id),
      );
      const health = projectHealth(project, projectTasks, projectRisks);
      const blocked = projectTasks.filter(
        (task) => String(task.status || "").toLowerCase() === "blocked",
      ).length;
      const pct = projectPct(projectTasks);
      const due = asIsoDay(
        project.revisedDueDate || project.dueDate || project.targetDate,
      );
      const lineParts: string[] = [];
      if (due) {
        const parsed = parseISO(due);
        lineParts.push(
          isValid(parsed)
            ? `${locale === "es" ? "Hito" : "Milestone"} ${format(parsed, "MMM d", { locale: locale === "es" ? es : enUS })}`
            : due,
        );
      }
      if (blocked) {
        lineParts.push(
          locale === "es"
            ? `${blocked} bloqueado${blocked === 1 ? "" : "s"}`
            : `${blocked} blocked`,
        );
      }
      if (!lineParts.length) {
        lineParts.push(
          health === "on_track"
            ? locale === "es"
              ? "Va en fecha"
              : "On track"
            : health === "blocked"
              ? locale === "es"
                ? "Bloqueado"
                : "Blocked"
              : locale === "es"
                ? "En riesgo"
                : "At risk",
        );
      }
      return {
        id: String(project.id),
        title: titleOf(project),
        health,
        pct,
        line: lineParts.join(" · "),
      };
    });

  const dueCount = todayItems.length + overdueItems.length;
  const blockedCount = blockedMine.length;
  const approvalCount = (input.reviewItems || []).length;
  const dayChips: HomeDayChip[] = [
    { id: "due", count: dueCount, tone: "danger" },
    { id: "blocked", count: blockedCount, tone: "warning" },
    { id: "approvals", count: approvalCount, tone: "info" },
  ].filter((chip) => chip.count > 0) as HomeDayChip[];

  const spotlight = projectCards.find((p) => p.health === "on_track") || projectCards[0];
  let dayLineTail = "";
  if (spotlight) {
    dayLineTail =
      locale === "es"
        ? `${spotlight.title} al ${spotlight.pct}%, ${spotlight.health === "on_track" ? "va en fecha" : spotlight.line}.`
        : `${spotlight.title} at ${spotlight.pct}%, ${spotlight.health === "on_track" ? "on track" : spotlight.line}.`;
  }

  let dayLine: string;
  if (!dayChips.length && !dayLineTail) {
    const oldestInProgress =
      openMine
        .filter((task) => taskWorkLane(task) === "in_progress")
        .sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")))[0] ||
      openMine[0];
    const focus = oldestInProgress ? titleOf(oldestInProgress) : null;
    dayLine = focus
      ? locale === "es"
        ? `Sin vencimientos ni bloqueos. Buen día para avanzar en ${focus}`
        : `Nothing due or blocked. Good day to advance ${focus}`
      : locale === "es"
        ? "Sin vencimientos ni bloqueos. Buen día para avanzar."
        : "Nothing due or blocked. Good day to make progress.";
  } else {
    const prefix = locale === "es" ? "Hoy:" : "Today:";
    dayLine = `${prefix} ${dayLineTail}`.trim();
    if (dayLine.length > 140) dayLine = dayLine.slice(0, 137) + "…";
  }

  const dateLocale = locale === "es" ? es : enUS;
  const longDate = format(now, "EEEE d 'de' MMMM", { locale: dateLocale });
  const longDateEn = format(now, "EEEE, MMMM d", { locale: enUS });

  const next7Days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(startOfDay(now), index);
    const iso = day.toISOString().slice(0, 10);
    const items = openMine
      .filter((task) => asIsoDay(task.dueDate || task.targetDate) === iso)
      .map(toRow);
    return {
      iso,
      label: format(day, "EEE d", { locale: dateLocale }),
      isToday: index === 0,
      items,
    };
  });

  const activity: HomeActivityRow[] = (input.activityItems || [])
    .slice(0, 6)
    .map((item, index) => ({
      id: String(item.id || `act-${index}`),
      text: String(item.summary || item.text || item.action || "Update"),
      when: relativeAge(item.createdAt || item.at, locale),
      avatar: item.avatar || undefined,
    }));

  // Also surface recent task updates the user owns/follows
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
        text:
          locale === "es"
            ? `${titleOf(task)} · ${task.status || "actualizado"}`
            : `${titleOf(task)} · ${task.status || "updated"}`,
        when: relativeAge(task.updatedAt, locale),
      });
    }
  }

  return {
    greeting: greetingFor(input.userName, locale, now),
    longDate: locale === "es" ? longDate : longDateEn,
    dayLine,
    dayChips,
    dayLineTail,
    actions: actionQueue,
    todayItems,
    overdueItems,
    weekItems,
    projects: projectCards,
    next7Days,
    activity: activity.slice(0, 6),
  };
}
