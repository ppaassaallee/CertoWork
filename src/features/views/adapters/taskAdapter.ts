import type {
  ActionDef,
  ColumnDef,
  EntityAdapter,
  SavedView,
  Surface,
} from "../../../lib/views/types";
import { dueDateTimingPatch, todayTimingPatch } from "../../../lib/itemTiming";
import { appendStatusHistory } from "../../../lib/kanbanFeatures";
import { setKeyItem } from "../../../lib/dayplan/storage";
import { localDateKey } from "../../../lib/dayplan/types";
import { ancestorCandidateIds } from "../../../lib/itemHierarchy";
import { t } from "../../../lib/i18n";

/** Loose row shape — My Work mixes tasks and table records. */
export type TaskRow = Record<string, unknown> & { id: string };

export type TaskAdapterDeps = {
  actorId: string;
  workspaceId: string;
  projects?: Array<{ id: string; title?: string; name?: string }>;
  members?: Array<{ id: string; displayName?: string; email?: string }>;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onOpenCollab?: (projectId: string) => void;
  onDuplicate?: (row: TaskRow) => Promise<void> | void;
  onStartRoutine?: (row: TaskRow) => Promise<void> | void;
};

function asTaskRow(row: TaskRow): TaskRow {
  return row;
}

function readString(row: TaskRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value == null || value === "") continue;
    return String(value);
  }
  return "";
}

function readDate(row: TaskRow, keys: string[]): string | null {
  const raw = readString(row, keys);
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : raw;
}

function assigneeIdsOf(row: TaskRow): string[] {
  if (Array.isArray(row.assigneeIds)) return row.assigneeIds.map(String).filter(Boolean);
  const single = readString(row, ["assigneeId", "owner", "assignee", "userId"]);
  return single ? [single] : [];
}

