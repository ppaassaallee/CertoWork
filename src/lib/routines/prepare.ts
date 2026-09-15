/**
 * Deterministic prepare for guided rituals (no agent required for v1).
 * Aggregates planned/done/undone items and win signals from workspace snapshots.
 */

import { addDays, startOfWeek } from "date-fns";
import type { PrepareSpec } from "./manifest";
import { isClosed } from "../workspaceDisplay";
import { localDateKey, type DayPlan } from "../dayplan";

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

export type PrepareContext = {
  userId: string;
  tasks: any[];
  projects?: any[];
  comments?: any[];
  routineRuns?: any[];
  lastAlignment?: string | null;
  priorGoals?: Array<{ title: string; status?: string }>;
  protectedBlocks?: Array<{ day: string; start: string; end: string; label?: string }>;
  now?: Date;
  /** Optional day plan for close-day prepare (avoids async Firestore in prepare). */
  dayPlan?: DayPlan | null;
  /** Optional override for "my" items when assignee matching differs from prepare's filter. */
  myItems?: any[];
  /** Table / record scope for record_context gather. */
  tables?: any[];
  records?: any[];
  entityLinks?: any[];
  scopeEntityType?: string;
  scopeEntityId?: string | null;
  tableId?: string | null;
  recordId?: string | null;
};

function normalizeItemStatus(status: unknown): "open" | "done" | "archived" {
  const value = String(status || "").toLowerCase();
  if (value === "done" || value === "completed" || value === "closed") return "done";
  if (value === "archived") return "archived";
  return "open";
}

function asUpdatedDay(value: unknown): string | null {
  return asIsoDay(value);
}

