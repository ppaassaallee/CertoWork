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
    name: "list_my_items",
    description:
      "List items assigned to the current user. Always use this for 'my tasks / mis tareas'. Never infer ownership from chat prose.",
    parameters: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["today", "overdue", "week", "open"],
          description: "today | overdue | week | open",
        },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_item_context",
    description: "Load one item with title, status, due, project, and recent activity summary.",
    parameters: {
      type: "object",
      properties: {
        entityType: { type: "string", enum: ["task", "item"] },
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_my_approvals",
    description: "List pending approvals / review candidates for the current user.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_project_health",
    description: "Summarize health for specific projects or all open projects.",
    parameters: {
      type: "object",
      properties: {
        projectIds: { type: "array", items: { type: "string" } },
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
  {
    type: "function",
    name: "list_my_events",
    description: "List the user's calendar events in a date range (privacy already applied by the client).",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "find_free_slots",
    description: "Find free gaps in the user's calendar between from/to.",
    parameters: {
      type: "object",
      properties: {
        minMinutes: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "prepare_meeting",
    description: "Load structured context for preparing a calendar meeting.",
    parameters: {
      type: "object",
      properties: {
        eventId: { type: "string" },
      },
      required: ["eventId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_record",
    description: "Propose creating a table record. Returns a structured proposal; does not write unless approved.",
    parameters: {
      type: "object",
      properties: {
        tableId: { type: "string" },
        values: { type: "object", additionalProperties: true },
        title: { type: "string" },
      },
      required: ["tableId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_record_field",
    description: "Propose updating one field on a table record.",
    parameters: {
      type: "object",
      properties: {
        tableId: { type: "string" },
        recordId: { type: "string" },
        columnId: { type: "string" },
        value: {},
      },
      required: ["recordId", "columnId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_ticket",
    description: "Propose creating a support ticket linked to a record or project.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        projectId: { type: "string" },
        recordId: { type: "string" },
        tableId: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_note_from_template",
    description: "Propose creating a note from a template, optionally linked to a record.",
    parameters: {
      type: "object",
      properties: {
        templateId: { type: "string" },
        title: { type: "string" },
        recordId: { type: "string" },
        tableId: { type: "string" },
        projectId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "link_entities",
    description: "Propose linking two entities (record↔task/note/ticket/record).",
    parameters: {
      type: "object",
      properties: {
        fromType: { type: "string", enum: ["record", "task", "note", "ticket", "project"] },
        fromId: { type: "string" },
        toType: { type: "string", enum: ["record", "task", "note", "ticket", "project"] },
        toId: { type: "string" },
        relation: { type: "string" },
      },
      required: ["fromType", "fromId", "toType", "toId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_table_records",
    description: "List records for a table from the authorized workspace context.",
    parameters: {
      type: "object",
      properties: {
        tableId: { type: "string" },
        limit: { type: "number" },
        status: { type: "string" },
      },
      required: ["tableId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_record",
    description: "Load one table record with values and linked entities from context.",
    parameters: {
      type: "object",
      properties: {
        recordId: { type: "string" },
        tableId: { type: "string" },
      },
      required: ["recordId"],
      additionalProperties: false,
    },
  },
];

export const TOOL_LABELS = {
  search_projects: "Reviewing projects",
  get_project: "Loading project",
  get_overdue_items: "Checking overdue work",
  list_project_items: "Reviewing project items",
  list_my_items: "Loading your assigned items",
  get_item_context: "Loading item context",
  list_my_approvals: "Checking your approvals",
  list_project_health: "Checking project health",
  get_activity_summary: "Summarizing portfolio attention",
  propose_followups: "Preparing follow-up actions",
  prepare_status_report: "Preparing project report",
  recall_memory: "Recalling memory",
  remember_fact: "Saving memory",
  run_skill: "Running skill",
  list_schedules: "Checking schedules",
  list_my_events: "Reviewing your calendar",
  find_free_slots: "Finding free time",
  prepare_meeting: "Preparing for the meeting",
  create_record: "Creating table record",
  update_record_field: "Updating record field",
  create_ticket: "Creating ticket",
  create_note_from_template: "Creating note from template",
  link_entities: "Linking entities",
  list_table_records: "Listing table records",
  get_record: "Loading record",
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

  if (name === "list_my_items") {
    const userId = String(
      args?.userId ||
        workspaceContext?.userId ||
        workspaceContext?.currentUserId ||
        workspaceContext?.actor?.userId ||
        "",
    );
    const memberId = String(
      workspaceContext?.currentMemberId || workspaceContext?.actor?.memberId || "",
    );
    const filter = String(args?.filter || "open").toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const weekEnd = todayMs + 7 * 86_400_000;
    const tokens = new Set(
      [userId, memberId]
        .concat(asList(workspaceContext?.actor?.labels).map(String))
        .map((value) => String(value || "").toLowerCase())
        .filter(Boolean),
    );
    const mine = tasks.filter((task) => {
      if (isClosed(task.status) && filter !== "open") {
        /* still allow week filter to skip closed */
      }
      if (isClosed(task.status)) return false;
      const ids = []
        .concat(asList(task.assigneeIds))
        .concat(task.assigneeId ? [task.assigneeId] : [])
        .concat(task.assignedTo ? [task.assignedTo] : [])
        .map((value) => String(value || "").toLowerCase());
      const names = []
        .concat(asList(task.assignees))
        .concat(task.assignee ? [task.assignee] : [])
        .concat(task.owner ? [task.owner] : [])
        .map((value) => String(value || "").toLowerCase());
      const hit =
        ids.some((id) => tokens.has(id)) ||
        names.some((label) => tokens.has(label) || [...tokens].some((token) => label.includes(token)));
      if (!hit && !tokens.size) return false;
      if (!hit) return false;
      const due = dueTime(task.dueDate || task.targetDate);
      if (filter === "today") return due && due >= todayMs && due < todayMs + 86_400_000;
      if (filter === "overdue") return due && due < todayMs;
      if (filter === "week") return due && due >= todayMs && due < weekEnd;
      return true;
    });
    const items = mine.slice(0, limit).map((task) => ({
      id: task.id,
      title: titleOf(task),
      projectId: task.projectId || null,
      projectTitle: titleOf(projects.find((project) => project.id === task.projectId) || {}),
      status: task.status || "open",
      dueDate: task.dueDate || task.targetDate || null,
      priority: task.priority || null,
      workItemType: task.workItemType || task.itemType || task.type || "task",
    }));
    return {
      label: TOOL_LABELS.list_my_items,
      result: { count: items.length, filter, items, block: "items" },
    };
  }

  if (name === "get_item_context") {
    const id = String(args?.id || "");
    const task = tasks.find((entry) => String(entry.id) === id);
    if (!task) {
      return {
        label: TOOL_LABELS.get_item_context,
        result: { found: false, id },
      };
    }
    const project = projects.find((entry) => entry.id === task.projectId);
    const children = tasks
      .filter(
        (entry) =>
          String(entry.parentId || entry.featureId || entry.epicId || "") === id &&
          !isClosed(entry.status),
      )
      .slice(0, 12)
      .map((entry) => ({
        id: entry.id,
        title: titleOf(entry),
        status: entry.status || "open",
      }));
    return {
      label: TOOL_LABELS.get_item_context,
      result: {
        found: true,
        item: {
          id: task.id,
          title: titleOf(task),
          status: task.status || "open",
          priority: task.priority || null,
          dueDate: task.dueDate || task.targetDate || null,
          projectId: task.projectId || null,
          projectTitle: project ? titleOf(project) : null,
          description: String(task.description || "").slice(0, 800),
          children,
        },
      },
    };
  }

  if (name === "list_my_approvals") {
    const reviews = asList(workspaceContext?.reviewItems || workspaceContext?.approvals);
    const items = reviews
      .filter((entry) =>
        ["pending", "approved_for_review", "approval_required"].includes(
          String(entry.status || "").toLowerCase(),
        ),
      )
      .slice(0, limit)
      .map((entry) => ({
        id: entry.id,
        title: titleOf(entry) || String(entry.summary || entry.reason || "Approval"),
        status: entry.status || "pending",
        type: entry.type || entry.kind || "approval",
        createdAt: entry.createdAt || null,
      }));
    return { label: TOOL_LABELS.list_my_approvals, result: { count: items.length, items } };
  }

  if (name === "list_project_health") {
    const ids = asList(args?.projectIds).map(String).filter(Boolean);
    const pool = ids.length
      ? projects.filter((project) => ids.includes(String(project.id)))
      : projects.filter((project) => !isClosed(project.status));
    const items = pool.slice(0, limit).map((project) => {
      const health = projectHealth(project, tasks, risks);
      const open = tasks.filter(
        (task) => task.projectId === project.id && !isClosed(task.status),
      );
      const blocked = open.filter(
        (task) => String(task.status || "").toLowerCase() === "blocked",
      ).length;
      return {
        id: project.id,
        title: titleOf(project),
        health,
        openItems: open.length,
        blocked,
      };
    });
    return { label: TOOL_LABELS.list_project_health, result: { count: items.length, items } };
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

  if (name === "list_my_events") {
    const events = asList(workspaceContext?.events);
    const fromMs = args?.from ? Date.parse(args.from) : null;
    const toMs = args?.to ? Date.parse(args.to) : null;
    const items = events
      .filter((event) => {
        const start = Date.parse(event.start);
        if (!Number.isFinite(start) && !event.allDay) return false;
        const ms = event.allDay ? Date.parse(`${event.start}T12:00:00`) : start;
        if (fromMs != null && ms < fromMs) return false;
        if (toMs != null && ms > toMs) return false;
        return true;
      })
      .slice(0, limit);
    return { label: TOOL_LABELS.list_my_events, result: { count: items.length, events: items } };
  }

  if (name === "find_free_slots") {
    const events = asList(workspaceContext?.events).filter((event) => !event.allDay && !event.busy);
    const from = String(args?.from || new Date().toISOString());
    const to = String(args?.to || new Date(Date.now() + 2 * 86400000).toISOString());
    const minMinutes = Math.max(15, Number(args?.minMinutes || 90) || 90);
    const slots = findFreeSlotsJs(events, {
      from,
      to,
      minMinutes,
      workHours: { start: 8, end: 18 },
      timezone: "UTC",
    });
    return { label: TOOL_LABELS.find_free_slots, result: { count: slots.length, slots } };
  }

  if (name === "prepare_meeting") {
    const eventId = String(args?.eventId || "");
    const focused = workspaceContext?.focusedEvent;
    const events = asList(workspaceContext?.events);
    const event =
      (focused && String(focused.id) === eventId ? focused : null) ||
      events.find((row) => String(row.id) === eventId) ||
      null;
    if (!event) {
      return { label: TOOL_LABELS.prepare_meeting, result: { error: "Event not found in context." } };
    }
    const lines = [
      `Meeting: ${event.title || (event.busy ? "Busy" : "Untitled")}`,
      `When: ${event.start} → ${event.end}`,
      event.meetingUrl ? `Join: ${event.meetingUrl}` : null,
      event.attendees?.length ? `Attendees: ${event.attendees.join(", ")}` : null,
      event.linkedProject ? `Project: ${titleOf(event.linkedProject)}` : event.linkedProjectId ? `Project id: ${event.linkedProjectId}` : null,
      event.linkedItem ? `Item: ${titleOf(event.linkedItem)}` : event.linkedItemId ? `Item id: ${event.linkedItemId}` : null,
      event.linkedNote ? `Note: ${event.linkedNote.title || event.linkedNoteId}` : null,
    ].filter(Boolean);
    return {
      label: TOOL_LABELS.prepare_meeting,
      result: { event, brief: lines.join("\n") },
    };
  }

  if (name === "list_table_records") {
    const tableId = String(args?.tableId || "");
    const records = asList(workspaceContext?.records || workspaceContext?.tableRecords);
    const tables = asList(workspaceContext?.tables);
    const table = tables.find((row) => String(row.id) === tableId);
    const statusFilter = args?.status != null ? String(args.status) : null;
    const statusCol = table?.keyColumns?.status;
    const matched = records
      .filter((row) => String(row.tableId) === tableId)
      .filter((row) => {
        if (!statusFilter || !statusCol) return true;
        return String(row.values?.[statusCol] ?? "") === statusFilter;
      })
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        tableId: row.tableId,
        values: row.values || {},
        updatedAt: row.updatedAt || null,
      }));
    return {
      label: TOOL_LABELS.list_table_records,
      result: {
        count: matched.length,
        table: table ? { id: table.id, name: titleOf(table) } : { id: tableId },
        records: matched,
      },
    };
  }

  if (name === "get_record") {
    const recordId = String(args?.recordId || "");
    const tableId = args?.tableId ? String(args.tableId) : null;
    const records = asList(workspaceContext?.records || workspaceContext?.tableRecords);
    const links = asList(workspaceContext?.entityLinks);
    const record =
      records.find(
        (row) =>
          String(row.id) === recordId && (!tableId || String(row.tableId) === tableId),
      ) || null;
    if (!record) {
      return { label: TOOL_LABELS.get_record, result: { error: "Record not found in context." } };
    }
    const recordLinks = links.filter(
      (link) =>
        (String(link.fromEntityType) === "record" && String(link.fromEntityId) === recordId) ||
        (String(link.toEntityType) === "record" && String(link.toEntityId) === recordId),
    );
    return {
      label: TOOL_LABELS.get_record,
      result: { record, links: recordLinks },
    };
  }

  if (name === "create_record") {
    const tableId = String(args?.tableId || "");
    if (!tableId) {
      return { label: TOOL_LABELS.create_record, result: { error: "tableId required" } };
    }
    const values = args?.values && typeof args.values === "object" ? args.values : {};
    if (args?.title) values.title = args.title;
    const proposedActions = [
      {
        type: "create_record",
        safetyLevel: 1,
        confidence: 0.9,
        reason: "Create a table record",
        proposedChange: { tableId, values },
      },
    ];
    return {
      label: TOOL_LABELS.create_record,
      result: { ok: true, proposed: { tableId, values }, proposedActions },
      proposedActions,
    };
  }

  if (name === "update_record_field") {
    const recordId = String(args?.recordId || "");
    const columnId = String(args?.columnId || "");
    if (!recordId || !columnId) {
      return {
        label: TOOL_LABELS.update_record_field,
        result: { error: "recordId and columnId required" },
      };
    }
    const proposedActions = [
      {
        type: "update_record_field",
        safetyLevel: 1,
        confidence: 0.9,
        reason: "Update a table record field",
        proposedChange: {
          tableId: args?.tableId ? String(args.tableId) : null,
          recordId,
          columnId,
          value: args?.value ?? null,
        },
      },
    ];
    return {
      label: TOOL_LABELS.update_record_field,
      result: { ok: true, proposedActions },
      proposedActions,
    };
  }

  if (name === "create_ticket") {
    const title = String(args?.title || "").trim();
    if (!title) {
      return { label: TOOL_LABELS.create_ticket, result: { error: "title required" } };
    }
    const proposedActions = [
      {
        type: "create_ticket",
        safetyLevel: 2,
        confidence: 0.85,
        reason: "Create a support ticket",
        proposedChange: {
          title,
          body: String(args?.body || ""),
          projectId: args?.projectId ? String(args.projectId) : null,
          recordId: args?.recordId ? String(args.recordId) : null,
          tableId: args?.tableId ? String(args.tableId) : null,
          priority: String(args?.priority || "medium"),
        },
      },
    ];
    return {
      label: TOOL_LABELS.create_ticket,
      result: { ok: true, proposedActions },
      proposedActions,
    };
  }

  if (name === "create_note_from_template") {
    const proposedActions = [
      {
        type: "create_note_from_template",
        safetyLevel: 1,
        confidence: 0.85,
        reason: "Create a note from a template",
        proposedChange: {
          templateId: args?.templateId ? String(args.templateId) : null,
          title: args?.title ? String(args.title) : null,
          recordId: args?.recordId ? String(args.recordId) : null,
          tableId: args?.tableId ? String(args.tableId) : null,
          projectId: args?.projectId ? String(args.projectId) : null,
        },
      },
    ];
    return {
      label: TOOL_LABELS.create_note_from_template,
      result: { ok: true, proposedActions },
      proposedActions,
    };
  }

  if (name === "link_entities") {
    const fromType = String(args?.fromType || "");
    const fromId = String(args?.fromId || "");
    const toType = String(args?.toType || "");
    const toId = String(args?.toId || "");
    if (!fromType || !fromId || !toType || !toId) {
      return { label: TOOL_LABELS.link_entities, result: { error: "from/to type and id required" } };
    }
    const proposedActions = [
      {
        type: "link_entities",
        safetyLevel: 1,
        confidence: 0.9,
        reason: "Link two entities",
        proposedChange: {
          fromType,
          fromId,
          toType,
          toId,
          relation: args?.relation ? String(args.relation) : "related",
        },
      },
    ];
    return {
      label: TOOL_LABELS.link_entities,
      result: { ok: true, proposedActions },
      proposedActions,
    };
  }

  return { label: name, result: { error: `Unknown tool: ${name}` } };
}

/** Minimal free-slot finder (mirrors src/lib/calendar/freeSlots.ts for worker tools). */
function findFreeSlotsJs(events, opts) {
  const fromMs = Date.parse(opts.from);
  const toMs = Date.parse(opts.to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];
  const minMs = Math.max(1, opts.minMinutes) * 60_000;
  const busy = (events || [])
    .map((event) => {
      const start = Date.parse(event.start);
      const end = Date.parse(event.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return [Math.max(start, fromMs), Math.min(end, toMs)];
    })
    .filter((row) => row && row[1] > row[0])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const row of busy) {
    if (!merged.length || row[0] > merged[merged.length - 1][1]) merged.push([...row]);
    else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], row[1]);
  }
  const slots = [];
  let pointer = fromMs;
  for (const [s, e] of merged) {
    if (s - pointer >= minMs) {
      slots.push({ start: new Date(pointer).toISOString(), end: new Date(s).toISOString() });
    }
    pointer = Math.max(pointer, e);
  }
  if (toMs - pointer >= minMs) {
    slots.push({ start: new Date(pointer).toISOString(), end: new Date(toMs).toISOString() });
  }
  return slots;
}
