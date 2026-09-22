/**
 * Persist AgentDefinition / AgentVersion / AgentTrigger / AgentRunRecord.
 * Firestore when available; in-memory mirror for tests and offline drafts.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type {
  AgentDefinition,
  AgentDomainEvent,
  AgentRunRecord,
  AgentStatus,
  AgentTemplate,
  AgentTrigger,
  AgentVersion,
  TriggerType,
} from "./types";

export const AGENT_DEFINITIONS = "agent_definitions";
export const AGENT_VERSIONS = "agent_versions";
export const AGENT_TRIGGERS = "agent_triggers";
export const AGENT_RUNS = "agent_runs";
export const AGENT_TEMPLATES = "agent_templates";
export const AGENT_ACTIONS = "agent_actions";

type MemoryBucket = {
  definitions: Map<string, AgentDefinition>;
  versions: Map<string, AgentVersion>;
  triggers: Map<string, AgentTrigger & { id: string }>;
  runs: Map<string, AgentRunRecord & { id: string }>;
  templates: Map<string, AgentTemplate>;
};

const memory: MemoryBucket = {
  definitions: new Map(),
  versions: new Map(),
  triggers: new Map(),
  runs: new Map(),
  templates: new Map(),
};

function memoryOnly() {
  if (typeof process !== "undefined" && process.env?.CERTO_AGENT_STORE_MEMORY === "1") {
    return true;
  }
  // Node test runner / SSR — avoid Firestore permission noise.
  if (typeof window === "undefined") return true;
  return false;
}

export type BuilderDraftInput = {
  workspaceId: string;
  ownerUserId: string;
  agentId?: string;
  name: string;
  owns: string;
  outcome: string;
  instructions: string;
  skills: string[];
  modelTier: "fast" | "balanced" | "deep";
  status?: AgentStatus;
  canDo: string[];
  mustAsk: string[];
  triggers: {
    assignment: boolean;
    mention: boolean;
    workItemChanges: boolean;
    schedule: boolean;
    events: AgentDomainEvent[];
    cron: string;
    timezone: string;
  };
  dataAccess?: AgentVersion["dataAccess"];
  icon?: AgentVersion["icon"];
};

function slugify(name: string, fallback: string) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

function buildActionPolicy(
  canDo: string[],
  mustAsk: string[],
): Record<string, "allow" | "ask" | "deny"> {
  const keys = [
    "read",
    "post_update",
    "add_label",
    "change_state",
    "reassign",
    "create_item",
    "send_email",
    "external_side_effect",
  ];
  const out: Record<string, "allow" | "ask" | "deny"> = {};
  for (const key of keys) {
    if (canDo.includes(key)) out[key] = "allow";
    else if (mustAsk.includes(key)) out[key] = "ask";
    else out[key] = "deny";
  }
  return out;
}

function checksum(parts: unknown) {
  return `ck_${JSON.stringify(parts).length}_${String(Date.now()).slice(-6)}`;
}

export function resetAgentStoreMemory() {
  memory.definitions.clear();
  memory.versions.clear();
  memory.triggers.clear();
  memory.runs.clear();
  memory.templates.clear();
}

export async function saveAgentFromBuilder(
  input: BuilderDraftInput,
): Promise<{ definition: AgentDefinition; version: AgentVersion; triggers: AgentTrigger[] }> {
  const now = new Date().toISOString();
  const isNew = !input.agentId || input.agentId === "new";
  const agentId = isNew ? `ag_${Math.random().toString(36).slice(2, 10)}` : input.agentId!;
  const existing = memory.definitions.get(agentId);
  const nextVersionNumber = existing?.currentVersionId
    ? (memory.versions.get(existing.currentVersionId)?.version || 0) + 1
    : 1;
  const versionId = `${agentId}:v${nextVersionNumber}`;
  const status = input.status || "draft";

  const definition: AgentDefinition = {
    id: agentId,
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    name: input.name.trim() || "Untitled agent",
    slug: slugify(input.name, agentId),
    description: input.owns || input.outcome || "",
    scope: "workspace",
    status,
    source: { type: "certo", sourceVersion: "builder" },
    currentVersionId: versionId,
    runtime: "legacy_odysseus",
    runtimeBindingId: null,
    visibility: "workspace",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const version: AgentVersion = {
    id: versionId,
    workspaceId: input.workspaceId,
    agentId,
    version: nextVersionNumber,
    instructions: input.instructions,
    owns: input.owns,
    outcome: input.outcome,
    icon: input.icon || { emoji: "✦", color: "#2547C4" },
    model: {
      provider: "certo",
      name: "odysseus",
      tier: input.modelTier,
    },
    skills: input.skills.map((name, index) => ({
      skillId: `skill_${index}_${slugify(name, "s")}`,
      name,
    })),
    dataAccess: input.dataAccess || [{ resource: "workspace", mode: "read" }],
    connections: [
      {
        connectionId: "workspace-default",
        allowedTools: ["read_items", "post_update"],
        account: { mode: "service" },
      },
    ],
    actionPolicy: buildActionPolicy(input.canDo, input.mustAsk),
    memoryPolicy: { recall: true, rememberRequiresApproval: true },
    runtimePolicy: { terminal: false, browser: false, web: true },
    checksum: checksum([input.instructions, input.skills, input.modelTier]),
    createdBy: input.ownerUserId,
    createdAt: now,
  };

  const triggers: AgentTrigger[] = [];
  const pushTrigger = (partial: Omit<AgentTrigger, "workspaceId" | "agentId" | "agentVersionId">) => {
    const id = `tr_${agentId}_${triggers.length + 1}`;
    const row: AgentTrigger & { id: string } = {
      id,
      workspaceId: input.workspaceId,
      agentId,
      agentVersionId: versionId,
      ...partial,
    };
    triggers.push(row);
    memory.triggers.set(id, row);
  };

  if (input.triggers.assignment) {
    pushTrigger({
      type: "manual",
      enabled: true,
      eventType: "assigned_to_agent",
      events: ["assigned_to_agent"],
      cooldownSeconds: 60,
    });
  }
  if (input.triggers.mention) {
    pushTrigger({
      type: "domain_event",
      enabled: true,
      eventType: "mentioned",
      events: ["mentioned"],
      cooldownSeconds: 30,
    });
  }
  if (input.triggers.workItemChanges) {
    pushTrigger({
      type: "domain_event",
      enabled: true,
      eventType: "work_item_change",
      events: input.triggers.events.length
        ? input.triggers.events
        : ["created", "updated", "state_changed"],
      filters: {},
      cooldownSeconds: 120,
    });
  }
  if (input.triggers.schedule) {
    pushTrigger({
      type: "schedule",
      enabled: true,
      schedule: input.triggers.cron,
      timezone: input.triggers.timezone,
      cooldownSeconds: 300,
    });
  }

  memory.definitions.set(agentId, definition);
  memory.versions.set(versionId, version);

  if (!memoryOnly()) {
    try {
      await setDoc(doc(db, AGENT_DEFINITIONS, agentId), { ...definition }, { merge: true });
      await setDoc(doc(db, AGENT_VERSIONS, versionId), { ...version }, { merge: true });
      for (const trigger of triggers) {
        const tid = (trigger as { id?: string }).id || `tr_${Math.random().toString(36).slice(2, 8)}`;
        await setDoc(doc(db, AGENT_TRIGGERS, tid), { ...trigger, id: tid }, { merge: true });
      }
    } catch {
      // Firestore may be unavailable offline — memory remains source of truth.
    }
  }

  return { definition, version, triggers };
}

export async function publishAgent(
  agentId: string,
  ownerUserId: string,
): Promise<AgentDefinition | null> {
  const def = memory.definitions.get(agentId);
  if (!def) return null;
  const draft: BuilderDraftInput = {
    workspaceId: def.workspaceId,
    ownerUserId,
    agentId,
    name: def.name,
    owns: memory.versions.get(def.currentVersionId || "")?.owns || "",
    outcome: memory.versions.get(def.currentVersionId || "")?.outcome || "",
    instructions: memory.versions.get(def.currentVersionId || "")?.instructions || "",
    skills: (memory.versions.get(def.currentVersionId || "")?.skills || []).map((s) => s.name),
    modelTier: memory.versions.get(def.currentVersionId || "")?.model?.tier || "balanced",
    status: "published",
    canDo: Object.entries(memory.versions.get(def.currentVersionId || "")?.actionPolicy || {})
      .filter(([, v]) => v === "allow")
      .map(([k]) => k),
    mustAsk: Object.entries(memory.versions.get(def.currentVersionId || "")?.actionPolicy || {})
      .filter(([, v]) => v === "ask")
      .map(([k]) => k),
    triggers: {
      assignment: true,
      mention: true,
      workItemChanges: false,
      schedule: false,
      events: ["state_changed"],
      cron: "0 8 * * 1-5",
      timezone: "America/Tegucigalpa",
    },
  };
  const saved = await saveAgentFromBuilder(draft);
  return saved.definition;
}

export async function listAgentDefinitions(workspaceId: string): Promise<AgentDefinition[]> {
  const fromMemory = [...memory.definitions.values()].filter(
    (row) => row.workspaceId === workspaceId,
  );
  if (memoryOnly()) return fromMemory;
  try {
    const snap = await getDocs(
      query(collection(db, AGENT_DEFINITIONS), where("workspaceId", "==", workspaceId), limit(200)),
    );
    const remote = snap.docs.map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<AgentDefinition, "id">),
    }));
    for (const row of remote) memory.definitions.set(row.id, row);
    return remote.length ? remote : fromMemory;
  } catch {
    return fromMemory;
  }
}

export async function getAgentDefinition(agentId: string): Promise<AgentDefinition | null> {
  if (memory.definitions.has(agentId)) return memory.definitions.get(agentId)!;
  try {
    const snap = await getDoc(doc(db, AGENT_DEFINITIONS, agentId));
    if (!snap.exists()) return null;
    const row = { id: snap.id, ...(snap.data() as Omit<AgentDefinition, "id">) };
    memory.definitions.set(agentId, row);
    return row;
  } catch {
    return null;
  }
}

export async function getAgentVersion(versionId: string): Promise<AgentVersion | null> {
  if (memory.versions.has(versionId)) return memory.versions.get(versionId)!;
  try {
    const snap = await getDoc(doc(db, AGENT_VERSIONS, versionId));
    if (!snap.exists()) return null;
    const row = { id: snap.id, ...(snap.data() as Omit<AgentVersion, "id">) };
    memory.versions.set(versionId, row);
    return row;
  } catch {
    return null;
  }
}

export function listPublishedAgentsForAssignee(workspaceId: string): Array<{
  id: string;
  name: string;
  owns?: string;
}> {
  return [...memory.definitions.values()]
    .filter((row) => row.workspaceId === workspaceId && row.status === "published")
    .map((row) => ({
      id: `agent:${row.id}`,
      name: row.name,
      owns: memory.versions.get(row.currentVersionId || "")?.owns,
    }));
}

export async function createAgentRun(input: {
  workspaceId: string;
  agentId: string;
  agentVersionId: string;
  triggerType: TriggerType;
  eventType?: string;
  inputSummary: string;
  context?: AgentRunRecord["context"];
  traceId?: string;
  causationId?: string;
  depth?: number;
  currentStepLabel?: string;
}): Promise<AgentRunRecord & { id: string }> {
  const id = `run_${Math.random().toString(36).slice(2, 10)}`;
  const row: AgentRunRecord & { id: string } = {
    id,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    agentVersionId: input.agentVersionId,
    triggerType: input.triggerType,
    status: "running",
    inputSummary: input.inputSummary,
    currentStepLabel: input.currentStepLabel || "Starting…",
    eventType: input.eventType,
    context: input.context,
    traceId: input.traceId || `tr_${id}`,
    correlationId: `corr_${id}`,
    causationId: input.causationId,
    depth: input.depth ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memory.runs.set(id, row);
  if (!memoryOnly()) {
    try {
      await setDoc(doc(db, AGENT_RUNS, id), { ...row }, { merge: true });
    } catch {
      /* memory only */
    }
  }
  return row;
}

