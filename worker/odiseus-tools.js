/**
 * Odysseus first-party tools — execute against the authorized workspaceContext
 * the client already scoped for this user. Never trust tools to invent records.
 */

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function titleOf(item) {
  return String(item?.title || item?.name || "Untitled").trim();
}

function isClosed(status) {
  return ["done", "completed", "closed", "archived", "cancelled", "deleted"].includes(
    String(status || "").toLowerCase(),
  );
}

function dueTime(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value?.seconds) return value.seconds * 1000;
  if (value?.toMillis) return value.toMillis();
  return 0;
}

function projectHealth(project, tasks, risks) {
  const explicit = String(project?.healthOverride || project?.health || "").toLowerCase();
  if (["blocked", "critical", "red"].includes(explicit)) return "blocked";
  if (["at_risk", "at risk", "risk", "warning", "yellow"].includes(explicit)) return "at_risk";
  const projectTasks = tasks.filter((task) => task.projectId === project.id && !isClosed(task.status));
  if (projectTasks.some((task) => String(task.status || "").toLowerCase() === "blocked")) return "blocked";
  const openRisks = risks.filter(
    (risk) =>
      risk.projectId === project.id &&
      !["closed", "resolved", "accepted"].includes(String(risk.status || "open").toLowerCase()),
  );
  if (openRisks.some((risk) => String(risk.severity || "").toLowerCase() === "critical")) return "blocked";
  if (openRisks.length) return "at_risk";
  const due = dueTime(project?.revisedDueDate || project?.dueDate || project?.targetDate);
  if (due && due < Date.now() && !isClosed(project?.status)) return "at_risk";
  return "on_track";
}

