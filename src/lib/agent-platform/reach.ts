/**
 * Reach enforcement helpers (B7) — wrap Certo MCP grants from AgentVersion.dataAccess.
 */
import { assertTenant, executeCertoMcpTool } from "./certoMcp";
import type { AgentVersion } from "./types";

export function grantsFromVersion(version: AgentVersion) {
  return (version.dataAccess || []).map((row) => ({
    resource: row.resource,
    mode: row.mode === "propose" ? ("propose" as const) : ("read" as const),
  }));
}

export function assertAgentReach(input: {
  workspaceId: string;
  agentWorkspaceId: string;
  resourceWorkspaceId: string;
  grants: Array<{ resource: string; mode: "read" | "propose" }>;
  resource: string;
}) {
  assertTenant(
    {
      workspaceId: input.workspaceId,
      agentId: "reach-check",
      agentVersionId: "reach-check",
      grants: input.grants,
    },
    input.resourceWorkspaceId,
  );
  if (input.agentWorkspaceId !== input.workspaceId) {
    throw new Error("CROSS_TENANT_DENIED");
  }
  const ok = input.grants.some(
    (g) =>
      g.resource === "*" ||
      g.resource === "workspace" ||
      g.resource === input.resource ||
      input.resource.startsWith(`${g.resource}:`) ||
      g.resource.startsWith(`${input.resource}`),
  );
  if (!ok) {
    const err = new Error("REACH_DENIED");
    (err as Error & { code?: string }).code = "REACH_DENIED";
    throw err;
  }
}

export function readWithReach(input: {
  tool: string;
  args: Record<string, unknown>;
  version: AgentVersion;
  workspaceId: string;
  catalog: Record<string, unknown>;
}) {
  const identity = {
    workspaceId: input.workspaceId,
    agentId: input.version.agentId,
    agentVersionId: input.version.id,
    grants: grantsFromVersion(input.version),
  };
  return executeCertoMcpTool(input.tool, input.args, identity, input.catalog as any);
}

export function accountModeLabel(version: AgentVersion): string {
  const account = version.connections?.[0]?.account;
  if (!account || account.mode === "service") return "Service account";
  return account.userId ? `Member connection (${account.userId})` : "Member connection";
}
