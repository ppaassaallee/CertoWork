import type {
  ActionDef,
  ColumnDef,
  EntityAdapter,
  SavedView,
  Surface,
} from "../../../lib/views/types";
import { projectHealth, projectHealthLabel } from "../../../lib/projectPortfolio";
import { t } from "../../../lib/i18n";

export type ProjectRow = Record<string, unknown> & { id: string };

export type ProjectAdapterDeps = {
  actorId: string;
  workspaceId: string;
  tasks?: Array<Record<string, unknown> & { id?: string; projectId?: string }>;
  risks?: Array<Record<string, unknown> & { projectId?: string }>;
  onUpdateProject: (projectId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onArchiveProject: (project: ProjectRow) => Promise<void> | void;
  onOpenProject: (project: ProjectRow) => void;
  onOpenBrief?: (project: ProjectRow) => void;
  onOpenSummary?: (project: ProjectRow) => void;
};

function readString(row: ProjectRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value == null || value === "") continue;
    return String(value);
  }
  return "";
}

function tasksFor(deps: ProjectAdapterDeps, projectId: string) {
  return (deps.tasks || []).filter((task) => String(task.projectId || "") === projectId);
}

function risksFor(deps: ProjectAdapterDeps, projectId: string) {
  return (deps.risks || []).filter((risk) => String(risk.projectId || "") === projectId);
}

function isOpenTask(task: Record<string, unknown>) {
  const status = String(task.status || "").toLowerCase();
  return !["done", "completed", "closed", "archived", "cancelled"].includes(status);
}

function isBlockedTask(task: Record<string, unknown>) {
  if (task.blocked === true) return true;
  return String(task.status || "").toLowerCase() === "blocked";
}

function nextMilestoneTitle(projectTasks: Array<Record<string, unknown>>): string {
  const dated = projectTasks
    .filter((task) => isOpenTask(task) && (task.dueDate || task.targetDate))
    .sort((a, b) =>
      String(a.dueDate || a.targetDate || "9999").localeCompare(
        String(b.dueDate || b.targetDate || "9999"),
      ),
    );
  const hit = dated[0];
  return hit ? String(hit.title || hit.name || "") : "";
}