function statusPatch(row: TaskRow, nextStatus: string): Record<string, unknown> {
  return {
    status: nextStatus,
    statusHistory: appendStatusHistory(row, nextStatus, nextStatus),
    completedAt:
      nextStatus === "done" ? row.completedAt || new Date().toISOString() : null,
  };
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

export function buildTaskAdapter(deps: TaskAdapterDeps): EntityAdapter<TaskRow> {
  const projectLabel = (id: string) => {
    const project = (deps.projects || []).find((entry) => entry.id === id);
    return project ? String(project.title || project.name || id) : id;
  };

  const columns: ColumnDef<TaskRow>[] = [
    {
      id: "title",
      label: t("views.col.title"),
      type: "text",
      fixed: true,
      sortable: true,
      filterable: true,
      render: "hierarchy",
      width: 280,
      read: (row) => readString(row, ["title", "name"]) || "Untitled",
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, { title: String(value || "") });
      },
    },
    {
      id: "type",
      label: t("views.col.type"),
      type: "dropdown",
      sortable: true,
      groupable: true,
      filterable: true,
      read: (row) =>
        readString(row, ["workItemType", "itemType", "taskType", "type", "kind"]),
      write: async (row, value) => {
        const next = String(value || "");
        await deps.onUpdateTask(row.id, {
          workItemType: next || null,
          itemType: next || null,
          taskType: next || null,
        });
      },
    },
    {
      id: "status",
      label: t("views.col.status"),
      type: "status",
      sortable: true,
      groupable: true,
      filterable: true,
      width: 120,
      read: (row) => readString(row, ["status"]) || "open",
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, statusPatch(row, String(value || "open")));
      },
      options: () => [
        { id: "open", label: t("tables.status.todo"), tone: "neutral" },
        { id: "doing", label: t("tables.status.doing"), tone: "info" },
        { id: "done", label: t("tables.status.done"), tone: "success" },
        { id: "blocked", label: "Blocked", tone: "danger" },
        { id: "archived", label: t("views.action.archive"), tone: "neutral" },
      ],
    },
    {
      id: "priority",
      label: t("views.col.priority"),
      type: "dropdown",
      sortable: true,
      groupable: true,
      filterable: true,
      width: 90,
      read: (row) => {
        const raw = row.priority;
        if (raw == null || raw === "") return "";
        return String(raw);
      },
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, {
          priority: value == null || value === "" ? null : value,
        });
      },
      options: () =>
        ["P1", "P2", "P3", "P4"].map((id) => ({
          id,
          label: id,
          tone: id === "P1" ? "danger" : id === "P2" ? "warning" : "neutral",
        })),
    },
    {
      id: "assignee",
      label: t("views.col.assignee"),
      type: "person",
      sortable: true,
      groupable: true,
      filterable: true,
      width: 140,
      read: (row) => {
        const ids = assigneeIdsOf(row);
        return ids[0] || null;
      },
      write: async (row, value) => {
        const id = value == null || value === "" ? null : String(value);
        await deps.onUpdateTask(row.id, {
          assigneeIds: id ? [id] : [],
          assigneeId: id,
          owner: id,
          assignee: id,
          assignees: id ? [id] : [],
        });
      },
    },
    {
      id: "start",
      label: t("views.col.start"),
      type: "date",
      sortable: true,
      filterable: true,
      read: (row) => readDate(row, ["startDate"]),
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, {
          startDate: value ? String(value) : null,
        });
      },
    },
    {
      id: "due",
      label: t("views.col.due"),
      type: "date",
      sortable: true,
      filterable: true,
      width: 120,
      read: (row) => readDate(row, ["dueDate", "targetDate"]),
      write: async (row, value) => {
        await deps.onUpdateTask(
          row.id,
          dueDateTimingPatch(value ? String(value) : null),
        );
      },
    },
    {
      id: "sprint",
      label: t("views.col.sprint"),
      type: "text",
      sortable: true,
      groupable: true,
      read: (row) => readString(row, ["sprintId", "sprint"]),
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, {
          sprintId: value ? String(value) : null,
        });
      },
    },
    {
      id: "estimate",
      label: t("views.col.estimate"),
      type: "number",
      sortable: true,
      read: (row) => {
        const n = Number(row.estimateHours ?? row.storyPoints ?? "");
        return Number.isFinite(n) ? n : null;
      },
      write: async (row, value) => {
        const n = value == null || value === "" ? null : Number(value);
        await deps.onUpdateTask(row.id, {
          estimateHours: n != null && Number.isFinite(n) ? n : null,
        });
      },
    },
    {
      id: "epic",
      label: t("views.col.epic"),
      type: "text",
      sortable: true,
      groupable: true,
      read: (row) => readString(row, ["epicId", "epic"]),
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, {
          epicId: value ? String(value) : null,
        });
      },
    },
    {
      id: "project",
      label: t("views.col.project"),
      type: "text",
      sortable: true,
      groupable: true,
      filterable: true,
      width: 140,
      read: (row) => {
        const id = readString(row, ["projectId"]);
        return id ? projectLabel(id) : "";
      },
    },
    {
      id: "tags",
      label: t("views.col.tags"),
      type: "tags",
      filterable: true,
      read: (row) => {
        if (Array.isArray(row.tags)) return row.tags.map(String);
        if (Array.isArray(row.labels)) return row.labels.map(String);
        return [];
      },
      write: async (row, value) => {
        const tags = Array.isArray(value)
          ? value.map(String)
          : String(value || "")
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean);
        await deps.onUpdateTask(row.id, { tags, labels: tags });
      },
    },
    {
      id: "progress",
      label: t("views.col.progress"),
      type: "number",
      sortable: true,
      read: (row) => {
        const n = Number(row.progress ?? row.percentComplete ?? "");
        return Number.isFinite(n) ? n : null;
      },
      write: async (row, value) => {
        const n = value == null || value === "" ? null : Number(value);
        await deps.onUpdateTask(row.id, {
          progress: n != null && Number.isFinite(n) ? n : null,
        });
      },
    },
    {
      id: "difficulty",
      label: t("views.col.difficulty"),
      type: "dropdown",
      sortable: true,
      read: (row) => readString(row, ["difficulty", "complexity"]),
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, {
          difficulty: value ? String(value) : null,
        });
      },
    },
    {
      id: "delivery",
      label: t("views.col.delivery"),
      type: "text",
      sortable: true,
      groupable: true,
      read: (row) => readString(row, ["deliveryEntity", "bpo", "delivery"]),
      write: async (row, value) => {
        const next = value ? String(value) : null;
        await deps.onUpdateTask(row.id, {
          deliveryEntity: next,
          bpo: next,
        });
      },
    },
    {
      id: "client",
      label: t("views.col.client"),
      type: "text",
      sortable: true,
      groupable: true,
      read: (row) => readString(row, ["clientEntity", "client"]),
      write: async (row, value) => {
        const next = value ? String(value) : null;
        await deps.onUpdateTask(row.id, {
          clientEntity: next,
          client: next,
        });
      },
    },
    {
      id: "category",
      label: t("views.col.category"),
      type: "text",
      sortable: true,
      groupable: true,
      read: (row) => readString(row, ["workCategory", "category"]),
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, {
          workCategory: value ? String(value) : null,
        });
      },
    },
    {
      id: "phase",
      label: t("views.col.phase"),
      type: "text",
      sortable: true,
      groupable: true,
      read: (row) => readString(row, ["productPhase", "phase"]),
      write: async (row, value) => {
        await deps.onUpdateTask(row.id, {
          productPhase: value ? String(value) : null,
        });
      },
    },
    {
      id: "gtd",
      label: t("views.col.gtd"),
      type: "dropdown",
      sortable: true,
      groupable: true,
      read: (row) =>
        readString(row, ["gtdActionType", "actionType", "globalStageId"]),
      write: async (row, value) => {
        const next = value ? String(value) : null;
        await deps.onUpdateTask(row.id, {
          actionType: next,
          gtdActionType: next,
          globalStageId: next,
        });
      },
    },
    {
      id: "action_board",
      label: t("views.col.actionBoard"),
      type: "text",
      read: (row) => readString(row, ["actionBoard", "board", "timeSector"]),
    },
    {
      id: "created",
      label: t("views.col.created"),
      type: "date",
      sortable: true,
      read: (row) => readDate(row, ["createdAt"]),
    },
    {
      id: "updated",
      label: t("views.col.updated"),
      type: "date",
      sortable: true,
      read: (row) => readDate(row, ["updatedAt"]),
    },
  ];

  const actions: ActionDef<TaskRow>[] = [
    {
      id: "complete",
      label: t("views.action.complete"),
      icon: "Check",
      kind: "both",
      group: "state",
      shortcut: "E",
      canRun: (rows) =>
        rows.length > 0 &&
        rows.some((row) => String(row.status || "").toLowerCase() !== "done"),
      run: async (rows) => {
        for (const row of rows) {
          if (String(row.status || "").toLowerCase() === "done") continue;
          await deps.onUpdateTask(row.id, statusPatch(asTaskRow(row), "done"));
        }
      },
    },
    {
      id: "key_today",
      label: t("views.action.keyToday"),
      icon: "Star",
      kind: "row",
      group: "time",
      shortcut: "K",
      canRun: (rows) => rows.length === 1 && Boolean(deps.actorId),
      run: async (rows, ctx) => {
        await setKeyItem(
          deps.actorId || ctx.userId,
          deps.workspaceId || ctx.workspaceId,
          localDateKey(),
          rows[0].id,
        );
        ctx.toast(t("views.toast.keySet"));
      },
    },
    {
      id: "assign_me",
      label: t("views.action.assignMe"),
      icon: "UserPlus",
      kind: "both",
      group: "assign",
      canRun: (rows, ctx) => rows.length > 0 && Boolean(ctx.userId),
      run: async (rows, ctx) => {
        for (const row of rows) {
          await deps.onUpdateTask(row.id, {
            assigneeIds: [ctx.userId],
            assigneeId: ctx.userId,
            owner: ctx.userId,
            assignee: ctx.userId,
            assignees: [ctx.userId],
          });
        }
      },
    },
    {
      id: "set_status",
      label: t("views.action.setStatus"),
      icon: "CircleDot",
      kind: "both",
      group: "state",
      canRun: (rows) => rows.length > 0,
      run: async (rows) => {
        for (const row of rows) {
          const next =
            String(row.status || "").toLowerCase() === "done" ? "open" : "doing";
          await deps.onUpdateTask(row.id, statusPatch(row, next));
        }
      },
    },
    {
      id: "move_tomorrow",
      label: t("views.action.moveTomorrow"),
      icon: "Calendar",
      kind: "both",
      group: "time",
      canRun: (rows) => rows.length > 0,
      run: async (rows) => {
        const patch = dueDateTimingPatch(addDaysIso(1));
        for (const row of rows) await deps.onUpdateTask(row.id, patch);
      },
    },
    {
      id: "move_next_week",
      label: t("views.action.moveNextWeek"),
      icon: "CalendarDays",
      kind: "both",
      group: "time",
      canRun: (rows) => rows.length > 0,
      run: async (rows) => {
        const patch = dueDateTimingPatch(addDaysIso(7));
        for (const row of rows) await deps.onUpdateTask(row.id, patch);
      },
    },
    {
      id: "odysseus",
      label: t("views.action.odysseus"),
      icon: "Sparkles",
      kind: "row",
      group: "ai",
      canRun: (rows) => rows.length === 1,
      run: async (rows, ctx) => {
        ctx.openOdysseus({ entityType: "task", entityId: rows[0].id });
      },
    },
    {
      id: "routine",
      label: t("views.action.routine"),
      icon: "Repeat",
      kind: "row",
      group: "time",
      canRun: (rows) => rows.length === 1,
      run: async (rows) => {
        if (deps.onStartRoutine) {
          await deps.onStartRoutine(rows[0]);
          return;
        }
        await deps.onUpdateTask(rows[0].id, {
          isRoutineTask: true,
          recurrenceStatus: "active",
        });
      },
    },
    {
      id: "open_collab",
      label: t("views.action.openCollab"),
      icon: "MessageSquare",
      kind: "row",
      group: "navigate",
      canRun: (rows) =>
        rows.length === 1 &&
        Boolean(readString(rows[0], ["projectId"])) &&
        Boolean(deps.onOpenCollab),
      run: async (rows) => {
        const projectId = readString(rows[0], ["projectId"]);
        if (projectId && deps.onOpenCollab) deps.onOpenCollab(projectId);
      },
    },
    {
      id: "duplicate",
      label: t("views.action.duplicate"),
      icon: "Copy",
      kind: "row",
      group: "navigate",
      canRun: (rows) => rows.length === 1 && Boolean(deps.onDuplicate),
      run: async (rows) => {
        if (deps.onDuplicate) await deps.onDuplicate(rows[0]);
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
        for (const row of rows) {
          await deps.onUpdateTask(row.id, statusPatch(row, "archived"));
        }
      },
    },
  ];

  const defaultColumns = [
    "title",
    "project",
    "delivery",
    "client",
    "tags",
    "category",
    "phase",
    "status",
    "priority",
    "gtd",
    "assignee",
    "due",
    "sprint",
  ];

  return {
    kind: "task",
    columns,
    actions,
    rowId: (row) => String(row.id),
    parentId: (row) => {
      const ids = ancestorCandidateIds(row);
      return ids[0] || null;
    },
    defaultView: (surface: Surface): SavedView => {
      const now = new Date().toISOString();
      const isProject = surface.startsWith("project:");
      return {
        id: `default:${surface}`,
        workspaceId: deps.workspaceId,
        surface,
        name: isProject ? t("views.default") : t("views.myView"),
        scope: "personal",
        ownerId: deps.actorId,
        layout: "table",
        columns: defaultColumns.map((id) => ({ id })),
        quickActions: isProject
          ? ["complete", "assign_me", "odysseus", "archive"]
          : ["complete", "key_today", "odysseus", "assign_me"],
        filters: isProject ? [] : [{ columnId: "assignee", op: "me" }],
        sort: [{ columnId: "due", dir: "asc" }],
        groupBy: isProject ? "epic" : null,
        density: "comfortable",
        showSubtasks: true,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      };
    },
  };
}

