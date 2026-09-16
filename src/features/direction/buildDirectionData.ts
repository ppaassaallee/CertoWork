import { isClosed, localDateKey } from "../../lib/workspaceDisplay";
import {
  isProjectClosed,
  projectAttentionReason,
  projectCheckpointDate,
  projectHealth,
  todayIsoDate,
} from "../../lib/projectPortfolio";
import {
  financeSummary,
  normalizedFinancePeriods,
} from "../../lib/projectFinance";
import { financeMonthKey, financeMonthLabel } from "../../lib/financeChargeTypes";
import { buildWorkloadRows } from "../../lib/workload";
import { tableLifecycleStatus, type TableDoc, type RecordDoc } from "../../lib/tables";

export type DirectionTone = "danger" | "warning" | "ok" | "neutral";

export type DirectionWorkloadRow = {
  userId: string;
  name: string;
  hoursOpen: number;
  hoursCapacity: number;
  ratio: number;
};

export type DirectionOverdueOwner = {
  userId: string | null;
  name: string;
  count: number;
  oldestDays: number;
};

export type DirectionProjectAttention = {
  projectId: string;
  name: string;
  reason: "blocked" | "milestone_overdue" | "milestone_soon" | "no_progress";
  detail: string;
  tone: DirectionTone;
};

export type DirectionControlRow = {
  tableId: string;
  name: string;
  color: string;
  overdue: number;
  dueSoon: number;
};

export type DirectionRequestTop = {
  id: string;
  title: string;
  owner: string;
  ageLabel: string;
  tone: DirectionTone;
};

export type DirectionData = {
  week: { number: number; rangeLabel: string };
  workload: DirectionWorkloadRow[];
  overdueByOwner: DirectionOverdueOwner[];
  projectsAttention: DirectionProjectAttention[];
  onTrackCount: number;
  money: {
    invoiced: number;
    planned: number;
    overdueInvoices: number;
    costs: number;
    marginPct: number | null;
    monthLabel: string;
    monthKey: string;
  };
  controls: DirectionControlRow[];
  requests: {
    unanswered: number;
    olderThan48h: number;
    ticketsOpen: number;
    ticketsCritical: number;
    top: DirectionRequestTop[];
  };
  summaryFallback: string;
};

