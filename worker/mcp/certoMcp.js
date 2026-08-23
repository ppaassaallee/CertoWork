/** Certo MCP read tools — Worker-safe JS (mirrors src/lib/agent-platform/certoMcp.ts). */

export function assertTenant(identity, requestedWorkspaceId) {
  if (identity.workspaceId !== requestedWorkspaceId) {
    const err = new Error("CROSS_TENANT_DENIED");
    err.code = "CROSS_TENANT_DENIED";
    throw err;
  }
}

function allow(identity, resource, mode) {
  return (identity.grants || []).some(
    (grant) =>
      (grant.resource === resource || grant.resource === "*") &&
      (mode === "read" ? true : grant.mode === "propose"),
  );
}

function evidence(type, id, version = "v0") {
  return { type, id, version };
}

export const CERTO_MCP_READ_TOOLS = [
  "certo_search_projects",
  "certo_get_project",
  "certo_search_work_items",
  "certo_get_work_item",
  "certo_list_project_work",
  "certo_get_attention_summary",
  "certo_list_pending_approvals",
];

export function executeCertoMcpTool(name, args = {}, identity, snapshot) {
  assertTenant(identity, snapshot.workspaceId);
  const projects = snapshot.projects || [];
  const tasks = snapshot.tasks || [];

  switch (name) {
    case "certo_search_projects": {
      if (!allow(identity, "projects", "read")) throw new Error("GRANT_DENIED: projects");
      const q = String(args.query || "").toLowerCase();
      return {
        items: projects
          .filter(
            (p) =>
              !q || String(p.title || p.name || "").toLowerCase().includes(q),
          )
          .slice(0, 20)
          .map((p) => ({
            id: p.id,
            title: p.title || p.name,
            health: p.health || "on_track",
            evidenceRef: evidence("project", p.id),
          })),
      };
    }
    case "certo_get_project": {
      if (!allow(identity, "projects", "read")) throw new Error("GRANT_DENIED: projects");
      const project = projects.find((p) => p.id === args.projectId);
      if (!project) return { error: "NOT_FOUND" };
      return {
        project: {
          id: project.id,
          title: project.title || project.name,
          evidenceRef: evidence("project", project.id),
        },
      };
    }
    case "certo_search_work_items": {
      if (!allow(identity, "tasks", "read")) throw new Error("GRANT_DENIED: tasks");
      const q = String(args.query || "").toLowerCase();
      return {
        items: tasks
          .filter((t) => !q || String(t.title || "").toLowerCase().includes(q))
          .slice(0, 40)
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            projectId: t.projectId,
            evidenceRef: evidence("work_item", t.id),
          })),
      };
    }
    case "certo_get_work_item": {
      if (!allow(identity, "tasks", "read")) throw new Error("GRANT_DENIED: tasks");
      const task = tasks.find((t) => t.id === args.workItemId || t.id === args.taskId);
      if (!task) return { error: "NOT_FOUND" };
      return { item: { id: task.id, title: task.title, evidenceRef: evidence("work_item", task.id) } };
    }
    case "certo_list_project_work": {
      if (!allow(identity, "tasks", "read")) throw new Error("GRANT_DENIED: tasks");
      return {
        items: tasks
          .filter((t) => t.projectId === args.projectId)
          .slice(0, 100)
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            evidenceRef: evidence("work_item", t.id),
          })),
      };
    }
    case "certo_get_attention_summary": {
      const open = tasks.filter(
        (t) => !["done", "completed", "cancelled"].includes(String(t.status || "").toLowerCase()),
      );
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
      return {
        items: (snapshot.reviewItems || []).slice(0, 30).map((item) => ({
          id: item.id,
          title: item.title || item.summary,
          evidenceRef: evidence("approval", item.id),
        })),
      };
    }
    default:
      throw new Error(`UNKNOWN_TOOL: ${name}`);
  }
}
