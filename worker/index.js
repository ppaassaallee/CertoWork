import { handleCodexBridgeRequest } from "./codex-bridge.js";

/**
 * DelivereeOS production edge entry point for Codex Sites.
 *
 * The existing Express server remains available for local/legacy operation.
 * This adapter provides the production SPA shell and the conversation-first
 * API without requiring Google AI Studio or a long-running Node server.
 */

const FIREBASE_PROJECT_ID = "gen-lang-client-0277783597";
const FIREBASE_AUTH_ORIGIN = "https://gen-lang-client-0277783597.firebaseapp.com";
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_REQUEST_BYTES = 400_000;
const MAX_MESSAGES = 40;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });
}

function withSecurityHeaders(response) {
  const next = new Response(response.body, response);
  next.headers.set("x-content-type-options", "nosniff");
  next.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  next.headers.set("permissions-policy", "camera=(), geolocation=(), payment=()");
  next.headers.set("x-frame-options", "SAMEORIGIN");
  return next;
}

export function firebaseAuthProxyUrl(requestUrl) {
  const upstream = new URL(requestUrl);
  const firebaseOrigin = new URL(FIREBASE_AUTH_ORIGIN);
  upstream.protocol = firebaseOrigin.protocol;
  upstream.host = firebaseOrigin.host;
  return upstream.toString();
}

async function proxyFirebaseAuth(request) {
  const upstreamUrl = firebaseAuthProxyUrl(request.url);
  const upstreamResponse = await fetch(new Request(upstreamUrl, request), {
    redirect: "manual",
  });
  const response = new Response(upstreamResponse.body, upstreamResponse);
  const location = response.headers.get("location");
  if (location?.startsWith(FIREBASE_AUTH_ORIGIN)) {
    const publicOrigin = new URL(request.url).origin;
    response.headers.set("location", location.replace(FIREBASE_AUTH_ORIGIN, publicOrigin));
  }
  response.headers.set("cache-control", "no-store");
  return response;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function verifyFirebaseToken(token, expectedUserId, projectId) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed identity token");

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported identity token");
  }

  const jwksResponse = await fetch(FIREBASE_JWKS_URL, {
    cf: { cacheEverything: true, cacheTtl: 3600 },
  });
  if (!jwksResponse.ok) throw new Error("Identity key service unavailable");
  const jwks = await jwksResponse.json();
  const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new Error("Unknown identity signing key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error("Invalid identity signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || payload.iat > now + 60) throw new Error("Expired identity token");
  if (payload.aud !== projectId) throw new Error("Wrong identity audience");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Wrong identity issuer");
  }
  if (!payload.sub || payload.sub !== expectedUserId) {
    throw new Error("Identity does not match request");
  }
  return payload;
}

function platformIdentity(request) {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const nameEncoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  let name = "";
  if (encodedName && nameEncoding === "percent-encoded-utf-8") {
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      name = "";
    }
  }
  if (!id && !email) return null;
  return { id: id || email, email: email || "", name };
}

async function authorize(request, body, env) {
  const identity = platformIdentity(request);
  if (identity) {
    return { provider: "codex-sites", subject: identity.id, email: identity.email };
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Authentication required");
  }
  const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID;
  const payload = await verifyFirebaseToken(
    authorization.slice("Bearer ".length),
    body.userId || body.workspaceContext?.userId,
    projectId,
  );
  return { provider: "firebase", subject: payload.sub };
}

async function readJson(request) {
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_REQUEST_BYTES) {
    throw new Error("Request is too large");
  }
  const text = await request.text();
  if (text.length > MAX_REQUEST_BYTES) throw new Error("Request is too large");
  return JSON.parse(text || "{}");
}

function extractOpenAIText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return "";
}