export type DirectionInput = {
  tasks?: any[];
  projects?: any[];
  members?: Array<{
    id?: string;
    userId?: string;
    displayName?: string;
    email?: string;
    name?: string;
    weeklyCapacityHours?: number;
    capacityHours?: number;
  }>;
  invoices?: any[];
  requests?: any[];
  supportCases?: any[];
  tables?: TableDoc[] | any[];
  records?: RecordDoc[] | any[];
  risks?: any[];
  now?: Date;
  locale?: string;
  unassignedLabel?: string;
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

function isoWeekNumber(now: Date): number {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function formatWeekRange(now: Date, locale: string): string {
  const start = startOfWeek(now);
  const end = endOfWeek(now);
  const fmt = new Intl.DateTimeFormat(locale.startsWith("es") ? "es" : "en", {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(start)}–${fmt.format(end)}`;
}

function dueKey(task: any): string | null {
  const raw = task?.dueDate || task?.targetDate || task?.endDate || null;
  if (!raw) return null;
  if (typeof raw === "string") return raw.slice(0, 10);
  if (raw?.toDate) return raw.toDate().toISOString().slice(0, 10);
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00`);
  const b = Date.parse(`${later}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function taskAssignees(task: any): string[] {
  const ids = [
    ...(Array.isArray(task?.assigneeIds) ? task.assigneeIds : []),
    task?.assigneeId,
    task?.ownerId,
    task?.owner,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

function memberCapacity(
  member: DirectionInput["members"] extends (infer M)[] | undefined ? M : never,
  fallback: number,
): number {
  const raw = Number(member?.weeklyCapacityHours ?? member?.capacityHours ?? fallback);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function memberNameMap(
  members: DirectionInput["members"] = [],
): Map<string, { name: string; capacity: number }> {
  const map = new Map<string, { name: string; capacity: number }>();
  for (const member of members) {
    const id = String(member.userId || member.id || "").trim();
    if (!id) continue;
    map.set(id, {
      name: String(member.displayName || member.name || member.email || id),
      capacity: memberCapacity(member, 40),
    });
  }
  return map;
}

function shortTitle(value: unknown, fallback = "Untitled"): string {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  return text.length > 64 ? `${text.slice(0, 61)}…` : text;
}

function ageLabel(ms: number, locale: string): string {
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  const days = Math.floor(hours / 24);
  if (locale.startsWith("es")) {
    if (days >= 1) return `hace ${days} d`;
    if (hours >= 1) return `hace ${hours} h`;
    return "ahora";
  }
  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  return "now";
}

function timestampMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value && "toMillis" in value) {
    return Number((value as { toMillis: () => number }).toMillis() || 0);
  }
  if (typeof value === "object" && value && "seconds" in value) {
    return Number((value as { seconds: number }).seconds || 0) * 1000;
  }
  return 0;
}

function isActiveTable(table: any): boolean {
  return tableLifecycleStatus(table) === "active";
}

function recordDateValue(record: any, dateColumnId: string | null | undefined): string | null {
  if (!dateColumnId) return null;
  const values = record?.values || {};
  const raw = values[dateColumnId];
  if (!raw) return null;
  if (typeof raw === "string") return raw.slice(0, 10);
  return String(raw).slice(0, 10);
}

function recordStatusDanger(record: any, table: any): boolean {
  const statusCol = table?.keyColumns?.status;
  if (!statusCol) return false;
  const value = String(record?.values?.[statusCol] ?? "").toLowerCase();
  if (!value) return false;
  const options = (table.columns || []).find((col: any) => col.id === statusCol)?.options || [];
  const match = options.find(
    (opt: any) =>
      String(opt.id || "").toLowerCase() === value ||
      String(opt.label || "").toLowerCase() === value,
  );
  const tone = String(match?.tone || "").toLowerCase();
  return tone === "danger" || tone === "red" || value.includes("overdue") || value.includes("vencid");
}

function attentionFromProject(
  project: any,
  projectTasks: any[],
  projectRisks: any[],
  now: Date,
  locale: string,
): DirectionProjectAttention | null {
  if (isProjectClosed(project)) return null;
  const health = projectHealth(project, projectTasks, projectRisks);
  const checkpoint = projectCheckpointDate(project);
  const today = todayIsoDate(now);
  const name = shortTitle(project.title || project.name || project.id, "Project");
  const reasonText = projectAttentionReason(project, projectTasks, projectRisks);

  if (health === "blocked" || projectTasks.some((t) => String(t.status || "").toLowerCase() === "blocked")) {
    const blockedDays = Math.max(
      1,
      ...projectTasks
        .filter((t) => String(t.status || "").toLowerCase() === "blocked")
        .map((t) => {
          const since = dueKey(t) || localDateKey(new Date(timestampMs(t.updatedAt) || now));
          return daysBetween(since, today) || 1;
        }),
    );
    const es = locale.startsWith("es");
    return {
      projectId: String(project.id),
      name,
      reason: "blocked",
      detail: es ? `bloqueado ${blockedDays} d` : `blocked ${blockedDays}d`,
      tone: "danger",
    };
  }

  if (checkpoint && checkpoint < today) {
    const days = daysBetween(checkpoint, today) || 1;
    const es = locale.startsWith("es");
    return {
      projectId: String(project.id),
      name,
      reason: "milestone_overdue",
      detail: es ? `hito vencido ${days} d` : `milestone overdue ${days}d`,
      tone: "danger",
    };
  }

  if (checkpoint) {
    const daysUntil = daysBetween(today, checkpoint);
    if (daysUntil <= 7) {
      const progress = Number(project.progress ?? project.percentComplete ?? NaN);
      const progressLabel = Number.isFinite(progress) ? ` · ${Math.round(progress)}%` : "";
      const es = locale.startsWith("es");
      return {
        projectId: String(project.id),
        name,
        reason: "milestone_soon",
        detail: es
          ? `hito en ${daysUntil} d${progressLabel}`
          : `milestone in ${daysUntil}d${progressLabel}`,
        tone: "warning",
      };
    }
  }

  if (health === "at_risk") {
    const es = locale.startsWith("es");
    return {
      projectId: String(project.id),
      name,
      reason: "no_progress",
      detail: reasonText || (es ? "sin avance" : "no progress"),
      tone: "warning",
    };
  }

  return null;
}

function formatMoneyShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    const k = amount / 1000;
    const rounded = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
    return `$${rounded}k`;
  }
  return `$${Math.round(amount)}`;
}

export function buildDirectionData(input: DirectionInput): DirectionData {
  const now = input.now || new Date();
  const locale = input.locale || "en";
  const unassignedLabel = input.unassignedLabel || (locale.startsWith("es") ? "Sin dueño" : "Unassigned");
  const tasks = input.tasks || [];
  const projects = input.projects || [];
  const members = input.members || [];
  const invoices = input.invoices || [];
  const requests = input.requests || [];
  const supportCases = input.supportCases || [];
  const tables = (input.tables || []).filter(isActiveTable);
  const records = input.records || [];
  const risks = input.risks || [];
  const names = memberNameMap(members);
  const today = todayIsoDate(now);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const openProjects = projects.filter((project) => !isProjectClosed(project));

  // --- Workload (reuse existing load calc, then map + capacity overrides) ---
  const workloadBase = buildWorkloadRows({
    tasks,
    projects: openProjects,
    members,
    capacityHoursPerPerson: 40,
    now,
  });
  const workload: DirectionWorkloadRow[] = workloadBase
    .filter((row) => row.assigneeId !== "unassigned")
    .map((row) => {
      const meta = names.get(row.assigneeId);
      const hoursCapacity = meta?.capacity ?? row.capacityHours ?? 40;
      const hoursOpen = row.estimateHours;
      return {
        userId: row.assigneeId,
        name: meta?.name || row.assigneeName,
        hoursOpen,
        hoursCapacity,
        ratio: hoursCapacity > 0 ? hoursOpen / hoursCapacity : 0,
      };
    })
    .sort((a, b) => b.ratio - a.ratio || b.hoursOpen - a.hoursOpen)
    .slice(0, 6);

  // --- Overdue by owner ---
  const overdueBuckets = new Map<
    string,
    { userId: string | null; name: string; count: number; oldestDays: number }
  >();
  for (const task of tasks) {
    if (isClosed(task.status)) continue;
    const due = dueKey(task);
    if (!due || due >= today) continue;
    const oldestDays = daysBetween(due, today) || 1;
    const assignees = taskAssignees(task);
    const keys = assignees.length ? assignees : ["__none__"];
    for (const key of keys) {
      const isNone = key === "__none__";
      const userId = isNone ? null : key;
      const name = isNone ? unassignedLabel : names.get(key)?.name || key;
      const existing = overdueBuckets.get(key);
      if (!existing) {
        overdueBuckets.set(key, { userId, name, count: 1, oldestDays });
      } else {
        existing.count += 1;
        existing.oldestDays = Math.max(existing.oldestDays, oldestDays);
      }
    }
  }
  const overdueAssigned = Array.from(overdueBuckets.values())
    .filter((row) => row.userId !== null)
    .sort((a, b) => b.count - a.count || b.oldestDays - a.oldestDays);
  const overdueNone = overdueBuckets.get("__none__");
  const overdueByOwner: DirectionOverdueOwner[] = [
    ...overdueAssigned.slice(0, overdueNone ? 4 : 5),
    ...(overdueNone ? [overdueNone] : []),
  ].slice(0, 5);

  // --- Projects needing attention ---
  const projectsAttention: DirectionProjectAttention[] = [];
  let onTrackCount = 0;
  for (const project of openProjects) {
    const projectTasks = tasks.filter((task) => String(task.projectId || "") === String(project.id));
    const projectRisks = risks.filter((risk) => String(risk.projectId || "") === String(project.id));
    const row = attentionFromProject(project, projectTasks, projectRisks, now, locale);
    if (row) projectsAttention.push(row);
    else onTrackCount += 1;
  }
  projectsAttention.sort((a, b) => {
    const rank = { danger: 0, warning: 1, ok: 2, neutral: 3 };
    return rank[a.tone] - rank[b.tone] || a.name.localeCompare(b.name);
  });
  const projectsAttentionTop = projectsAttention.slice(0, 5);

  // --- Money ---
  let invoiced = 0;
  let planned = 0;
  let costs = 0;
  let hasCostEntries = false;
  let hasInvoiceSignal = false;
  for (const project of openProjects) {
    const periods = normalizedFinancePeriods(project);
    for (const period of periods) {
      const matchingEntries = period.entries.filter(
        (entry) => financeMonthKey(entry, period) === monthKey,
      );
      if (!matchingEntries.length && !(period.kind === "monthly" && period.year && period.month)) {
        continue;
      }
      const scoped =
        matchingEntries.length > 0
          ? [{ ...period, entries: matchingEntries }]
          : period.year === now.getFullYear() && period.month === now.getMonth() + 1
            ? [period]
            : [];
      if (!scoped.length) continue;
      const summary = financeSummary(scoped);
      invoiced += summary.invoiced;
      planned += summary.plannedRevenue;
      costs += summary.actualCost;
      if (summary.actualCost > 0 || summary.plannedCost > 0) hasCostEntries = true;
      if (summary.invoiced > 0 || summary.plannedRevenue > 0) hasInvoiceSignal = true;
    }
  }

  const overdueInvoices = invoices.filter((invoice) => {
    if (["void", "paid", "rejected"].includes(String(invoice.status || "").toLowerCase())) {
      return false;
    }
    if (String(invoice.paymentStatus || "").toLowerCase() === "overdue") return true;
    if (String(invoice.paymentStatus || "").toLowerCase() === "paid") return false;
    const due = String(invoice.dueDate || "").slice(0, 10);
    return Boolean(due && due < today);
  }).length;

  const marginPct =
    hasCostEntries && hasInvoiceSignal && invoiced > 0
      ? Math.round(((invoiced - costs) / invoiced) * 100)
      : null;

  // --- Controls (tables) ---
  const soonEnd = new Date(now);
  soonEnd.setDate(soonEnd.getDate() + 7);
  const soonKey = todayIsoDate(soonEnd);
  const controls: DirectionControlRow[] = tables
    .filter((table) => Boolean(table?.keyColumns?.date))
    .map((table) => {
      const dateCol = table.keyColumns.date as string;
      const tableRecords = records.filter(
        (record) => String(record.tableId || "") === String(table.id),
      );
      let overdue = 0;
      let dueSoon = 0;
      for (const record of tableRecords) {
        const date = recordDateValue(record, dateCol);
        if (!date) {
          if (recordStatusDanger(record, table)) overdue += 1;
          continue;
        }
        if (date < today || recordStatusDanger(record, table)) overdue += 1;
        else if (date <= soonKey) dueSoon += 1;
      }
      return {
        tableId: String(table.id),
        name: shortTitle(table.name || table.id, "Table"),
        color: String(table.color || "#7F77DD"),
        overdue,
        dueSoon,
      };
    })
    .filter((row) => row.overdue > 0 || row.dueSoon > 0)
    .sort((a, b) => b.overdue - a.overdue || b.dueSoon - a.dueSoon)
    .slice(0, 5);

  // --- Requests + support ---
  const openTicketStatuses = new Set(["new", "in_progress", "waiting", "open"]);
  const ticketRows = requests.filter((item) => {
    const status = String(item.ticketStatus || item.status || "").toLowerCase();
    return openTicketStatuses.has(status) || status === "";
  });
  const unanswered = ticketRows.filter((item) => {
    const status = String(item.ticketStatus || item.status || "").toLowerCase();
    return status === "new" || status === "waiting" || status === "open" || !status;
  });
  const olderThan48h = unanswered.filter((item) => {
    const created = timestampMs(item.createdAt || item.updatedAt);
    return created > 0 && now.getTime() - created > 48 * 3_600_000;
  }).length;

  const openSupport = supportCases.filter(
    (item) => !["closed", "resolved", "done"].includes(String(item.status || "open").toLowerCase()),
  );
  const ticketsCritical =
    ticketRows.filter((item) => ["1", "critical", "urgent"].includes(String(item.priority || "").toLowerCase()))
      .length +
    openSupport.filter((item) =>
      ["critical", "high"].includes(String(item.severity || "").toLowerCase()),
    ).length;

  const topCandidates: DirectionRequestTop[] = [
    ...unanswered.map((item) => {
      const created = timestampMs(item.createdAt || item.updatedAt) || now.getTime();
      const ageMs = now.getTime() - created;
      const ownerId = String(item.assigneeId || item.ownerId || "");
      const critical = ["1", "critical", "urgent"].includes(String(item.priority || "").toLowerCase());
      return {
        id: String(item.id),
        title: shortTitle(item.title || item.name || item.id),
        owner: names.get(ownerId)?.name || String(item.requesterName || item.assignee || "—"),
        ageLabel: critical
          ? locale.startsWith("es")
            ? "crítico"
            : "critical"
          : ageLabel(ageMs, locale),
        tone: (critical ? "danger" : ageMs > 48 * 3_600_000 ? "warning" : "neutral") as DirectionTone,
      };
    }),
    ...openSupport.map((item) => {
      const created = timestampMs(item.createdAt || item.updatedAt) || now.getTime();
      const critical = ["critical", "high"].includes(String(item.severity || "").toLowerCase());
      return {
        id: String(item.id),
        title: shortTitle(item.title || item.name || item.id),
        owner: String(item.owner || item.assignee || "—"),
        ageLabel: critical
          ? locale.startsWith("es")
            ? "crítico"
            : "critical"
          : ageLabel(now.getTime() - created, locale),
        tone: (critical ? "danger" : "warning") as DirectionTone,
      };
    }),
  ]
    .sort((a, b) => {
      const rank = { danger: 0, warning: 1, ok: 2, neutral: 3 };
      return rank[a.tone] - rank[b.tone];
    })
    .slice(0, 3);

  const overCapacity = workload.filter((row) => row.ratio > 1).length;
  const overdueTotal = overdueByOwner.reduce((sum, row) => sum + row.count, 0);
  const summaryFallback = locale.startsWith("es")
    ? `${overCapacity} persona${overCapacity === 1 ? "" : "s"} sobre capacidad · ${overdueTotal} vencidos · ${formatMoneyShort(invoiced)} de ${formatMoneyShort(planned)}`
    : `${overCapacity} over capacity · ${overdueTotal} overdue · ${formatMoneyShort(invoiced)} of ${formatMoneyShort(planned)}`;

  return {
    week: {
      number: isoWeekNumber(now),
      rangeLabel: formatWeekRange(now, locale),
    },
    workload,
    overdueByOwner,
    projectsAttention: projectsAttentionTop,
    onTrackCount,
    money: {
      invoiced,
      planned,
      overdueInvoices,
      costs,
      marginPct,
      monthLabel: financeMonthLabel(monthKey),
      monthKey,
    },
    controls,
    requests: {
      unanswered: unanswered.length,
      olderThan48h,
      ticketsOpen: ticketRows.length + openSupport.length,
      ticketsCritical,
      top: topCandidates,
    },
    summaryFallback,
  };
}

export function formatDirectionMoney(amount: number): string {
  return formatMoneyShort(amount);
}