export function buildProjectAdapter(
  deps: ProjectAdapterDeps,
): EntityAdapter<ProjectRow> {
  const columns: ColumnDef<ProjectRow>[] = [
    {
      id: "title",
      label: t("views.col.project"),
      type: "text",
      fixed: true,
      sortable: true,
      filterable: true,
      render: "title",
      width: 240,
      read: (row) => readString(row, ["title", "name"]) || "Untitled",
      write: async (row, value) => {
        await deps.onUpdateProject(row.id, { title: String(value || "") });
      },
    },
    {
      id: "client",
      label: t("views.col.client"),
      type: "text",
      sortable: true,
      groupable: true,
      filterable: true,
      read: (row) => readString(row, ["clientEntity", "client", "clientName"]),
      write: async (row, value) => {
        const next = value ? String(value) : null;
        await deps.onUpdateProject(row.id, { clientEntity: next, client: next });
      },
    },
    {
      id: "stage",
      label: t("views.col.stage"),
      type: "dropdown",
      sortable: true,
      groupable: true,
      filterable: true,
      read: (row) => readString(row, ["deliveryStage", "stage"]),
      write: async (row, value) => {
        await deps.onUpdateProject(row.id, {
          deliveryStage: value ? String(value) : null,
        });
      },
      options: () =>
        ["define", "onboarding", "build", "deploy", "operations"].map((id) => ({
          id,
          label: id,
          tone: "neutral",
        })),
    },
    {
      id: "phase",
      label: t("views.col.phase"),
      type: "dropdown",
      sortable: true,
      groupable: true,
      read: (row) => readString(row, ["deliveryPhase", "phase", "productPhase"]),
      write: async (row, value) => {
        await deps.onUpdateProject(row.id, {
          deliveryPhase: value ? String(value) : null,
        });
      },
    },
    {
      id: "health",
      label: t("views.col.health"),
      type: "status",
      sortable: true,
      groupable: true,
      filterable: true,
      width: 120,
      read: (row) => {
        const override = readString(row, ["healthOverride"]);
        if (override) return override;
        const health = projectHealth(
          row,
          tasksFor(deps, row.id),
          risksFor(deps, row.id),
        );
        return health;
      },
      write: async (row, value) => {
        const raw = String(value || "");
        await deps.onUpdateProject(row.id, {
          healthOverride: !raw || raw === "auto" ? null : raw,
        });
      },
      options: () => [
        { id: "on_track", label: projectHealthLabel("on_track"), tone: "success" },
        { id: "at_risk", label: projectHealthLabel("at_risk"), tone: "warning" },
        { id: "blocked", label: projectHealthLabel("blocked"), tone: "danger" },
      ],
    },
    {
      id: "progress",
      label: t("views.col.progress"),
      type: "progress",
      sortable: true,
      read: (row) => {
        const n = Number(row.progress ?? "");
        return Number.isFinite(n) ? n : null;
      },
      write: async (row, value) => {
        const n = value == null || value === "" ? null : Number(value);
        await deps.onUpdateProject(row.id, {
          progress: n != null && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null,
        });
      },
    },
    {
      id: "next_milestone",
      label: t("views.col.nextMilestone"),
      type: "text",
      sortable: true,
      read: (row) => nextMilestoneTitle(tasksFor(deps, row.id)),
    },
    {
      id: "due",
      label: t("views.col.delivery"),
      type: "date",
      sortable: true,
      filterable: true,
      read: (row) => {
        const raw = readString(row, ["revisedDueDate", "dueDate", "targetDate"]);
        return raw ? raw.slice(0, 10) : null;
      },
      write: async (row, value) => {
        await deps.onUpdateProject(row.id, {
          revisedDueDate: value ? String(value) : null,
        });
      },
    },
    {
      id: "owner",
      label: t("views.col.owner"),
      type: "person",
      sortable: true,
      groupable: true,
      filterable: true,
      read: (row) =>
        readString(row, ["projectManagerId", "ownerId", "owner", "contactId"]) ||
        null,
      write: async (row, value) => {
        const id = value ? String(value) : null;
        await deps.onUpdateProject(row.id, {
          projectManagerId: id,
          ownerId: id,
        });
      },
    },
    {
      id: "members",
      label: t("views.col.members"),
      type: "number",
      sortable: true,
      read: (row) => {
        const ids = Array.isArray(row.memberIds)
          ? row.memberIds
          : Array.isArray(row.collaboratorMemberIds)
            ? row.collaboratorMemberIds
            : [];
        return ids.length;
      },
    },
    {
      id: "open_items",
      label: t("views.col.openItems"),
      type: "number",
      sortable: true,
      read: (row) => tasksFor(deps, row.id).filter(isOpenTask).length,
    },
    {
      id: "blocked",
      label: t("views.col.blocked"),
      type: "number",
      sortable: true,
      read: (row) => tasksFor(deps, row.id).filter(isBlockedTask).length,
    },
    {
      id: "budget",
      label: t("views.col.budget"),
      type: "currency",
      sortable: true,
      read: (row) => {
        const n = Number(
          row.budget ?? row.totalUsd ?? row.augustUsd ?? row.initialInvestment ?? "",
        );
        return Number.isFinite(n) ? n : null;
      },
    },
    {
      id: "hours",
      label: t("views.col.hours"),
      type: "text",
      sortable: true,
      read: (row) => {
        const planned = Number(row.plannedHours ?? 0);
        const actual = Number(row.actualHours ?? 0);
        if (!planned && !actual) return "";
        return `${actual || 0}/${planned || 0}`;
      },
    },
    {
      id: "updated",
      label: t("views.col.updated"),
      type: "date",
      sortable: true,
      read: (row) => {
        const raw = readString(row, ["updatedAt"]);
        return raw ? raw.slice(0, 10) : null;
      },
    },
  ];

  const actions: ActionDef<ProjectRow>[] = [
    {
      id: "open",
      label: t("views.action.open"),
      icon: "FolderKanban",
      kind: "row",
      group: "navigate",
      canRun: (rows) => rows.length === 1,
      run: async (rows) => {
        deps.onOpenProject(rows[0]);
      },
    },
    {
      id: "summary",
      label: t("views.action.summary"),
      icon: "FileText",
      kind: "row",
      group: "navigate",
      canRun: (rows) => rows.length === 1,
      run: async (rows) => {
        if (deps.onOpenSummary) deps.onOpenSummary(rows[0]);
        else deps.onOpenProject(rows[0]);
      },
    },
    {
      id: "mark_at_risk",
      label: t("views.action.markAtRisk"),
      icon: "AlertTriangle",
      kind: "both",
      group: "state",
      canRun: (rows) => rows.length > 0,
      run: async (rows) => {
        for (const row of rows) {
          await deps.onUpdateProject(row.id, { healthOverride: "at_risk" });
        }
      },
    },
    {
      id: "mark_on_track",
      label: t("views.action.markOnTrack"),
      icon: "Check",
      kind: "both",
      group: "state",
      canRun: (rows) => rows.length > 0,
      run: async (rows) => {
        for (const row of rows) {
          await deps.onUpdateProject(row.id, { healthOverride: "on_track" });
        }
      },
    },
    {
      id: "brief",
      label: t("views.action.brief"),
      icon: "Sparkles",
      kind: "row",
      group: "ai",
      canRun: (rows) => rows.length === 1,
      run: async (rows, ctx) => {
        if (deps.onOpenBrief) {
          deps.onOpenBrief(rows[0]);
          return;
        }
        ctx.openOdysseus({ entityType: "project", entityId: rows[0].id });
      },
    },
    {
      id: "archive",
      label: t("views.action.archive"),
      icon: "Archive",
      kind: "both",
      group: "danger",
      danger: true,
      canRun: (rows) =>
        rows.length > 0 &&
        rows.some((row) => String(row.status || "").toLowerCase() !== "archived"),
      run: async (rows) => {
        for (const row of rows) await deps.onArchiveProject(row);
      },
    },
  ];

  const defaultColumnIds = [
    "title",
    "client",
    "stage",
    "phase",
    "health",
    "progress",
    "next_milestone",
    "due",
    "owner",
    "members",
    "open_items",
    "blocked",
    "budget",
    "hours",
    "updated",
  ];

  return {
    kind: "project",
    columns,
    actions,
    rowId: (row) => String(row.id),
    defaultView: (surface: Surface): SavedView => {
      const now = new Date().toISOString();
      return {
        id: `default:${surface}`,
        workspaceId: deps.workspaceId,
        surface,
        name: t("views.default"),
        scope: "personal",
        ownerId: deps.actorId,
        layout: "table",
        columns: defaultColumnIds.map((id) => ({ id })),
        quickActions: ["open", "mark_at_risk", "brief", "archive"],
        filters: [],
        sort: [{ columnId: "updated", dir: "desc" }],
        groupBy: null,
        density: "comfortable",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      };
    },
  };
}
