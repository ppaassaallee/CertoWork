const MCP_PROTOCOL_VERSION = "2025-06-18";
const MAX_BRIDGE_ITEMS = 250;
const MAX_BRIDGE_DOCUMENTS = 40;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS codex_connections (
    id TEXT PRIMARY KEY,
    platform_user_id TEXT NOT NULL,
    firebase_user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    conversation_id TEXT,
    handoff_code TEXT NOT NULL,
    project_title TEXT NOT NULL,
    repository_root TEXT,
    repository_url TEXT,
    codex_task_reference TEXT,
    sync_mode TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_sync_at TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_codex_connections_platform_handoff
    ON codex_connections(platform_user_id, handoff_code)`,
  `CREATE INDEX IF NOT EXISTS idx_codex_connections_platform_project
    ON codex_connections(platform_user_id, project_id)`,
  `CREATE TABLE IF NOT EXISTS codex_project_snapshots (
    connection_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS codex_work_snapshots (
    connection_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    item_key TEXT,
    item_type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    ready_for_codex INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(connection_id, item_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_codex_work_ready
    ON codex_work_snapshots(connection_id, ready_for_codex, status)`,
  `CREATE TABLE IF NOT EXISTS codex_document_snapshots (
    connection_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(connection_id, document_id)
  )`,
  `CREATE TABLE IF NOT EXISTS codex_bridge_events (
    id TEXT PRIMARY KEY,
    platform_user_id TEXT NOT NULL,
    firebase_user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    connection_id TEXT NOT NULL,
    work_item_id TEXT,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_codex_events_connection_status
    ON codex_bridge_events(connection_id, status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS codex_delivery_runs (
    id TEXT PRIMARY KEY,
    platform_user_id TEXT NOT NULL,
    connection_id TEXT NOT NULL,
    work_item_id TEXT,
    codex_task_reference TEXT,
    title TEXT,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    updated_at TEXT NOT NULL
  )`,
];

let schemaReady = false;

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function asText(value, max = 12_000) {
  return String(value || "").trim().slice(0, max);
}

function uniqueText(values, max = 100) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => asText(value, 2_000)).filter(Boolean))].slice(0, max);
}

async function ensureSchema(env) {
  if (!env.DB) throw new Error("The Codex bridge database is not configured");
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map((statement) => env.DB.prepare(statement)));
  schemaReady = true;
}

async function batchRun(db, statements, size = 75) {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message, data) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

function toolResult(value, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    isError,
  };
}

export const codexBridgeTools = [
  {
    name: "list_delivery_links",
    description: "List Certo Work project conversations linked to the signed-in Codex user.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "get_delivery_context",
    description: "Load the selected Certo Work project, hierarchy, PBIs, and knowledge summaries for one handoff.",
    inputSchema: {
      type: "object",
      properties: {
        handoffCode: { type: "string", description: "Handoff code shown in the Certo Work project console." },
        projectId: { type: "string", description: "Exact Certo Work project ID when the handoff code is unavailable." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "list_ready_work_items",
    description: "List only executable work items that Certo Work explicitly shared with Codex.",
    inputSchema: {
      type: "object",
      properties: { handoffCode: { type: "string" }, projectId: { type: "string" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "link_codex_task",
    description: "Link the current Codex task label or URL to a Certo Work project conversation.",
    inputSchema: {
      type: "object",
      required: ["handoffCode"],
      properties: {
        handoffCode: { type: "string" },
        codexTaskReference: { type: "string", description: "Current Codex task URL or ID when available." },
        title: { type: "string", description: "Short title for this Codex delivery task." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "claim_work_item",
    description: "Claim one shared PBI, story, task, bug, or subtask before implementation begins.",
    inputSchema: {
      type: "object",
      required: ["handoffCode", "workItemId"],
      properties: {
        handoffCode: { type: "string" },
        workItemId: { type: "string" },
        runId: { type: "string" },
        codexTaskReference: { type: "string" },
        summary: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "report_work_item_progress",
    description: "Report real delivery progress, blockers, evidence, and next action for a shared work item.",
    inputSchema: {
      type: "object",
      required: ["handoffCode", "workItemId", "status", "summary"],
      properties: {
        handoffCode: { type: "string" }, workItemId: { type: "string" }, runId: { type: "string" },
        codexTaskReference: { type: "string" },
        status: { type: "string", enum: ["in_progress", "in_review", "blocked"] },
        summary: { type: "string" }, blockers: { type: "array", items: { type: "string" } },
        filesChanged: { type: "array", items: { type: "string" } },
        tests: { type: "array", items: { type: "string" } },
        acceptanceEvidence: { type: "array", items: { type: "string" } },
        knowledgeNotes: { type: "array", items: { type: "string" } },
        remainingGaps: { type: "array", items: { type: "string" } },
        branchName: { type: "string" }, commitSha: { type: "string" }, pullRequestUrl: { type: "string" },
        buildUrl: { type: "string" }, releaseVersion: { type: "string" }, releaseNotes: { type: "string" },
        deploymentUrl: { type: "string" }, environment: { type: "string" }, rollbackPlan: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "complete_work_item",
    description: "Mark a shared work item complete only with truthful test and acceptance evidence; also creates the delivery knowledge note.",
    inputSchema: {
      type: "object",
      required: ["handoffCode", "workItemId", "summary", "tests", "acceptanceEvidence"],
      properties: {
        handoffCode: { type: "string" }, workItemId: { type: "string" }, runId: { type: "string" },
        codexTaskReference: { type: "string" }, summary: { type: "string" },
        filesChanged: { type: "array", items: { type: "string" } },
        tests: { type: "array", items: { type: "string" } },
        acceptanceEvidence: { type: "array", items: { type: "string" } },
        knowledgeNotes: { type: "array", items: { type: "string" } },
        remainingGaps: { type: "array", items: { type: "string" } },
        branchName: { type: "string" }, commitSha: { type: "string" }, pullRequestUrl: { type: "string" },
        buildUrl: { type: "string" }, releaseVersion: { type: "string" }, releaseNotes: { type: "string" },
        deploymentUrl: { type: "string" }, environment: { type: "string" }, rollbackPlan: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "report_project_gap",
    description: "Report missing scope, dependency, design, security, data, or acceptance information without blocking safe work. Suggestions return for Certo Work review.",
    inputSchema: {
      type: "object",
      required: ["handoffCode", "title", "details", "severity"],
      properties: {
        handoffCode: { type: "string" }, title: { type: "string" }, details: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        suggestedWorkItems: {
          type: "array",
          items: { type: "object", required: ["title"], properties: { title: { type: "string" }, type: { type: "string" }, reason: { type: "string" }, priority: { type: "string" } }, additionalProperties: true },
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
];

async function browserIdentity(request, body, env, helpers) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Firebase sign-in is required");
  const userId = body.userId;
  if (!userId) throw new Error("userId is required");
  await helpers.verifyFirebaseToken(
    authorization.slice("Bearer ".length),
    userId,
    env.FIREBASE_PROJECT_ID || helpers.firebaseProjectId,
  );
  return { firebaseUserId: userId, platform: helpers.platformIdentity(request) };
}

async function connectionForPlatform(env, platformUserId, args = {}) {
  if (args.handoffCode) {
    return env.DB.prepare(
      "SELECT * FROM codex_connections WHERE platform_user_id = ? AND handoff_code = ? AND status != 'disabled' LIMIT 1",
    ).bind(platformUserId, asText(args.handoffCode, 100)).first();
  }
  if (args.projectId) {
    return env.DB.prepare(
      "SELECT * FROM codex_connections WHERE platform_user_id = ? AND project_id = ? AND status != 'disabled' ORDER BY updated_at DESC LIMIT 1",
    ).bind(platformUserId, asText(args.projectId, 200)).first();
  }
  return env.DB.prepare(
    "SELECT * FROM codex_connections WHERE platform_user_id = ? AND status != 'disabled' ORDER BY updated_at DESC LIMIT 1",
  ).bind(platformUserId).first();
}

async function connectionForBrowser(env, connectionId, firebaseUserId, workspaceId) {
  return env.DB.prepare(
    "SELECT * FROM codex_connections WHERE id = ? AND firebase_user_id = ? AND workspace_id = ? LIMIT 1",
  ).bind(asText(connectionId, 200), firebaseUserId, asText(workspaceId, 200)).first();
}

function publicConnection(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    handoffCode: row.handoff_code,
    projectTitle: row.project_title,
    repositoryRoot: row.repository_root,
    repositoryUrl: row.repository_url,
    codexTaskReference: row.codex_task_reference,
    syncMode: row.sync_mode,
    status: row.status,
    lastSyncAt: row.last_sync_at,
  };
}

async function createEvent(env, connection, kind, workItemId, payload, forcePending = false) {
  const id = randomId("cbe");
  const createdAt = nowIso();
  const autoAuthorized = !forcePending && connection.sync_mode === "completion_and_notes";
  const status = autoAuthorized ? "authorized" : "pending";
  const cleanPayload = {
    ...payload,
    summary: asText(payload.summary, 8_000),
    blockers: uniqueText(payload.blockers, 50),
    filesChanged: uniqueText(payload.filesChanged, 100),
    tests: uniqueText(payload.tests, 100),
    acceptanceEvidence: uniqueText(payload.acceptanceEvidence, 100),
    knowledgeNotes: uniqueText(payload.knowledgeNotes, 100),
    remainingGaps: uniqueText(payload.remainingGaps, 100),
    branchName: asText(payload.branchName, 500) || null,
    commitSha: asText(payload.commitSha, 200) || null,
    pullRequestUrl: asText(payload.pullRequestUrl, 2_000) || null,
    buildUrl: asText(payload.buildUrl, 2_000) || null,
    releaseVersion: asText(payload.releaseVersion, 500) || null,
    releaseNotes: asText(payload.releaseNotes, 8_000) || null,
    deploymentUrl: asText(payload.deploymentUrl, 2_000) || null,
    environment: asText(payload.environment, 500) || null,
    rollbackPlan: asText(payload.rollbackPlan, 8_000) || null,
  };
  await env.DB.prepare(
    `INSERT INTO codex_bridge_events (
      id, platform_user_id, firebase_user_id, workspace_id, project_id, connection_id,
      work_item_id, kind, status, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, connection.platform_user_id, connection.firebase_user_id, connection.workspace_id,
    connection.project_id, connection.id, workItemId || null, kind, status,
    JSON.stringify(cleanPayload), createdAt, createdAt,
  ).run();
  return { id, status, kind, workItemId: workItemId || null, payload: cleanPayload, createdAt };
}

async function getBridgeContext(env, connection, readyOnly = false) {
  const projectRow = await env.DB.prepare(
    "SELECT payload_json FROM codex_project_snapshots WHERE connection_id = ? LIMIT 1",
  ).bind(connection.id).first();
  const workRows = await env.DB.prepare(
    "SELECT payload_json, item_type, ready_for_codex FROM codex_work_snapshots WHERE connection_id = ? ORDER BY ready_for_codex DESC, item_key, title",
  ).bind(connection.id).all();
  const documentRows = await env.DB.prepare(
    "SELECT payload_json FROM codex_document_snapshots WHERE connection_id = ? ORDER BY updated_at DESC LIMIT 40",
  ).bind(connection.id).all();
  const workItems = (workRows.results || [])
    .filter((row) => readyOnly ? Number(row.ready_for_codex) === 1 : Number(row.ready_for_codex) === 1 || ["epic", "feature"].includes(row.item_type))
    .map((row) => parseJson(row.payload_json));
  return {
    connection: publicConnection(connection),
    project: parseJson(projectRow?.payload_json, null),
    workItems,
    documents: readyOnly ? [] : (documentRows.results || []).map((row) => parseJson(row.payload_json)),
    contract: {
      sourceOfTruth: "Certo Work Firestore",
      transport: "Scoped Codex bridge snapshot",
      automaticUpdates: connection.sync_mode === "completion_and_notes" ? ["progress", "completion", "delivery_evidence", "knowledge_notes"] : [],
      alwaysRequiresReview: ["new_scope", "new_work_items", "destructive_changes", "cross_project_changes"],
      repositoryVersioning: [
        "repository",
        "branch",
        "commit",
        "pull_request",
        "build_or_tests",
        "release_version",
        "deployment_environment",
        "rollback",
        "knowledge",
      ],
    },
  };
}

async function callBridgeTool(env, platform, name, args) {
  if (name === "list_delivery_links") {
    const rows = await env.DB.prepare(
      "SELECT * FROM codex_connections WHERE platform_user_id = ? AND status != 'disabled' ORDER BY updated_at DESC LIMIT 50",
    ).bind(platform.id).all();
    return { links: (rows.results || []).map(publicConnection) };
  }

  const connection = await connectionForPlatform(env, platform.id, args);
  if (!connection) throw new Error("No Certo Work handoff matches this signed-in Codex user and code");

  if (name === "get_delivery_context") return getBridgeContext(env, connection, false);
  if (name === "list_ready_work_items") return getBridgeContext(env, connection, true);

  if (name === "link_codex_task") {
    const reference = asText(args.codexTaskReference, 2_000);
    await env.DB.prepare(
      "UPDATE codex_connections SET codex_task_reference = ?, status = 'connected', updated_at = ? WHERE id = ? AND platform_user_id = ?",
    ).bind(reference || null, nowIso(), connection.id, platform.id).run();
    return { linked: true, connectionId: connection.id, projectId: connection.project_id, conversationId: connection.conversation_id, codexTaskReference: reference || null };
  }

  if (name === "claim_work_item") {
    const workItem = await env.DB.prepare(
      "SELECT * FROM codex_work_snapshots WHERE connection_id = ? AND item_id = ? AND ready_for_codex = 1 LIMIT 1",
    ).bind(connection.id, asText(args.workItemId, 200)).first();
    if (!workItem) throw new Error("That work item was not shared with Codex or is no longer available");
    const runId = asText(args.runId, 200) || randomId("run");
    const startedAt = nowIso();
    await env.DB.prepare(
      `INSERT INTO codex_delivery_runs (id, platform_user_id, connection_id, work_item_id, codex_task_reference, title, status, started_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = 'in_progress', updated_at = excluded.updated_at`,
    ).bind(runId, platform.id, connection.id, workItem.item_id, asText(args.codexTaskReference, 2_000) || null, asText(args.summary, 1_000) || workItem.title, startedAt, startedAt).run();
    const event = await createEvent(env, connection, "work_item_claimed", workItem.item_id, {
      ...args, runId, status: "in_progress", summary: args.summary || `Codex claimed ${workItem.item_key || workItem.title}`,
    });
    return { claimed: true, runId, workItem: parseJson(workItem.payload_json), event };
  }

  if (["report_work_item_progress", "complete_work_item"].includes(name)) {
    const workItem = await env.DB.prepare(
      "SELECT * FROM codex_work_snapshots WHERE connection_id = ? AND item_id = ? AND ready_for_codex = 1 LIMIT 1",
    ).bind(connection.id, asText(args.workItemId, 200)).first();
    if (!workItem) throw new Error("That work item was not shared with Codex or is no longer available");
    const completed = name === "complete_work_item";
    if (completed && (!Array.isArray(args.tests) || !Array.isArray(args.acceptanceEvidence))) {
      throw new Error("Completion requires real tests and acceptance evidence arrays; use empty arrays only when genuinely not applicable and explain why in the summary");
    }
    const event = await createEvent(env, connection, completed ? "work_item_completed" : "work_item_progress", workItem.item_id, {
      ...args, status: completed ? "done" : args.status,
    });
    if (args.runId) {
      await env.DB.prepare(
        "UPDATE codex_delivery_runs SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND platform_user_id = ?",
      ).bind(completed ? "completed" : args.status, completed ? nowIso() : null, nowIso(), asText(args.runId, 200), platform.id).run();
    }
    return {
      accepted: true,
      event,
      application: event.status === "authorized" ? "Certo Work will apply this scoped update and knowledge evidence automatically." : "This update is waiting for review in the Certo Work Project Console.",
    };
  }

  if (name === "report_project_gap") {
    const event = await createEvent(env, connection, "project_gap", null, {
      title: asText(args.title, 500), details: asText(args.details, 12_000), severity: args.severity || "medium",
      suggestedWorkItems: Array.isArray(args.suggestedWorkItems) ? args.suggestedWorkItems.slice(0, 12) : [],
    }, true);
    return { recorded: true, event, application: "The gap and suggested work are waiting for review in Certo Work; safe in-scope work may continue." };
  }

  throw new Error(`Unknown Certo Work tool: ${name}`);
}

async function handleMcp(request, env, helpers) {
  const platform = helpers.platformIdentity(request);
  if (!platform) return helpers.json({ error: "Sign in to Codex with the account allowed to access this Certo Work site." }, 401);
  await ensureSchema(env);
  let message;
  try {
    message = await helpers.readJson(request);
  } catch (error) {
    return helpers.json(rpcError(null, -32700, error instanceof Error ? error.message : "Invalid JSON"), 400);
  }

  const id = message?.id;
  if (message?.method === "notifications/initialized" || message?.method === "notifications/cancelled") {
    return new Response(null, { status: 202 });
  }
  if (message?.method === "initialize") {
    return helpers.json(rpcResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "delivereeos-bridge", title: "Certo Work Delivery Bridge", version: "1.0.0" },
      instructions: "Use a Certo Work handoff code to load only the approved project/PBI context. Claim work before implementation. Report truthful progress and completion evidence. Never invent tests, commits, PRs, builds, or deployments.",
    }));
  }
  if (message?.method === "ping") return helpers.json(rpcResult(id, {}));
  if (message?.method === "tools/list") return helpers.json(rpcResult(id, { tools: codexBridgeTools }));
  if (message?.method === "tools/call") {
    try {
      const value = await callBridgeTool(env, platform, message.params?.name, message.params?.arguments || {});
      return helpers.json(rpcResult(id, toolResult(value)));
    } catch (error) {
      return helpers.json(rpcResult(id, toolResult({ error: error instanceof Error ? error.message : "Certo Work bridge error" }, true)));
    }
  }
  return helpers.json(rpcError(id, -32601, "Method not found"), 404);
}

async function upsertConnection(request, env, helpers) {
  const body = await helpers.readJson(request);
  const identity = await browserIdentity(request, body, env, helpers);
  if (!identity.platform?.id) throw new Error("Open Certo Work from its signed-in ChatGPT Site before creating the Codex link");
  const connection = body.connection || {};
  if (!connection.id || !body.workspaceId || !connection.projectId || !connection.handoffCode) {
    throw new Error("A complete workspace, project, and handoff code are required");
  }
  const existing = await env.DB.prepare(
    "SELECT platform_user_id, firebase_user_id, workspace_id, project_id FROM codex_connections WHERE id = ? LIMIT 1",
  ).bind(asText(connection.id, 200)).first();
  if (existing && (
    existing.platform_user_id !== identity.platform.id
    || existing.firebase_user_id !== identity.firebaseUserId
    || existing.workspace_id !== asText(body.workspaceId, 200)
    || existing.project_id !== asText(connection.projectId, 200)
  )) {
    throw new Error("This Codex connection belongs to a different account, workspace, or project");
  }
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO codex_connections (
      id, platform_user_id, firebase_user_id, workspace_id, project_id, conversation_id,
      handoff_code, project_title, repository_root, repository_url, codex_task_reference,
      sync_mode, status, created_at, updated_at, last_sync_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      conversation_id = excluded.conversation_id,
      repository_root = excluded.repository_root,
      repository_url = excluded.repository_url,
      codex_task_reference = excluded.codex_task_reference,
      sync_mode = excluded.sync_mode,
      project_title = excluded.project_title,
      status = CASE
        WHEN codex_connections.status = 'connected' AND excluded.status = 'ready' THEN 'connected'
        ELSE excluded.status
      END,
      updated_at = excluded.updated_at`,
  ).bind(
    asText(connection.id, 200), identity.platform.id, identity.firebaseUserId,
    asText(body.workspaceId, 200), asText(connection.projectId, 200), asText(connection.conversationId, 200) || null,
    asText(connection.handoffCode, 100), asText(body.projectTitle, 500) || "Untitled project",
    asText(connection.repositoryRoot, 2_000) || null, asText(connection.repositoryUrl, 2_000) || null,
    asText(connection.codexTaskReference, 2_000) || null,
    connection.syncMode === "review_every_change" ? "review_every_change" : "completion_and_notes",
    connection.status === "disabled" ? "disabled" : "ready", now, now, null,
  ).run();
  return helpers.json({ ok: true, connectionId: connection.id, handoffCode: connection.handoffCode });
}

async function saveSnapshot(request, env, helpers) {
  const body = await helpers.readJson(request);
  const identity = await browserIdentity(request, body, env, helpers);
  const connection = await connectionForBrowser(env, body.connectionId, identity.firebaseUserId, body.workspaceId);
  if (!connection) throw new Error("The Codex connection is not available for this workspace");
  if (identity.platform?.id && identity.platform.id !== connection.platform_user_id) throw new Error("This ChatGPT account does not own the Codex link");
  if (String(body.project?.id || "") !== connection.project_id) throw new Error("Project scope does not match the Codex link");
  const now = nowIso();
  const workItems = (Array.isArray(body.workItems) ? body.workItems : []).slice(0, MAX_BRIDGE_ITEMS);
  const documents = (Array.isArray(body.documents) ? body.documents : []).slice(0, MAX_BRIDGE_DOCUMENTS);
  const statements = [
    env.DB.prepare("DELETE FROM codex_work_snapshots WHERE connection_id = ?").bind(connection.id),
    env.DB.prepare("DELETE FROM codex_document_snapshots WHERE connection_id = ?").bind(connection.id),
    env.DB.prepare(
      `INSERT INTO codex_project_snapshots (connection_id, project_id, payload_json, updated_at)
       VALUES (?, ?, ?, ?) ON CONFLICT(connection_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    ).bind(connection.id, connection.project_id, JSON.stringify({ ...(body.project || {}), conversation: body.conversation || null }), now),
    ...workItems.map((item) => env.DB.prepare(
      `INSERT INTO codex_work_snapshots (
        connection_id, item_id, project_id, item_key, item_type, title, status,
        ready_for_codex, payload_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      connection.id, asText(item.id, 200), connection.project_id, asText(item.key, 200) || null,
      asText(item.type, 100) || "task", asText(item.title, 500) || "Untitled", asText(item.status, 100) || "backlog",
      item.readyForCodex ? 1 : 0, JSON.stringify(item), now,
    )),
    ...documents.map((item) => env.DB.prepare(
      `INSERT INTO codex_document_snapshots (connection_id, document_id, project_id, title, payload_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(connection.id, asText(item.id, 200), connection.project_id, asText(item.title, 500), JSON.stringify(item), now)),
    env.DB.prepare(
      "UPDATE codex_connections SET last_sync_at = ?, updated_at = ?, status = CASE WHEN status = 'connected' THEN 'connected' ELSE 'ready' END WHERE id = ?",
    ).bind(now, now, connection.id),
  ];
  await batchRun(env.DB, statements);
  return helpers.json({ ok: true, connectionId: connection.id, workItemCount: workItems.length, documentCount: documents.length, syncedAt: now });
}

async function listEvents(request, env, helpers) {
  const url = new URL(request.url);
  const body = {
    userId: url.searchParams.get("userId"),
    workspaceId: url.searchParams.get("workspaceId"),
    connectionId: url.searchParams.get("connectionId"),
  };
  const identity = await browserIdentity(request, body, env, helpers);
  const connection = await connectionForBrowser(env, body.connectionId, identity.firebaseUserId, body.workspaceId);
  if (!connection) throw new Error("The Codex connection is not available for this workspace");
  const rows = await env.DB.prepare(
    "SELECT * FROM codex_bridge_events WHERE connection_id = ? AND status IN ('pending', 'authorized') ORDER BY created_at DESC LIMIT 50",
  ).bind(connection.id).all();
  return helpers.json({
    events: (rows.results || []).map((row) => ({
      id: row.id, connectionId: row.connection_id, workItemId: row.work_item_id,
      kind: row.kind, status: row.status, payload: parseJson(row.payload_json), createdAt: row.created_at,
    })),
  });
}

async function acknowledgeEvent(request, env, helpers) {
  const body = await helpers.readJson(request);
  const identity = await browserIdentity(request, body, env, helpers);
  const connection = await connectionForBrowser(env, body.connectionId, identity.firebaseUserId, body.workspaceId);
  if (!connection) throw new Error("The Codex connection is not available for this workspace");
  const status = body.status === "rejected" ? "rejected" : "applied";
  const result = await env.DB.prepare(
    "UPDATE codex_bridge_events SET status = ?, updated_at = ? WHERE id = ? AND connection_id = ? AND status IN ('pending', 'authorized')",
  ).bind(status, nowIso(), asText(body.eventId, 200), connection.id).run();
  if (!result.meta?.changes) throw new Error("The Codex event was already processed or could not be found");
  return helpers.json({ ok: true, eventId: body.eventId, status });
}

export async function handleCodexBridgeRequest(request, env, helpers) {
  const url = new URL(request.url);
  try {
    await ensureSchema(env);
    if (url.pathname === "/mcp/delivereeos" && request.method === "POST") return handleMcp(request, env, helpers);
    if (url.pathname === "/api/codex/connections/upsert" && request.method === "POST") return upsertConnection(request, env, helpers);
    if (url.pathname === "/api/codex/snapshot" && request.method === "POST") return saveSnapshot(request, env, helpers);
    if (url.pathname === "/api/codex/events" && request.method === "GET") return listEvents(request, env, helpers);
    if (url.pathname === "/api/codex/events/acknowledge" && request.method === "POST") return acknowledgeEvent(request, env, helpers);
    if (url.pathname === "/mcp/delivereeos" && request.method === "GET") {
      return helpers.json({ name: "Certo Work Delivery Bridge", protocol: "MCP Streamable HTTP", status: "ready" });
    }
    return null;
  } catch (error) {
    return helpers.json({ error: error instanceof Error ? error.message : "Codex bridge unavailable" }, 400);
  }
}