export function updateRunStep(runId: string, label: string, findingLabel?: string) {
  const row = memory.runs.get(runId);
  if (!row) return;
  row.currentStepLabel = label;
  if (findingLabel) row.findingLabel = findingLabel;
  row.updatedAt = new Date().toISOString();
  memory.runs.set(runId, row);
  void updateDoc(doc(db, AGENT_RUNS, runId), {
    currentStepLabel: label,
    ...(findingLabel ? { findingLabel } : {}),
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);
}

export function completeRun(runId: string, resultSummary: string) {
  const row = memory.runs.get(runId);
  if (!row) return;
  row.status = "completed";
  row.resultSummary = resultSummary;
  row.currentStepLabel = undefined;
  row.updatedAt = new Date().toISOString();
  memory.runs.set(runId, row);
}

export function listRunsForWorkspace(workspaceId: string): Array<AgentRunRecord & { id: string }> {
  return [...memory.runs.values()]
    .filter((row) => row.workspaceId === workspaceId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export function listActiveRunsForItem(itemId: string): Array<AgentRunRecord & { id: string }> {
  return [...memory.runs.values()].filter(
    (row) =>
      row.context?.itemId === itemId &&
      (row.status === "running" ||
        row.status === "queued" ||
        row.status === "starting" ||
        row.status === "waiting_for_business_approval"),
  );
}

export function seedTemplate(template: AgentTemplate) {
  memory.templates.set(template.id, template);
}

export function listTemplates(): AgentTemplate[] {
  return [...memory.templates.values()];
}

export async function provisionFromTemplate(input: {
  template: AgentTemplate;
  workspaceId: string;
  ownerUserId: string;
}): Promise<{ definition: AgentDefinition; version: AgentVersion }> {
  const seed = input.template.versionSeed || {};
  const saved = await saveAgentFromBuilder({
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    name: input.template.name,
    owns: input.template.owns,
    outcome: input.template.outcome,
    instructions: String(seed.instructions || input.template.description),
    skills: input.template.skillNames,
    modelTier: seed.model?.tier || "balanced",
    status: "draft",
    canDo: ["read", "post_update"],
    mustAsk: ["change_state", "reassign", "create_item", "send_email", "external_side_effect"],
    triggers: {
      assignment: input.template.triggerSeeds.some((t) => t.type === "manual"),
      mention: input.template.triggerSeeds.some((t) => t.events?.includes("mentioned")),
      workItemChanges: input.template.triggerSeeds.some((t) => t.type === "domain_event"),
      schedule: input.template.triggerSeeds.some((t) => t.type === "schedule"),
      events: (input.template.triggerSeeds.find((t) => t.events)?.events || [
        "state_changed",
      ]) as AgentDomainEvent[],
      cron: String(input.template.triggerSeeds.find((t) => t.schedule)?.schedule || "0 8 * * 1-5"),
      timezone: String(
        input.template.triggerSeeds.find((t) => t.timezone)?.timezone || "America/Tegucigalpa",
      ),
    },
    dataAccess: seed.dataAccess,
    icon: seed.icon,
  });
  return { definition: saved.definition, version: saved.version };
}

/** Dry-run plan for Test run — never executes writes. */
export function buildTestRunPlan(input: {
  agentName: string;
  itemId: string;
  mustAsk: string[];
  instructions: string;
}): string[] {
  return [
    `Read work item ${input.itemId || "(pick an item)"}`,
    `Apply playbook for ${input.agentName || "agent"}`,
    input.instructions ? "Follow instructions draft" : "Use default playbook",
    `Propose actions: ${input.mustAsk.slice(0, 4).join(", ") || "none"}`,
    "Stop — dry run does not execute",
  ];
}

export async function persistTemplateRemote(template: AgentTemplate) {
  memory.templates.set(template.id, template);
  if (memoryOnly()) return;
  try {
    await setDoc(doc(db, AGENT_TEMPLATES, template.id), { ...template }, { merge: true });
  } catch {
    /* ok */
  }
}

export async function enqueueRunFromEvent(input: {
  workspaceId: string;
  agentId: string;
  agentVersionId: string;
  eventType: string;
  itemId?: string;
  projectId?: string;
  summary: string;
  causationId?: string;
  depth?: number;
  causedByAgentId?: string;
}): Promise<(AgentRunRecord & { id: string }) | null> {
  // Loop guard: agent-caused events do not retrigger the same agent; depth ≤ 3.
  if (input.causedByAgentId && input.causedByAgentId === input.agentId) return null;
  if ((input.depth ?? 0) > 3) return null;
  return createAgentRun({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    agentVersionId: input.agentVersionId,
    triggerType: "domain_event",
    eventType: input.eventType,
    inputSummary: input.summary,
    context: { itemId: input.itemId, projectId: input.projectId },
    causationId: input.causationId,
    depth: (input.depth ?? 0) + 1,
    currentStepLabel: "Pulling into cycle…",
  });
}

export async function listPendingAgentActions(workspaceId: string) {
  const fromMemory: unknown[] = [];
  try {
    const snap = await getDocs(
      query(
        collection(db, AGENT_ACTIONS),
        where("workspaceId", "==", workspaceId),
        where("status", "==", "approval_required"),
        limit(100),
      ),
    );
    return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  } catch {
    return fromMemory;
  }
}

export async function addDocSafe(collectionName: string, data: Record<string, unknown>) {
  try {
    return await addDoc(collection(db, collectionName), data);
  } catch {
    return null;
  }
}
