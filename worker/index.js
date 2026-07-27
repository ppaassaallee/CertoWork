/**
 * Gazelle production edge entry point for Codex Sites.
 *
 * The existing Express server remains available for local/legacy operation.
 * This adapter provides the production SPA shell and the conversation-first
 * API without requiring Google AI Studio or a long-running Node server.
 */

const FIREBASE_PROJECT_ID = "gen-lang-client-0277783597";
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

async function authorize(request, body, env) {
  const platformEmail = request.headers.get("oai-authenticated-user-email");
  if (platformEmail) {
    return { provider: "codex-sites", subject: platformEmail };
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
    ["goal", workspaceContext?.goals],
    ["calendar", workspaceContext?.events],
  ];
  const ranked = [];

  for (const [type, values] of sources) {
    for (const item of Array.isArray(values) ? values : []) {
      const title = item.title || item.name || "Untitled";
      const body = `${title} ${item.description || item.outcome || item.objective || ""}`;
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

  return ranked
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map(({ score: _score, ...citation }) => citation);
}

function compactEvidence(citations, workspaceContext) {
  const allItems = [
    ...(workspaceContext?.tasks || []),
    ...(workspaceContext?.projects || []),
    ...(workspaceContext?.goals || []),
    ...(workspaceContext?.events || []),
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
    };
  });
}

function assistantInstructions(body, citations) {
  const context = body.workspaceContext || {};
  return `You are Gazelle's accountable Chief of Staff: concise, practical, warm, and willing to challenge overload.

Operating system:
- Use COD: Collect, Organize, Do.
- Organize work by time horizon and protect Core Work.
- Daily planning uses 2 Must Dos, up to 8 Should Dos, then optional Could Dos.
- Weekly planning is forward-looking: theme, top 3 objectives, core work, projects, personal life, radar, risks, not-this-week, and first actions.
- Respect calendar reality, buffers, sleep, recovery, and work-in-progress limits.

Safety and judgment:
- Treat the deterministic judgment preflight as evidence. Never hide blocking or warning signals.
- Distinguish what the user wants to hear from what they need to hear.
- The user retains override authority.
- You may propose actions, but never claim they were executed.
- Any mutation must be returned as an actionPlan for explicit approval and must be reversible where possible.
- Never claim an external integration exists unless it is present in the supplied evidence.
- Do not mention Google AI Studio, Gemini, HubSpot, or pretend to have contacted anyone.

Current deterministic judgment:
${JSON.stringify(context.judgment || { verdict: "not_run", signals: [] })}

Workspace load:
${JSON.stringify({
  openTasks: Array.isArray(context.tasks) ? context.tasks.length : 0,
  activeProjects: Array.isArray(context.projects) ? context.projects.length : 0,
  goals: Array.isArray(context.goals) ? context.goals.length : 0,
  calendarEvents: Array.isArray(context.events) ? context.events.length : 0,
})}

Grounded evidence:
${JSON.stringify(compactEvidence(citations, context))}

Return one valid JSON object and no Markdown fence:
{
  "reply": "A concise, useful answer. Markdown inside this string is allowed.",
  "toolName": "optional bounded agent or tool name",
  "actionPlan": {
    "title": "string",
    "summary": "string",
    "riskLevel": "low | medium | high",
    "safetyLevel": 1,
    "proposedActions": [{
      "type": "create_task | reschedule_task | update_task | create_decision | create_followup | kill_or_archive | create_project | outbox_communication",
      "proposedChange": {},
      "reason": "string",
      "safetyLevel": 1,
      "confidence": 0.9
    }]
  },
  "suggestedChips": ["exactly four short contextual next prompts"],
  "citations": [{"id": "string", "title": "string", "type": "string"}]
}
Omit actionPlan when no action is being proposed. Use only supplied citation IDs.`;
}

function normalizeAssistantResult(result, citations, model) {
  if (!result || typeof result.reply !== "string" || !result.reply.trim()) {
    throw new Error("OpenAI returned an invalid assistant response");
  }
  const normalized = {
    reply: result.reply.trim(),
    toolName: typeof result.toolName === "string" ? result.toolName : "chief_of_staff_orchestrator",
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
      proposedActions: result.actionPlan.proposedActions.slice(0, 12).map((action) => ({
        type: String(action.type || "create_task"),
        proposedChange: action.proposedChange || {},
        reason: String(action.reason || "Requested by the user"),
        safetyLevel: Math.max(1, Math.min(5, Number(action.safetyLevel) || 1)),
        confidence: Math.max(0, Math.min(1, Number(action.confidence) || 0.7)),
      })),
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
  body.messages = body.messages.slice(-MAX_MESSAGES).map((message) => ({
    role: message?.role === "assistant" ? "assistant" : "user",
    content: String(message?.content || "").slice(0, 20_000),
  }));

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
          "OpenAI is not configured yet. Gazelle preserved your capture and switched to offline-safe judgment.",
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
        input: body.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
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
    return json(normalizeAssistantResult(result, citations, model));
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
    return withSecurityHeaders(
      await env.ASSETS.fetch(new Request(indexUrl, request)),
    );
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
        service: "gazelle-codex-sites",
        aiProvider: env.OPENAI_API_KEY ? "openai" : "offline-safe",
      });
    }
    if (request.method === "GET" && url.pathname === "/api/capabilities") {
      return json(capabilities(env));
    }
    if (request.method === "POST" && url.pathname === "/api/boldi/chat") {
      return chat(request, env);
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