export const ODISEUS_TOOLS = [
  {
    type: "function",
    name: "search_projects",
    description: "Search the user's accessible projects by name, client, status, or health.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional search text" },
        health: { type: "string", enum: ["on_track", "at_risk", "blocked", "any"] },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_project",
    description: "Load one project with open task counts, health, and risks.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_overdue_items",
    description: "List overdue open tasks/items in scope, sorted by urgency.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Optional project filter" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_project_items",
    description: "List open tasks/items for a project or the whole accessible scope.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        status: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_activity_summary",
    description: "Summarize portfolio attention: counts on track / at risk / blocked and overdue items.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "propose_followups",
    description:
      "Propose reversible follow-up create_task actions for overdue or blocked work. Does not write yet — returns candidates for approval.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        maxActions: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "prepare_status_report",
    description:
      "Build an executive status report for one project from accessible evidence. Returns a Markdown artifact; does not write unless later approved as create_project_artifact.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "recall_memory",
    description: "Recall durable facts Odysseus previously remembered for this workspace.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional text filter" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "remember_fact",
    description:
      "Remember a durable workspace fact for future Odysseus sessions. Only store what the user affirmed.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
        kind: { type: "string", enum: ["preference", "fact", "commitment", "context"] },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "run_skill",
    description: "Run a workspace skill by id or name and return guided output as an artifact.",
    parameters: {
      type: "object",
      properties: {
        skillId: { type: "string" },
        skillName: { type: "string" },
        focus: { type: "string", description: "Optional focus for this invocation" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_schedules",
    description: "List Odysseus scheduled jobs the user has configured.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

export const TOOL_LABELS = {
  search_projects: "Reviewing projects",
  get_project: "Loading project",
  get_overdue_items: "Checking overdue work",
  list_project_items: "Reviewing project items",
  get_activity_summary: "Summarizing portfolio attention",
  propose_followups: "Preparing follow-up actions",
  prepare_status_report: "Preparing project report",
  recall_memory: "Recalling memory",
  remember_fact: "Saving memory",
  run_skill: "Running skill",
  list_schedules: "Checking schedules",
};

export function executeOdysseusTool(name, args, workspaceContext) {
  const projects = asList(workspaceContext?.projects);
  const tasks = asList(workspaceContext?.tasks);
  const risks = asList(workspaceContext?.risks);
  const memories = asList(workspaceContext?.odiseusMemory);
  const skills = asList(workspaceContext?.skills);
  const schedules = asList(workspaceContext?.schedules);
  const limit = Math.min(Number(args?.limit || 20) || 20, 50);

  if (name === "search_projects") {
    const query = String(args?.query || "").toLowerCase().trim();
    const healthFilter = String(args?.health || "any");
    const matched = projects
      .filter((project) => !isClosed(project.status))
      .map((project) => {
        const health = projectHealth(project, tasks, risks);
        return {
          id: project.id,
          title: titleOf(project),
          client: project.client || project.clientEntity || null,
          status: project.status || null,
          health,
          dueDate: project.dueDate || project.targetDate || null,
          openItems: tasks.filter((task) => task.projectId === project.id && !isClosed(task.status)).length,
        };
      })
      .filter((project) => {
        if (healthFilter !== "any" && project.health !== healthFilter) return false;
        if (!query) return true;
        return `${project.title} ${project.client || ""}`.toLowerCase().includes(query);
      })
      .slice(0, limit);
    return {
      label: TOOL_LABELS.search_projects,
      result: { count: matched.length, projects: matched },
    };
  }

  if (name === "get_project") {
    const project = projects.find((item) => item.id === args?.projectId);
    if (!project) return { label: TOOL_LABELS.get_project, result: { error: "Project not found in your accessible scope." } };
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectRisks = risks.filter((risk) => risk.projectId === project.id);
    return {
      label: TOOL_LABELS.get_project,
      result: {
        id: project.id,
        title: titleOf(project),
        outcome: project.outcome || null,
        status: project.status || null,
        health: projectHealth(project, tasks, risks),
        dueDate: project.dueDate || project.targetDate || null,
        openItems: projectTasks.filter((task) => !isClosed(task.status)).length,
        blockedItems: projectTasks.filter((task) => String(task.status || "").toLowerCase() === "blocked").length,
        openRisks: projectRisks.filter((risk) => !["closed", "resolved", "accepted"].includes(String(risk.status || "open").toLowerCase())).length,
        nextAction: project.nextAction || null,
      },
    };
  }

  if (name === "get_overdue_items") {
    const now = Date.now();
    const items = tasks
      .filter((task) => !isClosed(task.status))
      .filter((task) => !args?.projectId || task.projectId === args.projectId)
      .map((task) => {
        const due = dueTime(task.dueDate);
        return { task, due, overdueDays: due ? Math.floor((now - due) / 86_400_000) : null };
      })
      .filter((entry) => entry.due && entry.due < now)
      .sort((a, b) => a.due - b.due)
      .slice(0, limit)
      .map(({ task, overdueDays }) => ({
        id: task.id,
        title: titleOf(task),
        projectId: task.projectId || null,
        projectTitle: titleOf(projects.find((project) => project.id === task.projectId) || {}),
        dueDate: task.dueDate || null,
        overdueDays,
        status: task.status || "open",
        priority: task.priority || null,
      }));
    return { label: TOOL_LABELS.get_overdue_items, result: { count: items.length, items } };
  }

  if (name === "list_project_items") {
    const statusFilter = String(args?.status || "").toLowerCase();
    const items = tasks
      .filter((task) => !args?.projectId || task.projectId === args.projectId)
      .filter((task) => (statusFilter ? String(task.status || "").toLowerCase() === statusFilter : !isClosed(task.status)))
      .slice(0, limit)
      .map((task) => ({
        id: task.id,
        title: titleOf(task),
        projectId: task.projectId || null,
        status: task.status || "open",
        dueDate: task.dueDate || null,
        priority: task.priority || null,
      }));
    return { label: TOOL_LABELS.list_project_items, result: { count: items.length, items } };
  }

  if (name === "get_activity_summary") {
    const openProjects = projects.filter((project) => !isClosed(project.status));
    const byHealth = { on_track: 0, at_risk: 0, blocked: 0 };
    for (const project of openProjects) {
      byHealth[projectHealth(project, tasks, risks)] += 1;
    }
    const overdue = tasks.filter((task) => {
      if (isClosed(task.status)) return false;
      const due = dueTime(task.dueDate);
      return due && due < Date.now();
    }).length;
    return {
      label: TOOL_LABELS.get_activity_summary,
      result: {
        projects: openProjects.length,
        onTrack: byHealth.on_track,
        atRisk: byHealth.at_risk,
        blocked: byHealth.blocked,
        overdueItems: overdue,
        openItems: tasks.filter((task) => !isClosed(task.status)).length,
      },
    };
  }

  if (name === "propose_followups") {
    const maxActions = Math.min(Number(args?.maxActions || 5) || 5, 8);
    const now = Date.now();
    const candidates = tasks
      .filter((task) => !isClosed(task.status))
      .filter((task) => !args?.projectId || task.projectId === args.projectId)
      .filter((task) => {
        const due = dueTime(task.dueDate);
        return (due && due < now) || String(task.status || "").toLowerCase() === "blocked";
      })
      .slice(0, maxActions)
      .map((task) => {
        const project = projects.find((item) => item.id === task.projectId);
        return {
          type: "create_task",
          safetyLevel: 2,
          confidence: 0.82,
          reason: `Follow up on overdue or blocked work`,
          proposedChange: {
            title: `Follow up: ${titleOf(task)}`,
            projectId: task.projectId || null,
            projectTitle: project ? titleOf(project) : null,
            priority: "high",
            status: "open",
            sourceTaskId: task.id,
          },
        };
      });
    return {
      label: TOOL_LABELS.propose_followups,
      result: { count: candidates.length, proposedActions: candidates },
      proposedActions: candidates,
    };
  }

  if (name === "prepare_status_report") {
    const project = projects.find((item) => item.id === args?.projectId);
    if (!project) {
      return {
        label: TOOL_LABELS.prepare_status_report,
        result: { error: "Project not found in your accessible scope." },
      };
    }
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const open = projectTasks.filter((task) => !isClosed(task.status));
    const blocked = open.filter((task) => String(task.status || "").toLowerCase() === "blocked");
    const overdue = open.filter((task) => {
      const due = dueTime(task.dueDate);
      return due && due < Date.now();
    });
    const health = projectHealth(project, tasks, risks);
    const title = `Status report — ${titleOf(project)}`;
    const attentionLines = [
      ...blocked.slice(0, 5).map((task) => `- Blocked: ${titleOf(task)}`),
      ...overdue.slice(0, 5).map((task) => `- Overdue: ${titleOf(task)}`),
    ];
    const body = [
      `# ${title}`,
      "",
      `Health: **${health.replace("_", " ")}**`,
      `Open items: ${open.length} · Blocked: ${blocked.length} · Overdue: ${overdue.length}`,
      project.outcome ? `\nOutcome: ${project.outcome}` : "",
      "",
      "## Highest attention",
      ...(attentionLines.length ? attentionLines : ["- None flagged"]),
      "",
      "## Next action",
      project.nextAction || "Confirm owners and clear the top blockers.",
    ]
      .filter(Boolean)
      .join("\n");
    const artifact = {
      kind: "markdown_report",
      title,
      summary: `${open.length} open · ${blocked.length} blocked · ${overdue.length} overdue`,
      body,
      projectId: project.id,
    };
    const proposedActions = [
      {
        type: "create_project_artifact",
        safetyLevel: 2,
        confidence: 0.9,
        reason: "Attach the generated status report to the project",
        proposedChange: {
          projectId: project.id,
          title,
          kind: "status_report",
          content: body,
          generatedBy: "odiseus",
        },
      },
    ];
    return {
      label: TOOL_LABELS.prepare_status_report,
      result: { artifact, proposedActions },
      proposedActions,
      artifact,
    };
  }

  if (name === "recall_memory") {
    const query = String(args?.query || "").toLowerCase().trim();
    const matched = memories
      .filter((item) => !query || String(item.text || "").toLowerCase().includes(query) || asList(item.tags).join(" ").toLowerCase().includes(query))
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        text: item.text,
        kind: item.kind || "fact",
        tags: asList(item.tags),
      }));
    return { label: TOOL_LABELS.recall_memory, result: { count: matched.length, memories: matched } };
  }

  if (name === "remember_fact") {
    const text = String(args?.text || "").trim();
    if (!text) {
      return { label: TOOL_LABELS.remember_fact, result: { error: "Nothing to remember." } };
    }
    const proposedActions = [
      {
        type: "create_odiseus_memory",
        safetyLevel: 1,
        confidence: 0.95,
        reason: "Store a durable Odysseus memory for future sessions",
        proposedChange: {
          text: text.slice(0, 2_000),
          kind: String(args?.kind || "fact"),
          tags: asList(args?.tags).slice(0, 12),
        },
      },
    ];
    return {
      label: TOOL_LABELS.remember_fact,
      result: { remembered: text.slice(0, 200), proposedActions },
      proposedActions,
    };
  }

  if (name === "run_skill") {
    const skillId = String(args?.skillId || "").trim();
    const skillName = String(args?.skillName || "").toLowerCase().trim();
    const skill =
      skills.find((item) => item.id === skillId) ||
      skills.find((item) => String(item.name || item.title || "").toLowerCase() === skillName) ||
      skills.find((item) => String(item.name || item.title || "").toLowerCase().includes(skillName));
    if (!skill) {
      return {
        label: TOOL_LABELS.run_skill,
        result: {
          error: skills.length
            ? "Skill not found in your workspace skill library."
            : "No skills are loaded in this workspace yet.",
          available: skills.slice(0, 12).map((item) => ({
            id: item.id,
            name: item.name || item.title,
          })),
        },
      };
    }
    const focus = String(args?.focus || "").trim();
    const title = `Skill · ${skill.name || skill.title || "Untitled"}`;
    const body = [
      `# ${title}`,
      focus ? `\nFocus: ${focus}` : "",
      "",
      "## Skill instructions",
      String(skill.instructions || skill.prompt || skill.description || "No instructions stored."),
      "",
      "## Suggested next moves",
      "- Apply the skill output to the current project or conversation.",
      "- Ask Odysseus to turn the result into approved follow-up actions.",
    ]
      .filter(Boolean)
      .join("\n");
    const artifact = {
      kind: "skill_run",
      title,
      summary: focus || String(skill.description || "Skill run").slice(0, 160),
      body,
      skillId: skill.id,
    };
    return {
      label: TOOL_LABELS.run_skill,
      result: { artifact, skillId: skill.id },
      artifact,
    };
  }

  if (name === "list_schedules") {
    const items = schedules.slice(0, limit).map((item) => ({
      id: item.id,
      title: item.title || item.name || "Scheduled job",
      cron: item.cron || item.schedule || null,
      prompt: item.prompt || item.body || "",
      enabled: item.enabled !== false,
      lastRunAt: item.lastRunAt || null,
    }));
    return { label: TOOL_LABELS.list_schedules, result: { count: items.length, schedules: items } };
  }

  return { label: name, result: { error: `Unknown tool: ${name}` } };
}
