/**
 * Certo Rutinas — Cloudflare cron runner (Phase 2).
 * Queries due active routines, takes a short lease, writes a run, advances nextRunAt.
 */

import {
  firestoreAdminConfigured,
  firestoreCreateDocument,
  firestoreGetDocument,
  firestorePatchDocument,
  firestoreRunQuery,
} from "./firestoreAdmin.js";

const MAX_DUE_PER_TICK = 12;
const LEASE_MS = 4 * 60_000;
const FAILING_STREAK = 3;

function parseCronParts(cron) {
  const parts = String(cron || "")
    .trim()
    .split(/\s+/);
  if (parts.length !== 5) return null;
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (!Number.isFinite(minute) || !Number.isFinite(hour)) return null;
  return {
    minute,
    hour,
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

function dayAllowed(dayOfWeek, jsDay) {
  if (dayOfWeek === "*") return true;
  if (dayOfWeek.includes("-")) {
    const [from, to] = dayOfWeek.split("-").map(Number);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    return jsDay >= from && jsDay <= to;
  }
  if (dayOfWeek.includes(",")) {
    return dayOfWeek.split(",").map(Number).includes(jsDay);
  }
  return Number(dayOfWeek) === jsDay;
}

function dayOfMonthAllowed(expr, date) {
  if (expr === "*") return true;
  if (expr.startsWith("*/")) {
    const step = Number(expr.slice(2));
    if (!Number.isFinite(step) || step < 1) return false;
    const dayIndex = Math.floor(date.getTime() / 86_400_000);
    return dayIndex % step === 0;
  }
  return Number(expr) === date.getUTCDate();
}

function localParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    weekday: weekdayMap[bag.weekday] ?? 0,
  };
}

/** Exported for unit tests. */
export function computeNextRunAt(cron, timezone, from = new Date()) {
  const parts = parseCronParts(cron);
  if (!parts) return null;
  const tz = timezone || "UTC";
  const start = new Date(from.getTime() + 60_000);
  for (let offset = 0; offset < 400 * 24 * 60; offset += 1) {
    const candidate = new Date(start.getTime() + offset * 60_000);
    const local = localParts(candidate, tz);
    if (local.minute !== parts.minute || local.hour !== parts.hour) continue;
    if (!dayAllowed(parts.dayOfWeek, local.weekday)) continue;
    if (!dayOfMonthAllowed(parts.dayOfMonth, candidate)) continue;
    return candidate;
  }
  return null;
}

function slotKey(iso) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return String(iso || "unknown").replace(/[^\w.-]/g, "_");
  return at.toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

function stringValue(value) {
  return { stringValue: String(value) };
}

export async function queryDueRoutines(env, now = new Date()) {
  const nowIso = now.toISOString();
  return firestoreRunQuery(env, {
    from: [{ collectionId: "routines" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: stringValue("active"),
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "nextRunAt" },
              op: "LESS_THAN_OR_EQUAL",
              value: stringValue(nowIso),
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: "nextRunAt" }, direction: "ASCENDING" }],
    limit: MAX_DUE_PER_TICK,
  });
}

async function claimLease(env, routine, now) {
  const leaseUntil = routine.leaseUntil ? new Date(routine.leaseUntil) : null;
  if (leaseUntil && !Number.isNaN(leaseUntil.getTime()) && leaseUntil.getTime() > now.getTime()) {
    return { ok: false, reason: "leased" };
  }
  const nextLease = new Date(now.getTime() + LEASE_MS).toISOString();
  const scheduledFor = String(routine.nextRunAt || now.toISOString());
  const patch = await firestorePatchDocument(env, "routines", routine.id, {
    leaseUntil: nextLease,
    leaseScheduledFor: scheduledFor,
  });
  if (!patch.ok) return { ok: false, reason: patch.reason || "lease_failed" };

  // Re-read to detect lost races (another tick overwrote leaseScheduledFor).
  const fresh = await firestoreGetDocument(env, "routines", routine.id);
  if (!fresh || fresh.leaseScheduledFor !== scheduledFor) {
    return { ok: false, reason: "lost_race" };
  }
  return { ok: true, scheduledFor, fresh };
}

function buildScheduledOutput(routine) {
  const scopeTitle = routine.scope?.entityTitle || routine.scope?.entityType || "alcance";
  const language = routine.deliverable?.language === "en" ? "en" : "es";
  const goal = String(routine.goal || routine.title || "");
  const steps =
    language === "es"
      ? [
          { kind: "read", label: `Leí el contexto de ${scopeTitle}` },
          { kind: "think", label: `Evalué el objetivo: ${goal.slice(0, 80)}` },
          { kind: "draft", label: "Redacté la entrega programada" },
          { kind: "deliver", label: "Corrida programada registrada (entrega diferida a Phase 2+)" },
        ]
      : [
          { kind: "read", label: `Read context for ${scopeTitle}` },
          { kind: "think", label: `Evaluated goal: ${goal.slice(0, 80)}` },
          { kind: "draft", label: "Drafted the scheduled deliverable" },
          { kind: "deliver", label: "Scheduled run recorded (delivery deferred to Phase 2+)" },
        ];
  const text =
    language === "es"
      ? [
          `Corrida programada — ${scopeTitle}`,
          "",
          `Objetivo: ${goal}`,
          "",
          "Esta corrida quedó registrada por el scheduler de Certo.",
          "La entrega completa (correo / comentario) se habilita en fases siguientes.",
          "",
          "— Certo Rutinas",
        ].join("\n")
      : [
          `Scheduled run — ${scopeTitle}`,
          "",
          `Goal: ${goal}`,
          "",
          "This run was recorded by Certo's scheduler.",
          "Full delivery (email / comment) lands in later phases.",
          "",
          "— Certo Routines",
        ].join("\n");
  return { text, steps };
}

