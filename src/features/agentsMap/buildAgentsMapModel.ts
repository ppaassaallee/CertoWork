import type { RoutineSpec, RoutineChannel } from "../../lib/routines";
import type { AgentActivityItem } from "../../lib/agentActivity";
import {
  averageDurationMs,
  computeMapHealth,
  consecutiveFailures,
  hasLoop,
  healthLabel,
  successRate,
  totalCostUsd,
  type MapHealth,
  type RunLike,
} from "./mapHealth";

export type MapNodeKind = "trigger" | "routine" | "agent" | "output";

export type MapNode = {
  id: string;
  kind: MapNodeKind;
  label: string;
  sublabel: string;
  health: MapHealth;
  meta: Record<string, unknown>;
};

export type MapEdge = {
  id: string;
  from: string;
  to: string;
  weight: number;
  tone: "ok" | "warn" | "danger";
  label?: string;
};

export type LiveHandoff = {
  id: string;
  path: string;
  contextKb: string | null;
  durationLabel: string | null;
  status: "Completado" | "Rechazado" | "Esperando aprobación" | "Falló";
};

export type AgentsMapModel = {
  workspaceLabel: string;
  nodes: MapNode[];
  edges: MapEdge[];
  handoffs: LiveHandoff[];
  byId: Record<string, MapNode>;
};

const CHANNEL_LABEL: Record<RoutineChannel, string> = {
  email: "Correo",
  comment: "Comentario",
  note: "Nota",
  whatsapp: "WhatsApp",
  slack: "Slack",
  webhook: "Webhook",
  update_items: "Editar ítems",
};

function triggerKey(routine: RoutineSpec) {
  const trigger = routine.trigger;
  if (trigger.kind === "schedule") return `cron:${trigger.human || trigger.cron}`;
  if (trigger.kind === "event") return `event:${trigger.eventType}`;
  if (trigger.kind === "webhook") return `webhook:${trigger.human || "webhook"}`;
  return "manual";
}

function triggerLabel(routine: RoutineSpec) {
  const trigger = routine.trigger as { human?: string; kind?: string };
  return String(trigger.human || trigger.kind || "Manual");
}

function triggerKindLabel(routine: RoutineSpec) {
  const kind = routine.trigger.kind;
  if (kind === "schedule") return "cron";
  if (kind === "event") return "evento";
  if (kind === "webhook") return "webhook";
  return "manual";
}

function runsInWindow(runs: RunLike[], sinceIso: string) {
  return runs.filter((run) => String(run.startedAt || "") >= sinceIso);
}

