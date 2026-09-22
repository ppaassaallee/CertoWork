/**
 * Item domain events + AgentTrigger matching (Track B6).
 */
import type { AgentDomainEvent, AgentTrigger, AgentTriggerFilters } from "./types";
import { enqueueRunFromEvent, listAgentDefinitions, getAgentVersion } from "./agentStore";

export type ItemEvent = {
  workspaceId: string;
  itemId: string;
  projectId?: string;
  type: AgentDomainEvent;
  from?: unknown;
  to?: unknown;
  by?: string;
  at: string;
  causedByAgentId?: string;
  traceId?: string;
  depth?: number;
};

const ITEM_EVENTS_COLLECTION = "itemEvents";
const recentFires = new Map<string, number>();

export function matchesFilters(
  filters: AgentTriggerFilters | undefined,
  ctx: { projectId?: string; state?: string; labels?: string[]; assigneeIds?: string[]; type?: string },
): boolean {
  if (!filters) return true;
  if (filters.projectIds?.length && ctx.projectId && !filters.projectIds.includes(ctx.projectId)) {
    return false;
  }
  if (filters.states?.length && ctx.state && !filters.states.includes(ctx.state)) return false;
  if (filters.labels?.length) {
    const labels = ctx.labels || [];
    if (!filters.labels.some((l) => labels.includes(l))) return false;
  }
  if (filters.assigneeIds?.length) {
    const ids = ctx.assigneeIds || [];
    if (!filters.assigneeIds.some((id) => ids.includes(id))) return false;
  }
  if (filters.types?.length && ctx.type && !filters.types.includes(ctx.type)) return false;
  return true;
}

export function triggerMatchesEvent(
  trigger: AgentTrigger,
  event: ItemEvent,
  ctx: { state?: string; labels?: string[]; assigneeIds?: string[]; type?: string } = {},
): boolean {
  if (!trigger.enabled) return false;
  if (trigger.type !== "domain_event" && trigger.type !== "manual") return false;
  const events = trigger.events || (trigger.eventType ? [trigger.eventType as AgentDomainEvent] : []);
  if (events.length && !events.includes(event.type)) return false;
  return matchesFilters(trigger.filters, {
    projectId: event.projectId,
    state: ctx.state,
    labels: ctx.labels,
    assigneeIds: ctx.assigneeIds,
    type: ctx.type,
  });
}

function cooldownOk(trigger: AgentTrigger & { id?: string }, agentId: string, itemId: string) {
  const key = `${trigger.id || agentId}:${itemId}:${trigger.eventType || "evt"}`;
  const last = recentFires.get(key) || 0;
  const cool = (trigger.cooldownSeconds ?? 60) * 1000;
  if (Date.now() - last < cool) return false;
  recentFires.set(key, Date.now());
  return true;
}

/** In-memory registry of triggers for matching (tests + client). */
const triggerRegistry: Array<AgentTrigger & { id: string }> = [];

export function registerTrigger(trigger: AgentTrigger & { id: string }) {
  const idx = triggerRegistry.findIndex((t) => t.id === trigger.id);
  if (idx >= 0) triggerRegistry[idx] = trigger;
  else triggerRegistry.push(trigger);
}

export function listRegisteredTriggers() {
  return [...triggerRegistry];
}

export function clearTriggerRegistry() {
  triggerRegistry.length = 0;
  recentFires.clear();
}

export async function emitItemEvent(
  event: ItemEvent,
  ctx: { state?: string; labels?: string[]; assigneeIds?: string[]; type?: string } = {},
): Promise<string[]> {
  const runIds: string[] = [];
  const definitions = await listAgentDefinitions(event.workspaceId);
  const published = definitions.filter((d) => d.status === "published");

  for (const def of published) {
    if (!def.currentVersionId) continue;
    const version = await getAgentVersion(def.currentVersionId);
    if (!version) continue;
    const triggers = triggerRegistry.filter(
      (t) => t.agentId === def.id && t.agentVersionId === def.currentVersionId,
    );
    for (const trigger of triggers) {
      if (!triggerMatchesEvent(trigger, event, ctx)) continue;
      if (!cooldownOk(trigger, def.id, event.itemId)) continue;
      const run = await enqueueRunFromEvent({
        workspaceId: event.workspaceId,
        agentId: def.id,
        agentVersionId: def.currentVersionId,
        eventType: event.type,
        itemId: event.itemId,
        projectId: event.projectId,
        summary: `${event.type} on ${event.itemId}`,
        causationId: event.traceId,
        depth: event.depth,
        causedByAgentId: event.causedByAgentId,
      });
      if (run) runIds.push(run.id);
    }
  }

  // Best-effort persist (B6). Failures are non-fatal.
  if (typeof window !== "undefined") {
    try {
      const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      await addDoc(collection(db, ITEM_EVENTS_COLLECTION), {
        ...event,
        at: event.at || new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
    } catch {
      /* ignore */
    }
  }

  return runIds;
}

export { ITEM_EVENTS_COLLECTION };