export function prepareRitualData(
  gather: PrepareSpec["gather"],
  ctx: PrepareContext,
): Record<string, unknown> {
  const now = ctx.now || new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const startIso = weekStart.toISOString().slice(0, 10);
  const endIso = weekEnd.toISOString().slice(0, 10);
  const todayIso = now.toISOString().slice(0, 10);

  const mine = (ctx.tasks || []).filter((task) => {
    const ids = [
      ...(Array.isArray(task.assigneeIds) ? task.assigneeIds : []),
      task.assigneeId,
      task.userId,
      task.ownerId,
    ]
      .filter(Boolean)
      .map(String);
    return ids.includes(ctx.userId);
  });

  const inWeek = (task: any) => {
    const due = asIsoDay(task.dueDate || task.targetDate || task.weekOf);
    return due && due >= startIso && due < endIso;
  };

  const planned = mine.filter(inWeek);
  const done = planned.filter((task) => isClosed(task.status) || String(task.status).toLowerCase() === "done");
  const undone = planned.filter((task) => !isClosed(task.status) && String(task.status).toLowerCase() !== "done");
  const blocked = mine.filter((task) => String(task.status || "").toLowerCase() === "blocked");

  const out: Record<string, unknown> = {
    weekStart: startIso,
    weekEnd: endIso,
    todayIso,
  };

  for (const key of gather) {
    if (key === "planned_items") {
      out.planned_items = planned.map((task) => ({
        id: String(task.id),
        title: titleOf(task),
        status: task.status,
        dueIso: asIsoDay(task.dueDate || task.targetDate),
        projectId: task.projectId || null,
      }));
    }
    if (key === "done_items") {
      out.done_items = done.map((task) => ({
        id: String(task.id),
        title: titleOf(task),
        status: task.status,
      }));
    }
    if (key === "undone_items") {
      out.undone_items = undone.map((task) => ({
        id: String(task.id),
        title: titleOf(task),
        status: task.status,
        dueIso: asIsoDay(task.dueDate || task.targetDate),
        projectId: task.projectId || null,
      }));
    }
    if (key === "blocked_items") {
      out.blocked_items = blocked.map((task) => ({
        id: String(task.id),
        title: titleOf(task),
        projectId: task.projectId || null,
      }));
    }
    if (key === "win_signals") {
      const findings: Array<{
        id: string;
        title: string;
        evidence: string;
        kind: string;
        href?: string;
        accepted?: boolean;
      }> = [];

      const closedEpics = mine.filter(
        (task) =>
          /epic|épica/i.test(String(task.workItemType || task.itemType || "")) &&
          (isClosed(task.status) || String(task.status).toLowerCase() === "done") &&
          asIsoDay(task.completedAt || task.updatedAt) &&
          String(asIsoDay(task.completedAt || task.updatedAt)) >= startIso,
      );
      for (const epic of closedEpics.slice(0, 2)) {
        findings.push({
          id: `epic-${epic.id}`,
          title: `Cerraste la épica '${titleOf(epic)}'`,
          evidence: "Épica cerrada esta semana · ver épica",
          kind: "epic",
          href: epic.id,
          accepted: true,
        });
      }

      for (const project of (ctx.projects || []).slice(0, 8)) {
        const before = Number(project.progressLastWeek ?? project.prevPct ?? NaN);
        const after = Number(project.progressPct ?? project.pct ?? NaN);
        if (Number.isFinite(before) && Number.isFinite(after) && after - before >= 10) {
          findings.push({
            id: `progress-${project.id}`,
            title: `${titleOf(project)} pasó de ${before}% a ${after}%`,
            evidence: "Mayor avance semanal del portafolio · ver proyecto",
            kind: "progress",
            href: String(project.id),
            accepted: true,
          });
        }
      }

      for (const comment of (ctx.comments || []).slice(0, 20)) {
        const text = String(comment.text || comment.body || "");
        if (/impecable|excelente|gracias|great|shipped|bravo/i.test(text)) {
          findings.push({
            id: `comment-${comment.id}`,
            title: `${comment.authorName || "Alguien"}: '${text.slice(0, 72)}'`,
            evidence: "Comentario de reconocimiento · ver",
            kind: "mention",
            accepted: false,
          });
        }
      }

      const runs = (ctx.routineRuns || []).filter((run) => {
        const day = asIsoDay(run.finishedAt || run.startedAt);
        return day && day >= startIso && day < endIso && run.status === "completed";
      });
      if (runs.length) {
        findings.push({
          id: "routines-week",
          title: `${runs.length} rutinas corrieron solas: 0 fallos`,
          evidence: "Corridas automáticas esta semana · ver corridas",
          kind: "automation",
          accepted: true,
        });
      }

      if (!findings.length) {
        findings.push({
          id: "done-count",
          title: `Cerraste ${done.length} ítems esta semana`,
          evidence: `${planned.length} planeados · ver lista`,
          kind: "automation",
          accepted: true,
        });
      }

      out.win_signals = findings.slice(0, 5);
    }
    if (key === "prior_goals") {
      out.prior_goals = ctx.priorGoals || [];
    }
    if (key === "protected_blocks") {
      out.protected_blocks = ctx.protectedBlocks || [];
    }
    if (key === "week_deadlines") {
      out.week_deadlines = mine
        .filter((task) => {
          const due = asIsoDay(task.dueDate || task.targetDate);
          return due && due >= todayIso && due < endIso && !isClosed(task.status);
        })
        .map((task) => ({
          id: String(task.id),
          title: titleOf(task),
          dueIso: asIsoDay(task.dueDate || task.targetDate),
        }));
    }
    if (key === "epic_candidates") {
      out.epic_candidates = mine
        .filter((task) =>
          /epic|épica|pbi|feature/i.test(String(task.workItemType || task.itemType || task.title || "")),
        )
        .slice(0, 6)
        .map((task) => ({
          id: String(task.id),
          title: titleOf(task),
          status: task.status,
        }));
    }
    if (key === "calendar_load") {
      out.calendar_load = { connected: false, busyHours: 0 };
    }
    if (key === "last_alignment") {
      out.last_alignment = ctx.lastAlignment || null;
    }
    if (key === "day_summary") {
      const date = localDateKey(now);
      const plan = ctx.dayPlan ?? null;
      const itemPool = Array.isArray(ctx.myItems) && ctx.myItems.length ? ctx.myItems : mine;
      const byId = new Map(itemPool.map((task) => [String(task.id), task]));
      const plannedIds =
        plan?.plannedItemIds?.length
          ? plan.plannedItemIds
          : itemPool
              .filter((task) => {
                const due = asIsoDay(task.dueDate || task.targetDate);
                return (
                  Boolean(task.isOneThing) ||
                  due === date ||
                  String(task.timeSector || "").toLowerCase() === "today"
                );
              })
              .map((task) => String(task.id));

      const items = plannedIds
        .map((id) => {
          const task = byId.get(id);
          if (!task) return null;
          const project = (ctx.projects || []).find(
            (row) => String(row.id) === String(task.projectId || ""),
          );
          return {
            id,
            title: titleOf(task),
            type: String(task.workItemType || task.itemType || task.type || ""),
            projectTitle: project ? titleOf(project) : undefined,
            status: normalizeItemStatus(task.status),
          };
        })
        .filter(Boolean) as Array<{
        id: string;
        title: string;
        type?: string;
        projectTitle?: string;
        status: "open" | "done" | "archived";
      }>;

      const keyId = plan?.keyItemId || itemPool.find((task) => task.isOneThing)?.id || null;
      const keyTask = keyId ? byId.get(String(keyId)) : null;
      const keyItem = keyTask
        ? {
            id: String(keyTask.id),
            title: titleOf(keyTask),
            done: normalizeItemStatus(keyTask.status) === "done",
          }
        : null;

      const doneCount = items.filter((item) => item.status === "done").length;
      const remainingCount = items.filter((item) => item.status === "open").length;

      const openFuture = itemPool
        .map((task) => {
          const due = asIsoDay(task.dueDate || task.targetDate);
          if (!due || due < date) return null;
          if (normalizeItemStatus(task.status) !== "open") return null;
          const updated = asUpdatedDay(task.updatedAt);
          const daysLeft = Math.max(
            0,
            Math.round(
              (new Date(`${due}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) /
                86_400_000,
            ),
          );
          return {
            id: String(task.id),
            title: titleOf(task),
            dueDate: due,
            daysLeft,
            touchedToday: updated === date,
          };
        })
        .filter(Boolean) as Array<{
        id: string;
        title: string;
        dueDate: string;
        daysLeft: number;
        touchedToday: boolean;
      }>;
      openFuture.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.daysLeft - b.daysLeft);
      const nearestDeadline = openFuture[0] || null;

      out.day_summary = {
        date,
        keyItem,
        items,
        doneCount,
        remainingCount,
        nearestDeadline,
      };
    }
    if (key === "record_context") {
      const scopeType = String(ctx.scopeEntityType || "").toLowerCase();
      const scopeId = ctx.scopeEntityId ? String(ctx.scopeEntityId) : null;
      const tableId =
        ctx.tableId != null
          ? String(ctx.tableId)
          : scopeType === "table"
            ? scopeId
            : null;
      const recordId =
        ctx.recordId != null
          ? String(ctx.recordId)
          : scopeType === "record"
            ? scopeId
            : null;

      const tables = ctx.tables || [];
      const records = ctx.records || [];
      const links = ctx.entityLinks || [];

      const table =
        (tableId && tables.find((row) => String(row.id) === tableId)) ||
        (recordId
          ? tables.find((row) =>
              records.some(
                (rec) => String(rec.id) === recordId && String(rec.tableId) === String(row.id),
              ),
            )
          : null) ||
        null;

      const record =
        (recordId && records.find((row) => String(row.id) === recordId)) ||
        (tableId
          ? records.find((row) => String(row.tableId) === String(table?.id || tableId))
          : null) ||
        null;

      const recordLinks = record
        ? links.filter(
            (link) =>
              (String(link.fromEntityType || "") === "record" &&
                String(link.fromEntityId || "") === String(record.id)) ||
              (String(link.toEntityType || "") === "record" &&
                String(link.toEntityId || "") === String(record.id)),
          )
        : [];

      out.record_context = {
        table: table
          ? {
              id: String(table.id),
              name: titleOf(table),
              keyColumns: table.keyColumns || null,
              columns: Array.isArray(table.columns) ? table.columns : [],
            }
          : null,
        record: record
          ? {
              id: String(record.id),
              tableId: String(record.tableId || table?.id || ""),
              values: record.values || {},
              updatedAt: record.updatedAt || null,
            }
          : null,
        links: recordLinks.map((link) => ({
          id: String(link.id || ""),
          fromEntityType: link.fromEntityType || null,
          fromEntityId: link.fromEntityId || null,
          toEntityType: link.toEntityType || null,
          toEntityId: link.toEntityId || null,
          relation: link.relation || link.kind || null,
        })),
      };
    }
  }

  out.metrics = {
    planned: planned.length,
    done: done.length,
    undone: undone.length,
    blocked: blocked.length,
  };

  return out;
}

export function mondayExpiryIso(from = new Date()): string {
  const d = new Date(from);
  const day = d.getDay(); // 0 Sun
  const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + add);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