async function maybeNotifyOwner(env, sendEmail, routine, text) {
  if (typeof sendEmail !== "function") return { sent: false };
  if (routine.deliverable?.channel !== "email") return { sent: false };
  const to = Array.isArray(routine.deliverable?.to) ? routine.deliverable.to.filter(Boolean) : [];
  if (!to.length) return { sent: false };
  // Phase 2: never auto-send to third parties.
  if (routine.permissions?.writeOthers === "always" || routine.permissions?.writeOthers === "ask") {
    // Owner-only is writeOthers=never; ask/always means draft-only until Approvals (Phase 4).
    if (routine.permissions.writeOthers !== "never") {
      return { sent: false, reason: "needs_approval" };
    }
  }
  try {
    const senderEmail = env.CERTO_EMAIL_FROM || "support@certo.work";
    const senderName = env.CERTO_EMAIL_FROM_NAME || "Certo Work";
    const result = await sendEmail(env, {
      sender: { name: senderName, email: senderEmail },
      to: to.map((email) => ({ email })),
      replyTo: { email: env.CERTO_EMAIL_REPLY_TO || senderEmail, name: senderName },
      subject: `[Certo] ${routine.title || "Rutina"}`,
      htmlContent: `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    });
    if (result && result.sent === false) {
      return { sent: false, reason: result.error || "email_failed" };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "email_failed" };
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function finishRoutine(env, routine, scheduledFor, result) {
  const trigger = routine.trigger || {};
  let nextRunAt = null;
  if (trigger.kind === "schedule" && trigger.cron) {
    const next = computeNextRunAt(trigger.cron, trigger.timezone || "UTC", new Date(scheduledFor));
    nextRunAt = next ? next.toISOString() : null;
  }

  const stats = routine.stats || {};
  const runs30d = Number(stats.runs30d || 0) + 1;
  const success30d = Number(stats.success30d || 0) + (result.status === "completed" ? 1 : 0);
  const failStreak =
    result.status === "completed" ? 0 : Number(routine.failStreak || 0) + 1;
  const status = failStreak >= FAILING_STREAK ? "failing" : "active";

  await firestorePatchDocument(env, "routines", routine.id, {
    lastRunAt: result.finishedAt,
    lastRunStatus: result.status,
    nextRunAt: status === "failing" ? null : nextRunAt,
    leaseUntil: null,
    leaseScheduledFor: null,
    failStreak,
    status,
    stats: {
      ...stats,
      runs30d,
      success30d,
      actions30d: Number(stats.actions30d || 0),
      pending: Number(stats.pending || 0),
      minutesSavedEstimate: Number(stats.minutesSavedEstimate || 0),
      costUsd30d: Number(stats.costUsd30d || 0),
    },
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Process due routines for one cron tick.
 * @param {{ sendEmail?: Function }} helpers
 */
export async function processDueRoutines(env, helpers = {}, now = new Date()) {
  if (!firestoreAdminConfigured(env)) {
    return { ok: false, reason: "admin_not_configured", processed: 0 };
  }

  const due = await queryDueRoutines(env, now);
  if (!due.ok) {
    return { ok: false, reason: due.reason || "query_failed", processed: 0 };
  }

  const results = [];
  for (const routine of due.documents || []) {
    if (!routine?.id) continue;
    const claim = await claimLease(env, routine, now);
    if (!claim.ok) {
      results.push({ id: routine.id, skipped: claim.reason });
      continue;
    }

    const scheduledFor = claim.scheduledFor;
    const runId = `${routine.id}_${slotKey(scheduledFor)}`;
    const existing = await firestoreGetDocument(env, "routine_runs", runId);
    if (existing) {
      await finishRoutine(env, claim.fresh || routine, scheduledFor, {
        status: existing.status || "completed",
        finishedAt: existing.finishedAt || now.toISOString(),
      });
      results.push({ id: routine.id, skipped: "idempotent" });
      continue;
    }

    const startedAt = now.toISOString();
    const { text, steps } = buildScheduledOutput(claim.fresh || routine);
    let status = "completed";
    let error;
    const delivery = await maybeNotifyOwner(env, helpers.sendEmail, claim.fresh || routine, text);
    if (delivery.reason && delivery.reason !== "needs_approval") {
      // Email failure is soft — run still completed with draft output.
      error = delivery.reason;
    }

    const finishedAt = new Date().toISOString();
    const created = await firestoreCreateDocument(
      env,
      "routine_runs",
      {
        routineId: routine.id,
        workspaceId: routine.workspaceId,
        userId: routine.ownerUserId || routine.userId || "",
        triggerType: "schedule",
        scheduledFor,
        startedAt,
        finishedAt,
        status,
        steps: steps.map((step, index) => ({ t: index, ...step })),
        output: { text },
        actions: [],
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: Date.now() - now.getTime() },
        chainDepth: 0,
        emailSent: Boolean(delivery.sent),
        error: error || null,
        createdAt: finishedAt,
      },
      runId,
    );

    if (!created.ok) {
      status = "failed";
      error = created.reason;
      await firestorePatchDocument(env, "routines", routine.id, {
        leaseUntil: null,
        leaseScheduledFor: null,
        lastRunStatus: "failed",
        failStreak: Number(routine.failStreak || 0) + 1,
        updatedAt: finishedAt,
      });
      results.push({ id: routine.id, status, error });
      continue;
    }

    await finishRoutine(env, claim.fresh || routine, scheduledFor, { status, finishedAt });
    results.push({ id: routine.id, status, runId, emailed: Boolean(delivery.sent) });
  }

  return { ok: true, processed: results.filter((row) => row.status).length, results };
}