export function buildMyWorkSystemViews(
  workspaceId: string,
  ownerId: string,
  personalDefault: SavedView,
): SavedView[] {
  const now = new Date().toISOString();
  const base = {
    workspaceId,
    surface: "my-work" as Surface,
    ownerId,
    layout: "table" as const,
    columns: personalDefault.columns,
    quickActions: personalDefault.quickActions,
    sort: personalDefault.sort,
    groupBy: null as string | null,
    density: personalDefault.density,
    showSubtasks: true,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    scope: "team" as const,
  };
  return [
    personalDefault,
    {
      ...base,
      id: "system:my-work:today",
      name: t("myWorkToday"),
      filters: [
        { columnId: "assignee", op: "me" },
        { columnId: "due", op: "today" },
      ],
    },
    {
      ...base,
      id: "system:my-work:overdue",
      name: t("views.overdue"),
      filters: [
        { columnId: "assignee", op: "me" },
        { columnId: "due", op: "overdue" },
      ],
    },
    {
      ...base,
      id: "system:my-work:week",
      name: t("myWorkThisWeek"),
      filters: [
        { columnId: "assignee", op: "me" },
        { columnId: "due", op: "week" },
      ],
    },
  ];
}

/** Mark today timing on a task (same as ItemModal Today button). */
export async function markTaskToday(
  onUpdateTask: TaskAdapterDeps["onUpdateTask"],
  taskId: string,
): Promise<void> {
  await onUpdateTask(taskId, todayTimingPatch());
}