export function buildAgentsMapModel(input: {
  routines: RoutineSpec[];
  runsByRoutineId: Record<string, RunLike[]>;
  activityItems?: AgentActivityItem[];
  pendingApprovals?: number;
  workspaceName?: string;
  windowHours?: number;
  now?: Date;
}): AgentsMapModel {
  const now = input.now || new Date();
  const hours = input.windowHours ?? 24;
  const since = new Date(now.getTime() - hours * 3600_000).toISOString();
  const routines = (input.routines || []).filter((routine) =>
    ["active", "failing", "paused"].includes(routine.status),
  );

  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const byId: Record<string, MapNode> = {};

  const push = (node: MapNode) => {
    if (byId[node.id]) return;
    byId[node.id] = node;
    nodes.push(node);
  };

  // Triggers
  const triggerCounts = new Map<string, { label: string; kind: string; count: number; routines: string[] }>();
  for (const routine of routines) {
    const key = triggerKey(routine);
    const current = triggerCounts.get(key) || {
      label: triggerLabel(routine),
      kind: triggerKindLabel(routine),
      count: 0,
      routines: [],
    };
    const windowRuns = runsInWindow(input.runsByRoutineId[routine.id] || [], since);
    current.count += windowRuns.length || (routine.stats?.runs30d ? 1 : 0);
    current.routines.push(routine.id);
    triggerCounts.set(key, current);
  }
  for (const [key, value] of triggerCounts) {
    push({
      id: `trigger:${key}`,
      kind: "trigger",
      label: value.label,
      sublabel: `${value.kind} · ${value.count}`,
      health: "sana",
      meta: { count: value.count, routineIds: value.routines },
    });
  }

  // Routines
  for (const routine of routines) {
    const allRuns = input.runsByRoutineId[routine.id] || [];
    const windowRuns = runsInWindow(allRuns, since);
    const sourceRuns = windowRuns.length ? windowRuns : allRuns.slice(0, 20);
    const failStreak =
      Number((routine as { failStreak?: number }).failStreak || 0) ||
      consecutiveFailures(sourceRuns);
    const health = computeMapHealth({ runs: sourceRuns, failStreak });
    const rate = successRate(sourceRuns);
    const scope = routine.scope?.entityTitle || routine.scope?.entityType || "";
    const runCount = windowRuns.length || Number(routine.stats?.runs30d || 0);
    push({
      id: `routine:${routine.id}`,
      kind: "routine",
      label: routine.title || "Rutina",
      sublabel: [
        runCount ? String(runCount) : null,
        rate != null ? `${rate}%` : null,
        scope || null,
        failStreak >= 2 ? `${failStreak} fallos` : null,
        Number(routine.stats?.pending || 0) > 0
          ? `${routine.stats.pending} esperando aprobación`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      health,
      meta: {
        routineId: routine.id,
        routine,
        runCount,
        successPct: rate,
        durationMs: averageDurationMs(sourceRuns),
        costUsd: totalCostUsd(sourceRuns),
        pending: Number(routine.stats?.pending || 0),
        actions: Number(routine.stats?.actions30d || 0),
        permissions: routine.permissions,
        channel: routine.deliverable?.channel,
        loop: hasLoop(sourceRuns),
        healthLabel: healthLabel(health),
      },
    });

    const tKey = triggerKey(routine);
    edges.push({
      id: `e:${tKey}->${routine.id}`,
      from: `trigger:${tKey}`,
      to: `routine:${routine.id}`,
      weight: Math.max(1, windowRuns.length || 1),
      tone: health === "fallando" ? "danger" : health === "degradada" ? "warn" : "ok",
    });
  }

  // Agents — Odysseus always when any routine or activity; Hermes optional from activity
  const odysseusRuns = (input.activityItems || []).filter(
    (item) => String(item.agentId || "odysseus").toLowerCase().includes("odysseus"),
  );
  const odysseusHealth = computeMapHealth({
    runs: odysseusRuns.map((item) => ({
      status:
        String(item.result || "").toLowerCase() === "failed" ||
        String(item.result || "").toLowerCase() === "rejected"
          ? "failed"
          : "completed",
      startedAt: item.createdAt ? String(item.createdAt) : null,
    })),
  });
  push({
    id: "agent:odysseus",
    kind: "agent",
    label: "Odysseus",
    sublabel: [
      `${odysseusRuns.length || routines.length} corridas`,
      successRate(
        odysseusRuns.map((item) => ({
          status:
            String(item.result || "").toLowerCase().includes("fail") ||
            String(item.result || "").toLowerCase().includes("reject")
              ? "failed"
              : "completed",
        })),
      ) != null
        ? `${successRate(
            odysseusRuns.map((item) => ({
              status:
                String(item.result || "").toLowerCase().includes("fail") ||
                String(item.result || "").toLowerCase().includes("reject")
                  ? "failed"
                  : "completed",
            })),
          )}%`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    health: odysseusHealth,
    meta: { agentId: "odysseus", pendingApprovals: input.pendingApprovals || 0 },
  });

  const hermesHits = (input.activityItems || []).filter((item) =>
    String(item.agentId || item.agentName || "")
      .toLowerCase()
      .includes("hermes"),
  );
  if (hermesHits.length) {
    push({
      id: "agent:hermes",
      kind: "agent",
      label: "Analista · Hermes",
      sublabel: `${hermesHits.length} · 100%`,
      health: "sana",
      meta: { agentId: "hermes", loop: false },
    });
  }

  for (const routine of routines) {
    edges.push({
      id: `e:${routine.id}->odysseus`,
      from: `routine:${routine.id}`,
      to: "agent:odysseus",
      weight: Math.max(1, (input.runsByRoutineId[routine.id] || []).length || 1),
      tone:
        byId[`routine:${routine.id}`]?.health === "fallando"
          ? "danger"
          : byId[`routine:${routine.id}`]?.health === "degradada"
            ? "warn"
            : "ok",
    });
  }

  // Outputs
  const outputCounts = new Map<
    string,
    { label: string; count: number; pending: number; permissionMissing: boolean; tone: MapHealth }
  >();
  for (const routine of routines) {
    const channel = (routine.deliverable?.channel || "email") as RoutineChannel;
    const id = `output:${channel}`;
    const current = outputCounts.get(id) || {
      label: CHANNEL_LABEL[channel] || channel,
      count: 0,
      pending: 0,
      permissionMissing: false,
      tone: "sana" as MapHealth,
    };
    const runs = runsInWindow(input.runsByRoutineId[routine.id] || [], since);
    current.count += runs.filter((run) => String(run.status) === "completed").length;
    current.pending += Number(routine.stats?.pending || 0);
    if (
      (channel === "whatsapp" || channel === "email" || channel === "slack") &&
      routine.permissions?.writeOthers !== "always" &&
      routine.permissions?.writeOthers !== "never" &&
      String(routine.deliverable?.to?.[0] || "").includes("@")
    ) {
      // ask mode with external recipients → permission risk
      if (routine.permissions?.writeOthers === "ask") {
        current.permissionMissing = true;
        current.tone = "fallando";
      }
    }
    if (channel === "whatsapp" && routine.permissions?.writeOthers !== "always") {
      current.permissionMissing = true;
      current.tone = "fallando";
    }
    if (channel === "update_items" && current.pending > 0) {
      current.tone = "degradada";
    }
    outputCounts.set(id, current);

    const edgeTone =
      current.permissionMissing
        ? "danger"
        : current.pending > 0
          ? "warn"
          : "ok";
    edges.push({
      id: `e:odysseus->${channel}:${routine.id}`,
      from: "agent:odysseus",
      to: id,
      weight: Math.max(1, runs.length || 1),
      tone: edgeTone,
      label: current.permissionMissing ? "⚠ escribir a otros" : undefined,
    });
  }

  for (const [id, value] of outputCounts) {
    push({
      id,
      kind: "output",
      label: value.label,
      sublabel: value.permissionMissing
        ? "permiso faltante"
        : value.pending > 0
          ? `${value.pending} en Approvals`
          : `${value.count} enviados`,
      health: value.tone,
      meta: {
        permissionMissing: value.permissionMissing,
        pending: value.pending,
        count: value.count,
      },
    });
  }

  // Live handoffs from recent runs
  const handoffs: LiveHandoff[] = [];
  for (const routine of routines) {
    for (const run of (input.runsByRoutineId[routine.id] || []).slice(0, 5)) {
      const channel = CHANNEL_LABEL[(routine.deliverable?.channel || "email") as RoutineChannel];
      const statusRaw = String(run.status || "").toLowerCase();
      let status: LiveHandoff["status"] = "Completado";
      if (statusRaw === "failed" || statusRaw === "rejected") status = "Rechazado";
      else if (statusRaw === "pending" || Number(routine.stats?.pending || 0) > 0)
        status = "Esperando aprobación";
      else if (statusRaw && statusRaw !== "completed") status = "Falló";
      const durationMs = Number(run.usage?.durationMs || 0);
      handoffs.push({
        id: String((run as { id?: string }).id || `${routine.id}-${run.startedAt}`),
        path: `${routine.title} → Odysseus → ${channel}`,
        contextKb: null,
        durationLabel: durationMs > 0 ? `${Math.round(durationMs / 1000)} s` : null,
        status,
      });
    }
  }
  handoffs.sort((a, b) => b.id.localeCompare(a.id));

  return {
    workspaceLabel: input.workspaceName || "Workspace",
    nodes,
    edges,
    handoffs: handoffs.slice(0, 12),
    byId,
  };
}

export function filterMapModel(
  model: AgentsMapModel,
  filter:
    | "all"
    | "failing"
    | "slow"
    | "costly"
    | "loops"
    | "awaiting",
): AgentsMapModel {
  if (filter === "all") return model;
  const keep = new Set<string>();
  for (const node of model.nodes) {
    if (node.kind === "trigger" || node.kind === "output" || node.kind === "agent") {
      // keep if connected to a matching routine later
      continue;
    }
    if (filter === "failing" && node.health === "fallando") keep.add(node.id);
    if (filter === "slow" && Number(node.meta.durationMs || 0) >= 40_000) keep.add(node.id);
    if (filter === "costly" && Number(node.meta.costUsd || 0) >= 1) keep.add(node.id);
    if (filter === "loops" && node.meta.loop) keep.add(node.id);
    if (filter === "awaiting" && Number(node.meta.pending || 0) > 0) keep.add(node.id);
  }
  // Expand to linked triggers/agents/outputs
  for (let pass = 0; pass < 2; pass += 1) {
    for (const edge of model.edges) {
      if (keep.has(edge.from) || keep.has(edge.to)) {
        keep.add(edge.from);
        keep.add(edge.to);
      }
    }
  }
  const nodes = model.nodes.filter((node) => keep.has(node.id));
  return {
    ...model,
    nodes,
    edges: model.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to)),
    handoffs: model.handoffs,
    byId: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
}