function parseJsonObject(text) {
  const trimmed = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function tokenize(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function groundedCitations(query, workspaceContext) {
  const queryTokens = tokenize(query);
  const sources = [
    ["task", workspaceContext?.tasks],
    ["project", workspaceContext?.projects],
    ["milestone", workspaceContext?.milestones],
    ["risk", workspaceContext?.risks],
    ["goal", workspaceContext?.goals],
    ["calendar", workspaceContext?.events],
    ["document", workspaceContext?.documents],
  ];
  const ranked = [];

  if (workspaceContext?.activeProject?.id) {
    ranked.push({
      id: String(workspaceContext.activeProject.id),
      title: String(workspaceContext.activeProject.title || workspaceContext.activeProject.name || "Active project"),
      type: "project",
      score: 100,
    });
  }

  for (const [type, values] of sources) {
    for (const item of Array.isArray(values) ? values : []) {
      const title = item.title || item.name || "Untitled";
      const body = `${title} ${item.description || item.outcome || item.objective || ""} ${item.summary || ""} ${
        Array.isArray(item.excerpts) ? item.excerpts.map((excerpt) => excerpt?.excerpt || "").join(" ") : ""
      }`;
      const itemTokens = tokenize(body);
      let score = 0;
      for (const token of queryTokens) if (itemTokens.has(token)) score += 1;
      if (score > 0) {
        ranked.push({
          id: String(item.id || `${type}-${ranked.length + 1}`),
          title: String(title),
          type,
          score,
        });
      }
    }
  }

  const seen = new Set();
  return ranked
    .sort((left, right) => right.score - left.score)
    .filter((candidate) => {
      const key = `${candidate.type}:${candidate.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    .map(({ id, title, type }) => ({ id, title, type }));
}

function compactEvidence(citations, workspaceContext) {
  const allItems = [
    ...(workspaceContext?.tasks || []),
    ...(workspaceContext?.projects || []),
    ...(workspaceContext?.milestones || []),
    ...(workspaceContext?.risks || []),
    ...(workspaceContext?.goals || []),
    ...(workspaceContext?.events || []),
    ...(workspaceContext?.documents || []),
  ];
  return citations.map((citation) => {
    const item = allItems.find((candidate) => String(candidate.id) === citation.id);
    return {
      ...citation,
      status: item?.status,
      priority: item?.priority,
      dueDate: item?.dueDate,
      outcome: item?.outcome || item?.objective,
      start: item?.start,
      end: item?.end,
      summary: item?.summary,
      characterCount: item?.characterCount,
      excerpts: item?.excerpts,
    };
  });
}

export function assistantInstructions(body, citations) {
  const context = body.workspaceContext || {};
  const focusedDelivery = ["project_delivery", "focused_delivery"].includes(context.mode) &&
    ((context.contextProjects || []).length > 0 || (context.contextTasks || []).length > 0 || Boolean(context.activeProject?.id));
  const focusedLabel = context.activeProject?.title || context.activeProject?.name ||
    `${(context.contextProjects || []).length} project(s) and ${(context.contextTasks || []).length} selected task(s)`;
  const allowedProjectIds = [...new Set([
    ...(context.contextProjects || []).map((project) => project.id).filter(Boolean),
    context.activeProject?.id,
  ].filter(Boolean))];
  const operatingMode = focusedDelivery
    ? `FOCUSED DELIVERY MODE — embedded in ${focusedLabel}:
- Act as the practical project manager, engineer, delivery advisor, and assistant for the entities attached to this conversation. Help the team finish the work.
- Use only the attached projects, selected tasks, documents, risks, milestones, decisions, and this conversation. Never mention the user's global Today list, unrelated tasks, other projects, or portfolio overload unless the user explicitly asks to compare portfolios.
- Missing information is a completion checklist, not a refusal. Make a useful first pass now with clearly labeled assumptions, then ask at most one high-leverage question while work continues.
- Never respond with only a gate, lecture, or request to pause another project. A warning may change sequencing or be recorded as a risk, but it must not prevent a reversible draft or backlog slice.
- When given a large PRD or specification, extract a workable hierarchy: outcome, assumptions, phases or epics, milestones, requirement-linked work, risks, dependencies, owners, and acceptance evidence. Do not create hundreds of flat tasks. Propose the first coherent batch and say what the next batch will cover.
- For product or delivery backlogs, use one canonical work-item system through create_task actions. Set proposedChange.workItemType to "epic", "feature", "pbi", "story", "task", "bug", or "subtask". Features reference an epic; executable PBIs/stories/tasks/bugs reference a feature or epic; subtasks reference an executable parent. Include priority only when grounded (otherwise null), canonical status, owner or assignee when known, dueDate when real, requirement IDs, acceptance criteria, dependencies, and order.
- If exactly one project is attached and the user asks to add or save the pasted document, include a create_project_artifact action using sourceMessageId ${JSON.stringify(context.projectArtifactSourceMessageId || context.currentUserMessageId || "")} and projectId ${JSON.stringify(context.activeProject?.id || allowedProjectIds[0] || "")}. This source may be the most recent long user message when the current request refers to a previously pasted PRD. Do not copy the full source document into proposedChange.
- If the project record lacks an outcome or delivery metadata, propose update_project with a well-grounded draft instead of stopping. Mark inferred values as assumptions in the reply.
- Every proposed project action must carry one applicable projectId from ${JSON.stringify(allowedProjectIds)}. When several are attached, separate work by project rather than blending ownership. Use create_milestone for delivery gates and create_risk for material risks.`
    : `CHIEF OF STAFF MODE — general workspace conversation:
- Be the user's Chief of Staff, assistant, engineer, and advisor. You may inspect and manage any supplied workspace item while keeping the final decision with the user.
- Help the user choose across personal and cross-project commitments, coordinate work, and route clear handoffs to focused conversations.
- You may use global capacity, Today, weekly load, and portfolio work-in-progress to challenge a new commitment.
- Keep capacity warnings occasional, specific, and paired with a constructive alternative.
- To leave a handoff in another existing conversation, propose post_to_conversation with its exact targetConversationId from the conversation directory and concise content. Never invent a conversation ID.`;
  return `You are DelivereeOS, a calm conversational productivity partner. The entire product is one continuous conversation that helps a person or team turn thoughts into focused, credible action.

${operatingMode}

Product behavior:
- Help the user capture, clarify, choose, plan, and finish meaningful work.
- Organize work by when it needs attention: Today, This Week, Later, or a real calendar block.
- For a daily plan, use two must-dos, up to eight should-dos, and optional could-dos. Reduce the plan when capacity is tight.
- Protect core work from admin, meetings, and low-value activity. Prefer finishing over starting.
- Use projects as context for outcomes, tasks, decisions, owners, dependencies, risks, milestones, and delivery. When the user asks for team planning, support a lightweight Scrum backlog/sprint flow or PMI lifecycle without unnecessary ceremony.
- Stay concise, direct, calm, and useful. Lead with the answer or recommendation.
- When a project is active, keep the answer scoped to that project unless the user explicitly asks across all work.
- Use the supplied scoped records as the source of truth. When evidence is incomplete, state the exact assumption or missing field and continue with the useful parts that can be completed safely.
- Treat tasks as tasks, not issues. Keep every proposed task concrete: a clear verb, finish condition, owner when known, and realistic timing.
- Use only these priority values in proposed workspace changes: 1, 2, 3, or null for N/A. Do not use P1/P2/P3/P4.
- If the user asks for an email reminder, daily digest, daily summary, or weekly summary, prepare the request or draft as an outbox_communication action. Never claim an email was sent unless an email delivery integration is explicitly present in evidence.
- Never tell the user to open another module, dashboard, board, or page. Offer the next move in plain language.
- Use progressive disclosure. Do not flood the user with a long framework.
- In Chief of Staff mode, do not mention the total number of active projects unless the user asks, explicitly proposes starting another project, or a concrete recommendation directly depends on portfolio capacity. Do not repeat a workload warning already raised in the conversation.
- In Focused Delivery mode, every suggested chip must be a useful next move for the attached context. Never surface unrelated tasks or projects in chips.

Safety and judgment:
- Treat the deterministic judgment preflight as evidence. In Focused Delivery mode, informational gaps are guidance and assumptions, not blockers; only genuine safety, security, authorization, irreversible-action, or impossible-date conditions may stop execution.
- Distinguish what the user wants to hear from what they need to hear.
- The user retains override authority.
- You may propose actions, but never claim they were executed.
- Any workspace mutation must be returned as an actionPlan for explicit approval. Supported actions include create_project_artifact, update_project, create_milestone, update_milestone, create_risk, update_risk, create_task, update_task, and post_to_conversation. For updates, use the exact existing taskId, milestoneId, riskId, or projectId from evidence. For backlog work, use the existing task record with canonical workItemType and hierarchy fields; never invent a second task system.
- Never claim an external integration exists unless it is present in the supplied evidence.
- Do not mention Google AI Studio, Gemini, Gazelle, HubSpot, or pretend to have contacted anyone.

Active conversational context:
${JSON.stringify({
  project: context.activeProject || null,
  contextProjects: context.contextProjects || [],
  contextTasks: context.contextTasks || [],
  conversationType: context.conversationType || null,
  todayTaskCount: context.todayTaskCount || 0,
  pendingReviewCount: context.pendingReviewCount || 0,
  currentUserMessageId: context.currentUserMessageId || null,
  projectArtifactSourceMessageId: context.projectArtifactSourceMessageId || null,
  operatingMode: focusedDelivery ? "focused_delivery" : "chief_of_staff",
})}

Conversation directory for approved handoffs:
${JSON.stringify(context.conversationDirectory || [])}

Current deterministic judgment:
${JSON.stringify(context.judgment || { verdict: "not_run", signals: [] })}

Workspace load:
${JSON.stringify({
  scope: focusedDelivery ? "attached_entities_only" : "workspace",
  openTasksInScope: Array.isArray(context.tasks) ? context.tasks.length : 0,
  projectsInScope: Array.isArray(context.projects) ? context.projects.length : 0,
  milestonesInScope: Array.isArray(context.milestones) ? context.milestones.length : 0,
  risksInScope: Array.isArray(context.risks) ? context.risks.length : 0,
  projectDocuments: Array.isArray(context.documents) ? context.documents.length : 0,
  goals: Array.isArray(context.goals) ? context.goals.length : 0,
  calendarEvents: Array.isArray(context.events) ? context.events.length : 0,
})}

Grounded evidence:
${JSON.stringify(compactEvidence(citations, context))}

Return one valid JSON object and no Markdown fence:
{
  "reply": "A concise, useful answer. Markdown inside this string is allowed.",
  "toolName": "productivity_orchestrator",
  "actionPlan": {
    "title": "string",
    "summary": "string",
    "riskLevel": "low | medium | high",
    "safetyLevel": 1,
    "proposedActions": [{
      "type": "create_task | reschedule_task | update_task | create_decision | create_followup | kill_or_archive | create_project | update_project | create_project_artifact | create_milestone | update_milestone | create_risk | update_risk | post_to_conversation | outbox_communication",
      "proposedChange": {},
      "reason": "string",
      "safetyLevel": 1,
      "confidence": 0.9
    }]
  },
  "suggestedChips": ["two to four short contextual next prompts"],
  "citations": [{"id": "string", "title": "string", "type": "string"}]
}
Omit actionPlan when no action is being proposed. Use only supplied citation IDs.`;
}

export function normalizeConversationMessages(messages) {
  const selected = Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
  let latestUserIndex = -1;
  let latestLongUserIndex = -1;
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    if (selected[index]?.role !== "assistant") {
      if (latestUserIndex === -1) latestUserIndex = index;
      if (latestLongUserIndex === -1 && String(selected[index]?.content || "").length > 20_000) {
        latestLongUserIndex = index;
      }
      if (latestUserIndex !== -1 && latestLongUserIndex !== -1) break;
    }
  }
  return selected.map((message, index) => ({
    role: message?.role === "assistant" ? "assistant" : "user",
    content: String(message?.content || "").slice(
      0,
      index === latestUserIndex || index === latestLongUserIndex ? 160_000 : 16_000,
    ),
  }));
}

const GENERIC_PROJECT_TITLES = new Set([
  "create a project",
  "crear un proyecto",
  "new project",
  "nuevo proyecto",
  "project",
  "proyecto",
  "set up a project",
  "help me create a project",
]);

function sanitizeProjectTitleCandidate(value) {
  const cleaned = String(value || "")
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+(?:and|with|para|por|con|so|that|where|que)\s+.*$/i, "")
    .replace(/[.?!,;:]+$/g, "")
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 90) return "";
  if (GENERIC_PROJECT_TITLES.has(cleaned.toLowerCase())) return "";
  return cleaned;
}

export function inferProjectTitleFromRequest(text = "") {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  const patterns = [
    /(?:project|proyecto)\s+(?:called|named|name[d]?|llamado|llamada|que se llame|con nombre)\s+["“'‘]?([^"”'’.;!?]+)/i,
    /(?:create|crear|build|hacer|set up|setup|start|iniciar)\s+(?:a\s+|un\s+|una\s+)?(?:new\s+|nuevo\s+|nueva\s+)?(?:project|proyecto)\s+(?:for|para|about|sobre|de)\s+["“'‘]?([^"”'’.;!?]+)/i,
    /(?:project|proyecto)\s*[:\-]\s*["“'‘]?([^"”'’.;!?]+)/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const title = sanitizeProjectTitleCandidate(match?.[1]);
    if (title) return title;
  }
  return "";
}

function normalizePriority(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (["1", "P1", "HIGH", "URGENT", "CRITICAL"].includes(normalized)) return "1";
  if (["2", "P2", "MEDIUM"].includes(normalized)) return "2";
  if (["3", "P3", "LOW"].includes(normalized)) return "3";
  return null;
}

function normalizeActionProposedChange(action, latestUserMessage) {
  const proposedChange = { ...(action?.proposedChange || {}) };
  if (Object.prototype.hasOwnProperty.call(proposedChange, "priority")) {
    proposedChange.priority = normalizePriority(proposedChange.priority);
  }
  if (String(action?.type || "") === "create_project") {
    const currentTitle = sanitizeProjectTitleCandidate(proposedChange.title || proposedChange.name);
    const inferredTitle = inferProjectTitleFromRequest(latestUserMessage);
    const title = currentTitle || inferredTitle;
    if (title) {
      proposedChange.title = title;
      proposedChange.name = title;
    }
  }
  return proposedChange;
}

function normalizeAssistantResult(result, citations, model, latestUserMessage = "") {
  if (!result || typeof result.reply !== "string" || !result.reply.trim()) {
    throw new Error("OpenAI returned an invalid assistant response");
  }
  const normalized = {
    reply: result.reply.trim(),
    toolName: typeof result.toolName === "string" ? result.toolName : "productivity_orchestrator",
    suggestedChips: Array.isArray(result.suggestedChips)
      ? result.suggestedChips.slice(0, 4).map(String)
      : [],
    citations,
    provider: { provider: "openai", model },
  };

  if (result.actionPlan && Array.isArray(result.actionPlan.proposedActions)) {
    normalized.actionPlan = {
      title: String(result.actionPlan.title || "Proposed action plan"),
      summary: String(result.actionPlan.summary || "Review these proposed changes before approval."),
      riskLevel: ["low", "medium", "high"].includes(result.actionPlan.riskLevel)
        ? result.actionPlan.riskLevel
        : "medium",
      safetyLevel: Math.max(1, Math.min(5, Number(result.actionPlan.safetyLevel) || 1)),
      proposedActions: result.actionPlan.proposedActions.slice(0, 24).map((action) => {
        const type = String(action.type || "create_task");
        return {
          type,
          proposedChange: normalizeActionProposedChange({ ...action, type }, latestUserMessage),
          reason: String(action.reason || "Requested by the user"),
          safetyLevel: Math.max(1, Math.min(5, Number(action.safetyLevel) || 1)),
          confidence: Math.max(0, Math.min(1, Number(action.confidence) || 0.7)),
        };
      }),
    };
  }
  return normalized;
}

async function chat(request, env) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }

  const userId = body.userId || body.workspaceContext?.userId;
  const workspaceId = body.workspaceId || body.workspaceContext?.workspaceId;
  if (!userId || !workspaceId) {
    return json({ error: "userId and workspaceId are required" }, 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "At least one message is required" }, 400);
  }
  body.messages = normalizeConversationMessages(body.messages);

  try {
    await authorize(request, body, env);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Authentication failed" },
      401,
    );
  }

  if (!env.OPENAI_API_KEY) {
    return json(
      {
        error:
          "OpenAI is not configured for this DelivereeOS deployment yet.",
        code: "OPENAI_NOT_CONFIGURED",
      },
      503,
    );
  }

  const latestUserMessage =
    [...body.messages].reverse().find((message) => message.role === "user")?.content || "";
  const citations = groundedCitations(latestUserMessage, body.workspaceContext);
  const model = env.OPENAI_MODEL || "gpt-5.6-sol";

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: assistantInstructions(body, citations),
        input: [
          {
            role: "user",
            content:
              "DelivereeOS response contract: return exactly one valid JSON object matching the provided instructions.",
          },
          ...body.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        text: { format: { type: "json_object" } },
        store: false,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
      return json({ error: message, code: "OPENAI_REQUEST_FAILED" }, 502);
    }
    const result = parseJsonObject(extractOpenAIText(payload));
    return json(normalizeAssistantResult(result, citations, model, latestUserMessage));
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The assistant is temporarily unavailable",
        code: "ASSISTANT_UNAVAILABLE",
      },
      502,
    );
  }
}

function capabilities(env) {
  const openAIConfigured = Boolean(env.OPENAI_API_KEY);
  return {
    openai: {
      configured: openAIConfigured,
      description: openAIConfigured
        ? `OpenAI is active through ${env.OPENAI_MODEL || "gpt-5.6-sol"}.`
        : "Add OPENAI_API_KEY in Codex Sites to activate AI responses.",
    },
    gemini: {
      configured: false,
      description: "Google AI Studio is not used by this deployment.",
    },
    activeAIProvider: {
      configured: openAIConfigured,
      description: openAIConfigured ? "OpenAI" : "Offline-safe deterministic mode",
    },
    firebase: {
      configured: true,
      description: "Existing Firebase authentication, data, routes, and IDs are preserved.",
    },
    hubspot: {
      configured: false,
      description: "No live HubSpot connection is configured.",
    },
    googleDrive: {
      configured: false,
      description: "No live Google Drive connection is configured.",
    },
  };
}

async function serveAsset(request, env) {
  const url = new URL(request.url);
  const wantsHtml =
    request.method === "GET" &&
    (request.headers.get("accept") || "").includes("text/html");
  const lastPathSegment = url.pathname.split("/").pop() || "";
  const isClientRoute = wantsHtml && !lastPathSegment.includes(".");

  if (isClientRoute) {
    const indexUrl = new URL("/?gazelle-spa=1", request.url);
    const response = withSecurityHeaders(
      await env.ASSETS.fetch(new Request(indexUrl, request)),
    );
    response.headers.set("cache-control", "no-store, max-age=0");
    return response;
  }

  let response = await env.ASSETS.fetch(request);
  if (
    response.status === 404 &&
    wantsHtml
  ) {
    const indexUrl = new URL("/?gazelle-spa=1", request.url);
    response = await env.ASSETS.fetch(new Request(indexUrl, request));
  }
  return withSecurityHeaders(response);
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/__/auth/")) {
      return proxyFirebaseAuth(request);
    }

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": url.origin,
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type",
          "access-control-max-age": "86400",
        },
      });
    }

    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      return json({
        ok: true,
    service: "delivereeos-codex-sites",
        aiProvider: env.OPENAI_API_KEY ? "openai" : "offline-safe",
      });
    }
    if (request.method === "GET" && url.pathname === "/api/capabilities") {
      return json(capabilities(env));
    }
    if (request.method === "GET" && url.pathname === "/api/session") {
      const identity = platformIdentity(request);
      if (!identity) return json({ authenticated: false }, 401);
      return json({ authenticated: true, provider: "codex-sites", user: identity });
    }
    if (request.method === "POST" && url.pathname === "/api/boldi/chat") {
      return chat(request, env);
    }
    if (url.pathname === "/mcp/delivereeos" || url.pathname.startsWith("/api/codex/")) {
      const response = await handleCodexBridgeRequest(request, env, {
        firebaseProjectId: FIREBASE_PROJECT_ID,
        json,
        platformIdentity,
        readJson,
        verifyFirebaseToken,
      });
      if (response) return response;
    }
    if (url.pathname.startsWith("/api/")) {
      return json(
        {
          error: "This legacy server capability is not enabled in the Codex Sites runtime.",
          code: "LEGACY_CAPABILITY_UNAVAILABLE",
        },
        503,
      );
    }

    return serveAsset(request, env);
  },
};

export default worker;
