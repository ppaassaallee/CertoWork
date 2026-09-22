/**
 * Assign / mention → agent_runs (Track B5).
 */
import {
  createAgentRun,
  getAgentDefinition,
  listPublishedAgentsForAssignee,
} from "../agent-platform/agentStore";
import type { AgentRunRecord } from "../agent-platform/types";

export function isAgentAssigneeId(id: string) {
  return String(id || "").startsWith("agent:");
}

export function agentIdFromAssignee(id: string) {
  return String(id || "").replace(/^agent:/, "");
}

export function publishedAgentsAsMembers(workspaceId: string) {
  return listPublishedAgentsForAssignee(workspaceId).map((agent) => ({
    id: agent.id,
    userId: agent.id,
    displayName: agent.name,
    alias: agent.name,
    email: "",
    status: "active" as const,
    isAgent: true as const,
    owns: agent.owns,
  }));
}

export async function startRunOnAgentAssign(input: {
  workspaceId: string;
  assigneeId: string;
  itemId: string;
  projectId?: string;
  itemTitle?: string;
}): Promise<(AgentRunRecord & { id: string }) | null> {
  if (!isAgentAssigneeId(input.assigneeId)) return null;
  const agentId = agentIdFromAssignee(input.assigneeId);
  const def = await getAgentDefinition(agentId);
  if (!def || def.status !== "published" || !def.currentVersionId) return null;
  return createAgentRun({
    workspaceId: input.workspaceId,
    agentId,
    agentVersionId: def.currentVersionId,
    triggerType: "manual",
    eventType: "assigned_to_agent",
    inputSummary: `Assigned to ${input.itemTitle || input.itemId}`,
    context: { itemId: input.itemId, projectId: input.projectId },
    currentStepLabel: "Drafting release notes…",
  });
}

const AGENT_MENTION = /@\[agent:([^\]]+)\]|@Agent:([A-Za-z0-9_-]+)|@([A-Z][A-Za-z0-9_-]{2,})/g;

export function parseAgentMentions(
  text: string,
  knownAgentNames: Array<{ id: string; name: string }>,
): string[] {
  const ids = new Set<string>();
  const lower = knownAgentNames.map((a) => ({
    id: a.id.replace(/^agent:/, ""),
    name: a.name.toLowerCase(),
  }));
  let match: RegExpExecArray | null;
  const re = new RegExp(AGENT_MENTION);
  while ((match = re.exec(text))) {
    const explicit = match[1] || match[2];
    if (explicit) {
      ids.add(explicit.replace(/^agent:/, ""));
      continue;
    }
    const name = String(match[3] || "").toLowerCase();
    const hit = lower.find((a) => a.name === name || a.name.replace(/\s+/g, "") === name);
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}

export async function startRunsOnAgentMention(input: {
  workspaceId: string;
  text: string;
  itemId?: string;
  projectId?: string;
  conversationId?: string;
  messageId?: string;
  knownAgents: Array<{ id: string; name: string }>;
}): Promise<Array<AgentRunRecord & { id: string }>> {
  const agentIds = parseAgentMentions(input.text, input.knownAgents);
  const runs: Array<AgentRunRecord & { id: string }> = [];
  for (const agentId of agentIds) {
    const def = await getAgentDefinition(agentId);
    if (!def || def.status !== "published" || !def.currentVersionId) continue;
    const run = await createAgentRun({
      workspaceId: input.workspaceId,
      agentId,
      agentVersionId: def.currentVersionId,
      triggerType: "domain_event",
      eventType: "mentioned",
      inputSummary: input.text.slice(0, 180),
      context: {
        itemId: input.itemId,
        projectId: input.projectId,
        conversationId: input.conversationId,
        messageId: input.messageId,
      },
      currentStepLabel: "Linking 4 work items…",
    });
    runs.push(run);
  }
  return runs;
}
