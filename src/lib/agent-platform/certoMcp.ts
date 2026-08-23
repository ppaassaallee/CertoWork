/**
 * Certo MCP — read-only tools first.
 * Authorization comes from the service identity, never from model claims.
 */

export type CertoMcpIdentity = {
  workspaceId: string;
  agentId: string;
  agentVersionId: string;
  grants: Array<{ resource: string; mode: "read" | "propose" }>;
};

export type WorkspaceSnapshot = {
  workspaceId: string;
  projects?: any[];
  tasks?: any[];
  risks?: any[];
  knowledge?: any[];
  reviewItems?: any[];
};

function allow(identity: CertoMcpIdentity, resource: string, mode: "read" | "propose") {
  return identity.grants.some(
    (grant) =>
      (grant.resource === resource || grant.resource === "*") &&
      (mode === "read" ? true : grant.mode === "propose"),
  );
}

function evidence(type: string, id: string, version = "v0") {
  return { type, id, version };
}

export function assertTenant(
  identity: CertoMcpIdentity,
  requestedWorkspaceId: string,
) {
  if (identity.workspaceId !== requestedWorkspaceId) {
    const err = new Error("CROSS_TENANT_DENIED");
    (err as any).code = "CROSS_TENANT_DENIED";
    throw err;
  }
}

export const CERTO_MCP_READ_TOOLS = [
  "certo_search_projects",
  "certo_get_project",
  "certo_search_work_items",
  "certo_get_work_item",
  "certo_list_project_work",
  "certo_get_attention_summary",
  "certo_list_pending_approvals",
] as const;

export function executeCertoMcpTool(
  name: string,
  args: Record<string, unknown>,
  identity: CertoMcpIdentity,
  snapshot: WorkspaceSnapshot,
) {
  assertTenant(identity, snapshot.workspaceId);

  if (!allow(identity, "projects", "read") && name.includes("project")) {
    throw new Error("GRANT_DENIED: projects");
  }

  const projects = snapshot.projects || [];
  const tasks = snapshot.tasks || [];

  switch (name) {
    case "certo_search_projects": {
      const q = String(args.query || "").toLowerCase();
      const items = projects
        .filter((p) => !q || String(p.title || p.name || "").toLowerCase().includes(q))
        .slice(0, 20)
        .map((p) => ({
          id: p.id,
          title: p.title || p.name,
          health: p.health || "on_track",
          evidenceRef: evidence("project", p.id),
        }));
      return { items };
    }
    case "certo_get_project": {
      const project = projects.find((p) => p.id === args.projectId);
      if (!project) return { error: "NOT_FOUND" };
      return {
        project: {
          id: project.id,
          title: project.title || project.name,
          outcome: project.outcome,
          health: project.health,
          evidenceRef: evidence("project", project.id),
        },
      };
    }
    case "certo_search_work_items": {
      if (!allow(identity, "tasks", "read")) throw new Error("GRANT_DENIED: tasks");
      const q = String(args.query || "").toLowerCase();
      const items = tasks
        .filter((t) => !q || String(t.title || "").toLowerCase().includes(q))
        .slice(0, 40)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          projectId: t.projectId,
          dueDate: t.dueDate,
          evidenceRef: evidence("work_item", t.id),
        }));
      return { items };
    }
    case "certo_get_work_item": {
      if (!allow(identity, "tasks", "read")) throw new Error("GRANT_DENIED: tasks");
      const task = tasks.find((t) => t.id === args.workItemId || t.id === args.taskId);
      if (!task) return { error: "NOT_FOUND" };
      return {
        item: {
          id: task.id,
          title: task.title,
          status: task.status,
          evidenceRef: evidence("work_item", task.id),
        },
      };
    }
    case "certo_list_project_work": {
      if (!allow(identity, "tasks", "read")) throw new Error("GRANT_DENIED: tasks");
      const items = tasks
        .filter((t) => t.projectId === args.projectId)
        .slice(0, 100)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          evidenceRef: evidence("work_item", t.id),
        }));
      return { items };
    }
    case "certo_get_attention_summary": {
      const open = tasks.filter((t) => !["done", "completed", "cancelled"].includes(String(t.status || "").toLowerCase()));
      const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now());
      const atRisk = projects.filter((p) =>
        ["at_risk", "blocked", "critical"].includes(String(p.health || "").toLowerCase()),
      );
      return {
        openWork: open.length,
        overdue: overdue.length,
        atRiskProjects: atRisk.map((p) => ({
          id: p.id,
          title: p.title || p.name,
          evidenceRef: evidence("project", p.id),
        })),
      };
    }
    case "certo_list_pending_approvals": {
      if (!allow(identity, "approvals", "read")) throw new Error("GRANT_DENIED: approvals");
      const items = (snapshot.reviewItems || []).slice(0, 30).map((item) => ({
        id: item.id,
        title: item.title || item.summary,
        evidenceRef: evidence("approval", item.id),
      }));
      return { items };
    }
    default:
      throw new Error(`UNKNOWN_TOOL: ${name}`);
  }
}
