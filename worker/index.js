import { handleCodexBridgeRequest } from "./codex-bridge.js";
import { runOdysseusAgent } from "./odiseus-agent.js";
import { hermesRuntimeEnabled, tryHermesChat } from "./runtime/hermesBridge.js";
import {
  collabStatusPayload,
  isChatwootProxyPath,
  isCertoCollabBrandPath,
  provisionCollabSso,
  proxyChatwoot,
} from "./collab.js";
import { createCaptureRequestsHandlers } from "./captureRequests.js";

/**
 * Certo Work production edge entry point for Cloudflare-compatible Workers.
 *
 * The existing Express server remains available for local/legacy operation.
 * This adapter provides the production SPA shell and the conversation-first
 * API without requiring Google AI Studio or a long-running Node server.
 */

const FIREBASE_PROJECT_ID = "gen-lang-client-0277783597";
const FIREBASE_AUTH_ORIGIN = "https://gen-lang-client-0277783597.firebaseapp.com";
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const FIRESTORE_DATABASE_ID = "ai-studio-0db18e51-58a2-4763-a4d7-3fced116347d";
const FIREBASE_WEB_API_KEY = "AIzaSyDa-1rva5k-ky_f6L4A6lenqz8cBUP6Hn4";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const BREVO_TRANSACTIONAL_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";
const MAX_REQUEST_BYTES = 400_000;
const MAX_AUDIO_BYTES = 4_000_000;
const DEFAULT_EFFICIENT_MODEL = "gpt-5.6-luna";
const DEFAULT_BALANCED_MODEL = "gpt-5.6-luna";
const DEFAULT_HEAVY_MODEL = "gpt-5.6-luna";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const MAX_MESSAGES = 10;
const MAX_CHAT_OUTPUT_TOKENS = 550;
const MAX_REWRITE_OUTPUT_TOKENS = 280;

export function openaiApiKey(env = {}) {
  return String(env.OPENAI_API_KEY || env.OPENAI_KEY || "").trim();
}

export function openaiModelName(env = {}) {
  return String(env.OPENAI_MODEL || env.AI_MODEL || DEFAULT_EFFICIENT_MODEL).trim() || DEFAULT_EFFICIENT_MODEL;
}

export function requestedAiProvider(env = {}) {
  return String(env.AI_PROVIDER || env.BOLDI_AI_PROVIDER || "openai").trim().toLowerCase() || "openai";
}

export function openaiIsConfigured(env = {}) {
  return Boolean(openaiApiKey(env)) && requestedAiProvider(env) !== "none";
}

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

export function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if (value.stringValue != null) return value.stringValue;
  if (value.integerValue != null) return Number(value.integerValue);
  if (value.doubleValue != null) return value.doubleValue;
  if (value.booleanValue != null) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue) return value.timestampValue;
  if (value.mapValue?.fields) return decodeFirestoreDocument(value.mapValue.fields);
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  return null;
}

export function decodeFirestoreDocument(fields = {}) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = decodeFirestoreValue(value);
  }
  return result;
}

function asWidgetTasks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const title = String(item.title || "Untitled").trim() || "Untitled";
      const task = {
        id: String(item.id || title),
        title,
      };
      const project = String(item.project || "").trim();
      if (project) task.project = project;
      return task;
    });
}

export function normalizeAppleWidgetSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    workspaceName: String(raw.workspaceName || "Certo Work").slice(0, 80),
    dateLabel: String(raw.dateLabel || "Today"),
    dateKey: String(raw.dateKey || ""),
    mustDos: asWidgetTasks(raw.mustDos).slice(0, 2),
    shouldDos: asWidgetTasks(raw.shouldDos).slice(0, 8),
    pendingApprovals: Math.max(0, Number(raw.pendingApprovals) || 0),
    odysseusLine: String(raw.odysseusLine || ""),
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

export async function loadAppleWidgetSnapshot(token, env = {}) {
  const clean = String(token || "").trim();
  if (!/^[a-zA-Z0-9]{16,80}$/.test(clean)) return null;
  const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID;
  const databaseId = env.FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID;
  const apiKey = env.FIREBASE_WEB_API_KEY || FIREBASE_WEB_API_KEY;
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents/widget_tokens/${encodeURIComponent(clean)}?key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json();
  const data = decodeFirestoreDocument(payload.fields || {});
  if (!data || data.revoked === true || data.token !== clean) return null;
  return normalizeAppleWidgetSnapshot(data.snapshot);
}

export async function transcribeVoice(request, env = {}) {
  if (!openaiIsConfigured(env)) {
    return json(
      { error: "Voice transcription is not configured.", code: "OPENAI_NOT_CONFIGURED" },
      503,
    );
  }
  const identity = platformIdentity(request);
  if (!identity) {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Audio is required" }, 400);
  }
  const userId = String(form.get("userId") || "");
  const file = form.get("file");
  if (!identity) {
    const authorization = request.headers.get("authorization") || "";
    try {
      await verifyFirebaseToken(
        authorization.slice("Bearer ".length),
        userId,
        env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID,
      );
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Authentication failed" },
        401,
      );
    }
  }
  if (!file || typeof file === "string") return json({ error: "Audio is required" }, 400);
  const size = Number(file.size || 0);
  if (size < 80) return json({ text: "" });
  if (size > MAX_AUDIO_BYTES) return json({ error: "Recording is too large" }, 413);
  const openaiForm = new FormData();
  openaiForm.append("file", file, file.name || "speech.webm");
  openaiForm.append("model", env.OPENAI_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL);
  openaiForm.append("response_format", "json");
  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${openaiApiKey(env)}` },
    body: openaiForm,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json(
      { error: payload?.error?.message || "The recording could not be transcribed." },
      502,
    );
  }
  return json({ text: String(payload.text || "").trim() });
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

export function rewriteFirebaseAuthLocation(location, requestUrl) {
  if (!location) return location;
  const publicOrigin = new URL(requestUrl).origin;
  try {
    const next = new URL(location, publicOrigin);
    if (next.hostname.endsWith(".firebaseapp.com") || next.hostname.endsWith(".web.app")) {
      return `${publicOrigin}${next.pathname}${next.search}${next.hash}`;
    }
  } catch {
    // Keep the original header if it is not a valid URL.
  }
  if (location.startsWith(FIREBASE_AUTH_ORIGIN)) {
    return location.replace(FIREBASE_AUTH_ORIGIN, publicOrigin);
  }
  return location;
}

async function proxyFirebaseAuth(request) {
  const upstreamUrl = firebaseAuthProxyUrl(request.url);
  const upstreamResponse = await fetch(new Request(upstreamUrl, request), {
    redirect: "manual",
  });
  const response = new Response(upstreamResponse.body, upstreamResponse);
  const location = response.headers.get("location");
  if (location) {
    response.headers.set("location", rewriteFirebaseAuthLocation(location, request.url));
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

function numberFromEnv(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function aiModelFor(env, body = {}, feature = "chat") {
  const requestedMode = String(body.aiMode || body.mode || "").toLowerCase();
  if (requestedMode === "heavy" || requestedMode === "deep") {
    return env.OPENAI_HEAVY_MODEL || DEFAULT_HEAVY_MODEL;
  }
  if (requestedMode === "balanced" || feature === "project_planning") {
    return env.OPENAI_BALANCED_MODEL || DEFAULT_BALANCED_MODEL;
  }
  return env.OPENAI_EFFICIENT_MODEL || env.OPENAI_MODEL || DEFAULT_EFFICIENT_MODEL;
}

function openAIUsage(payload) {
  const usage = payload?.usage || {};
  const inputTokens = Number(usage.input_tokens || usage.prompt_tokens || 0) || 0;
  const outputTokens = Number(usage.output_tokens || usage.completion_tokens || 0) || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: Number(usage.total_tokens || inputTokens + outputTokens) || 0,
  };
}

function logAIUsage({ env, body, feature, model, usage }) {
  const sampleRate = numberFromEnv(env.AI_USAGE_LOG_SAMPLE_RATE, 1, 0, 1);
  if (sampleRate <= 0 || Math.random() > sampleRate) return;
  console.log(
    JSON.stringify({
      event: "certo_ai_usage",
      feature,
      model,
      workspaceId: body.workspaceId || body.workspaceContext?.workspaceId || null,
      userId: body.userId || body.workspaceContext?.userId || null,
      conversationId: body.conversationId || null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      timestamp: new Date().toISOString(),
    }),
  );
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
    ["measure", workspaceContext?.strategicMeasures],
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
    ...(workspaceContext?.strategicMeasures || []),
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
    : `ODISEUS MODE — personal Home conversation for this user:
- You are Odysseus, this user's personal AI employee inside Certo Work — not a shared workspace bot. Memory, notes, and Home context belong only to this user.
- Treat supplied tasks, notebooks, and durable memory as this person's work. Do not assume another teammate's assignments or preferences.
- Workspace radar is compact portfolio health only (id, title, health, due). It is not permission to quote other people's task details.
- Help the user choose across their commitments, coordinate work they own or are assigned, and route clear handoffs to focused conversations.
- You may use this user's Today list, weekly load, and the compact radar to challenge a new commitment.
- Keep capacity warnings occasional, specific, and paired with a constructive alternative.
- To leave a handoff in another existing conversation owned by this user, propose post_to_conversation with its exact targetConversationId from the conversation directory and concise content. Never invent a conversation ID.`;
  return `You are Odysseus, Certo Work's AI employee. Not a tool — a hire. The product is one continuous workspace conversation that helps a person or team turn thoughts into focused, credible action. You propose the next step and ask before anything you cannot undo.

${operatingMode}

Product behavior:
- Help the user capture, clarify, choose, plan, and finish meaningful work.
- Prefer tool calls (search_projects, get_overdue_items, get_activity_summary, list_project_items, get_project, propose_followups, prepare_status_report) before guessing from memory.
- After tools, return a concise outcome: what you found, what changed or what needs approval, and any artifact/next decision.
- Organize work by when it needs attention: Today, This Week, Later, or a real calendar block.
- For a daily plan, use two must-dos, up to eight should-dos, and optional could-dos. Reduce the plan when capacity is tight.
- Protect core work from admin, meetings, and low-value activity. Prefer finishing over starting.
${context.voiceWrapUp ? `- VOICE WRAP-UP: the live conversation ended. You were a quiet note-taker. Read the transcript carefully. Recap what you heard in 2-4 spoken sentences, say if anything sounded incomplete, then put every concrete next action in actionPlan as create_task (or update_task when it clearly matches an existing task). Set timeSector to today, this-week, or later. No markdown. Do not interview. At most one clarifying question if a required fact is missing for every item. Never claim tasks were already created.` : context.voiceSession ? `- VOICE CONVERSATION: you are a quiet assistant taking notes. Listen. Do not interview. Speak at most one short sentence. Do not ask questions unless a single missing fact blocks every next action. Do not return an actionPlan until wrap-up unless the user explicitly asks to apply now.` : ""}
- Use projects as context for outcomes, tasks, decisions, owners, dependencies, risks, milestones, and delivery. When the user asks for team planning, support a lightweight Scrum backlog/sprint flow or PMI lifecycle without unnecessary ceremony.
- When strategic goals and measures are supplied, distinguish the Objective (direction), outcome measures (measurable results), lead measures (predictive actions the team can influence), and weekly commitments. A linked Project, Epic, or PBI may serve as execution evidence or a lead measure, but do not confuse activity completion with a business outcome.
- Treat Gems as recognition backed by the supplied audit ledger. Never invent a balance, prize, Boost, or redemption and never recommend gaming the system with low-value activity.
- When workspace members or teams are supplied, use them for ownership suggestions and collaboration planning. Prefer assigning by real person/team from evidence; if unknown, mark owner as null or "Unassigned" rather than inventing a teammate.
- Stay concise, direct, calm, and useful. Lead with the answer or recommendation.
- When a project is active, keep the answer scoped to that project unless the user explicitly asks across all work.
- Use the supplied scoped records as the source of truth. When evidence is incomplete, state the exact assumption or missing field and continue with the useful parts that can be completed safely.
- Treat tasks as tasks, not issues. Keep every proposed task concrete: a clear verb, finish condition, owner when known, and realistic timing.
- Use only these priority values in proposed workspace changes: 1, 2, 3, or null for N/A. Do not use P1/P2/P3/P4.
- If the user asks for an email reminder, daily digest, daily summary, or weekly summary, prepare the request or draft as an outbox_communication action. Never claim an email was sent unless an email delivery integration is explicitly present in evidence.
- Never tell the user to open another module, dashboard, board, or page. Offer the next move in plain language.
- Use progressive disclosure. Do not flood the user with a long framework.
- In Odysseus mode, do not mention the total number of active projects unless the user asks, explicitly proposes starting another project, or a concrete recommendation directly depends on portfolio capacity. Do not repeat a workload warning already raised in the conversation.
- In Focused Delivery mode, every suggested chip must be a useful next move for the attached context. Never surface unrelated tasks or projects in chips.

Safety and judgment:
- Treat the deterministic judgment preflight as evidence. In Focused Delivery mode, informational gaps are guidance and assumptions, not blockers; only genuine safety, security, authorization, irreversible-action, or impossible-date conditions may stop execution.
- Distinguish what the user wants to hear from what they need to hear.
- The user retains override authority.
- You may propose actions, but never claim they were executed.
- Any workspace mutation must be returned as an actionPlan for explicit approval. Supported actions include create_project_artifact, update_project, create_milestone, update_milestone, create_risk, update_risk, create_task, update_task, and post_to_conversation. For updates, use the exact existing taskId, milestoneId, riskId, or projectId from evidence. For backlog work, use the existing task record with canonical workItemType and hierarchy fields; never invent a second task system.
- Never claim an external integration exists unless it is present in the supplied evidence.
- Do not mention Google AI Studio, Gemini, HubSpot, or pretend to have contacted anyone.

Active conversational context:
${JSON.stringify({
  project: context.activeProject || null,
  contextProjects: context.contextProjects || [],
  contextTasks: context.contextTasks || [],
  conversationType: context.conversationType || null,
  todayTaskCount: context.todayTaskCount || 0,
  pendingReviewCount: context.pendingReviewCount || 0,
  workspaceMembers: context.workspaceMembers || [],
  workspaceTeams: context.workspaceTeams || [],
  strategicGoals: context.goals || [],
  strategicMeasures: context.strategicMeasures || [],
  strategyPulse: context.strategyPulse || [],
  currentUserMessageId: context.currentUserMessageId || null,
  projectArtifactSourceMessageId: context.projectArtifactSourceMessageId || null,
  operatingMode: focusedDelivery ? "focused_delivery" : "personal_home",
  privacyScope: context.privacyScope || (focusedDelivery ? "focused_delivery" : "personal_home"),
  currentUserId: context.userId || body.userId || null,
  currentMemberId: context.currentMemberId || null,
  workspaceRadar: context.workspaceRadar || [],
})}

Conversation directory for approved handoffs:
${JSON.stringify(context.conversationDirectory || [])}

Current deterministic judgment:
${JSON.stringify(context.judgment || { verdict: "not_run", signals: [] })}

Workspace load:
${JSON.stringify({
  scope: focusedDelivery ? "attached_entities_only" : "personal_home",
  openTasksInScope: Array.isArray(context.tasks) ? context.tasks.length : 0,
  projectsInScope: Array.isArray(context.projects) ? context.projects.length : 0,
  milestonesInScope: Array.isArray(context.milestones) ? context.milestones.length : 0,
  risksInScope: Array.isArray(context.risks) ? context.risks.length : 0,
  projectDocuments: Array.isArray(context.documents) ? context.documents.length : 0,
  goals: Array.isArray(context.goals) ? context.goals.length : 0,
  strategicMeasures: Array.isArray(context.strategicMeasures) ? context.strategicMeasures.length : 0,
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
      index === latestUserIndex || index === latestLongUserIndex ? 40_000 : 3_000,
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
    /(?:project|proyecto)\s*[:-]\s*["“'‘]?([^"”'’.;!?]+)/i,
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

function normalizeAssistantResult(result, citations, model, latestUserMessage = "", usage = null) {
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
    provider: {
      provider: "openai",
      model,
      usage: usage || undefined,
      costMode: model === DEFAULT_HEAVY_MODEL ? "heavy" : "efficient",
    },
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

export function rewriteInstructions(fieldKind, context = {}) {
  const rules = {
    objective_title:
      "Write one memorable strategic outcome in plain language. Keep it under 180 characters and do not turn it into a task list.",
    objective_description:
      "Clarify why the objective matters, the intended change, and the strategic boundary in one short paragraph.",
    measure_title:
      "Write one precise measurable result or influenceable lead measure. Preserve every supplied number and unit.",
    work_item_title:
      "Write a concise delivery title beginning with a strong action verb. Keep the original scope and under 160 characters.",
    work_item_description:
      "Write a practical delivery description with context, expected result, and finish condition. Keep it concise.",
    project_outcome:
      "Write one clear project outcome that describes the future state and how the team will recognize success.",
    project_description:
      "Write a concise project description covering purpose, scope, users or stakeholders, and delivery boundary.",
  };
  return `You are Certo Work's inline writing assistant. Improve only the supplied field.

Non-negotiable rules:
- Preserve the source language unless the user clearly mixes languages intentionally.
- Preserve all facts, names, dates, amounts, metrics, commitments and scope.
- Never invent missing details, owners, deadlines, targets, benefits or evidence.
- Remove filler, ambiguity and repetition. Use direct, professional language.
- Return exactly one JSON object with one key: {"text":"improved text"}.
- Do not explain the rewrite and do not use Markdown.

Field requirement:
${rules[fieldKind] || rules.project_description}

Relevant context (use only to disambiguate, never to add new claims):
${JSON.stringify(context)}`;
}

async function rewriteField(request, env) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
  if (!body.userId || !body.workspaceId) {
    return json({ error: "userId and workspaceId are required" }, 400);
  }
  const source = String(body.text || "").trim();
  if (!source) return json({ error: "Text is required" }, 400);
  if (source.length > 12_000) return json({ error: "Text is too long to rewrite inline" }, 400);
  try {
    await authorize(request, body, env);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Authentication failed" }, 401);
  }
  if (!openaiIsConfigured(env)) {
    return json({ error: "Certo Work SAFE MODE. OpenAI is not configured for this Certo Work deployment yet.", code: "OPENAI_NOT_CONFIGURED", safeMode: true }, 503);
  }
  const model = aiModelFor(env, body, "rewrite");
  const maxOutputTokens = numberFromEnv(
    env.OPENAI_REWRITE_MAX_OUTPUT_TOKENS || env.OPENAI_MAX_OUTPUT_TOKENS,
    MAX_REWRITE_OUTPUT_TOKENS,
    120,
    1_200,
  );
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${openaiApiKey(env)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: rewriteInstructions(String(body.fieldKind || "project_description"), body.context || {}),
        input: [{ role: "user", content: source }],
        text: { format: { type: "json_object" } },
        max_output_tokens: maxOutputTokens,
        store: false,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      return json({ error: payload?.error?.message || `OpenAI request failed (${response.status})`, code: "OPENAI_REQUEST_FAILED" }, 502);
    }
    const result = parseJsonObject(extractOpenAIText(payload));
    const text = String(result?.text || "").trim();
    if (!text) throw new Error("OpenAI returned an empty rewrite");
    const usage = openAIUsage(payload);
    logAIUsage({ env, body, feature: "rewrite", model, usage });
    return json({ text, provider: { provider: "openai", model, usage, costMode: "efficient" } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The writing assistant is temporarily unavailable", code: "REWRITE_UNAVAILABLE" }, 502);
  }
}

export function magicProjectInstructions() {
  return `You are Certo Work's Magic Project extractor. Read a pasted project definition and return one JSON object the product can execute.

Return exactly this shape:
{
  "title": "",
  "outcome": "",
  "why": "",
  "methodology": "Hybrid",
  "owner": "",
  "targetDate": "YYYY-MM-DD or empty",
  "successCriteria": [""],
  "definitionOfDone": "",
  "phases": [{"title":"","description":"","targetDate":""}],
  "milestones": [{"title":"","targetDate":""}],
  "items": [{"title":"","kind":"epic|feature|pbi|task|subtask","dueDate":"","children":[]}],
  "meetings": [{"title":"","date":"","time":"","durationMinutes":60,"description":""}],
  "kickoff": {"title":"","date":"","description":""},
  "noteTitle": "",
  "noteContent": ""
}

Rules:
- Preserve source language, names, dates, and facts. Do not invent owners, dates, or scope.
- methodology must be Scrum, PMI, or Hybrid.
- Top-level delivery work is kind "pbi". Nested/indented work is "subtask". Larger containers are "epic" or "feature".
- Put the original source, lightly cleaned, into noteContent.
- Always include a kickoff meeting/item.
- If a field is unknown, use "" or [].
- Return JSON only.`;
}

async function extractMagicProject(request, env) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
  if (!body.userId || !body.workspaceId) {
    return json({ error: "userId and workspaceId are required" }, 400);
  }
  const source = String(body.text || "").trim();
  if (!source) return json({ error: "Project definition is required" }, 400);
  if (source.length > 80_000) return json({ error: "Project definition is too long" }, 400);
  try {
    await authorize(request, body, env);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Authentication failed" }, 401);
  }
  if (!openaiIsConfigured(env)) {
    return json({
      error: "Certo Work SAFE MODE. OpenAI is not configured for this Certo Work deployment yet.",
      code: "OPENAI_NOT_CONFIGURED",
      safeMode: true,
    }, 503);
  }
  const model = aiModelFor(env, body, "project_planning");
  const maxOutputTokens = numberFromEnv(
    env.OPENAI_MAGIC_PROJECT_MAX_OUTPUT_TOKENS || env.OPENAI_MAX_OUTPUT_TOKENS,
    900,
    400,
    2_000,
  );
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${openaiApiKey(env)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: magicProjectInstructions(),
        input: [{ role: "user", content: source }],
        text: { format: { type: "json_object" } },
        max_output_tokens: maxOutputTokens,
        store: false,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      return json({ error: payload?.error?.message || `OpenAI request failed (${response.status})`, code: "OPENAI_REQUEST_FAILED" }, 502);
    }
    const blueprint = parseJsonObject(extractOpenAIText(payload));
    if (!blueprint || typeof blueprint !== "object") throw new Error("OpenAI returned an empty project");
    const usage = openAIUsage(payload);
    logAIUsage({ env, body, feature: "magic_project", model, usage });
    return json({ blueprint, provider: { provider: "openai", model, usage, costMode: "balanced" } });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Magic Project is temporarily unavailable",
      code: "MAGIC_PROJECT_UNAVAILABLE",
    }, 502);
  }
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

  if (!openaiIsConfigured(env)) {
    return json(
      {
        error:
          "Certo Work SAFE MODE. OpenAI is not configured for this Certo Work deployment yet.",
        code: "OPENAI_NOT_CONFIGURED",
        safeMode: true,
      },
      503,
    );
  }

  const latestUserMessage =
    [...body.messages].reverse().find((message) => message.role === "user")?.content || "";
  const citations = groundedCitations(latestUserMessage, body.workspaceContext);
  const model = aiModelFor(env, body, "chat");
  const maxOutputTokens = numberFromEnv(
    env.OPENAI_CHAT_MAX_OUTPUT_TOKENS || env.OPENAI_MAX_OUTPUT_TOKENS,
    MAX_CHAT_OUTPUT_TOKENS,
    180,
    1_200,
  );
  const maxRounds = numberFromEnv(env.ODYSSEUS_MAX_ROUNDS, 1, 1, 3);
  const wantsStream =
    body.stream === true ||
    String(request.headers.get("accept") || "").includes("text/event-stream");

  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event, data) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        try {
          const result = await runOdysseusAgent({
            env,
            model,
            instructions: assistantInstructions(body, citations),
            messages: body.messages,
            workspaceContext: body.workspaceContext || {},
            openaiApiKey: openaiApiKey(env),
            openaiUrl: OPENAI_RESPONSES_URL,
            extractOpenAIText,
            parseJsonObject,
            normalizeAssistantResult,
            citations,
            latestUserMessage,
            maxOutputTokens,
            maxRounds,
            onUsage: async (usage) => logAIUsage({ env, body, feature: "chat", model, usage }),
            onStep: async (step) => send("step", step),
          });
          send("final", result);
        } catch (error) {
          send("error", {
            error:
              error instanceof Error
                ? error.message
                : "The assistant is temporarily unavailable",
            code: error?.code || "ASSISTANT_UNAVAILABLE",
          });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  }

  try {
    if (hermesRuntimeEnabled(env)) {
      const hermes = await tryHermesChat(env, {
        agentId: "odysseus",
        traceId: `${Date.now()}`,
        userId,
        workspaceId,
        conversationId: body.conversationId || body.workspaceContext?.conversationId || "",
        messages: [
          {
            role: "system",
            content: assistantInstructions(body, citations),
          },
          ...(Array.isArray(body.messages) ? body.messages : []),
        ],
      });
      if (hermes?.content) {
        logAIUsage({
          env,
          body,
          feature: "chat_hermes",
          model,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        });
        return json(
          normalizeAssistantResult(
            {
              reply: hermes.content,
              actionPlan: null,
              suggestedChips: [],
            },
            citations,
            model,
            latestUserMessage,
            { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          ),
        );
      }
      // Fall through to legacy Odysseus loop on Hermes miss/error.
    }
    const result = await runOdysseusAgent({
      env,
      model,
      instructions: assistantInstructions(body, citations),
      messages: body.messages,
      workspaceContext: body.workspaceContext || {},
      openaiApiKey: openaiApiKey(env),
      openaiUrl: OPENAI_RESPONSES_URL,
      extractOpenAIText,
      parseJsonObject,
      normalizeAssistantResult,
      citations,
      latestUserMessage,
      maxOutputTokens,
      maxRounds,
      onUsage: async (usage) => logAIUsage({ env, body, feature: "chat", model, usage }),
    });
    return json(result);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The assistant is temporarily unavailable",
        code: error?.code || "ASSISTANT_UNAVAILABLE",
      },
      error?.status || 502,
    );
  }
}

export function aiHealth(env, extras = {}) {
  const configured = openaiIsConfigured(env);
  const model = openaiModelName(env);
  const provider = requestedAiProvider(env);
  return {
    provider,
    providerConfigured: configured,
    providerAvailable: configured && extras.connection !== "error",
    modelConfigured: Boolean(model),
    model: configured ? model : null,
    connectionStatus: configured ? extras.connection || "ready" : "not_configured",
    safeMode: !configured,
  };
}

function capabilities(env) {
  const health = aiHealth(env);
  const openAIConfigured = health.providerConfigured;
  const brevoConfigured = Boolean(env.BREVO_API_KEY);
  return {
    openai: {
      configured: openAIConfigured,
      available: health.providerAvailable,
      model: health.model,
      connectionStatus: health.connectionStatus,
      description: openAIConfigured
        ? `OpenAI is active through ${aiModelFor(env, {}, "chat")} with cost controls enabled.`
        : "Add OPENAI_API_KEY as a Cloudflare Worker secret to activate AI responses.",
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
    email: {
      configured: brevoConfigured,
      provider: brevoConfigured ? "brevo" : "none",
      description: brevoConfigured
        ? `Transactional email is active through Brevo as ${env.CERTO_EMAIL_FROM || "the configured sender"}.`
        : "Add BREVO_API_KEY and a verified sender to send workspace invitations and notifications.",
    },
    capture: {
      configured: true,
      inboundSecret: Boolean(env.CAPTURE_INBOUND_SECRET),
      description:
        "Certo Capture understands inbound email; Requests replies send through Brevo.",
    },
    hubspot: {
      configured: false,
      description: "No live HubSpot connection is configured.",
    },
    googleDrive: {
      configured: true,
      available: true,
      description: "Connect Google Drive with a Google account to choose a root folder and optionally create a project folder. This is optional.",
    },
    oneDrive: {
      configured: Boolean(env.ONEDRIVE_CLIENT_ID && env.ONEDRIVE_CLIENT_SECRET),
      description: env.ONEDRIVE_CLIENT_ID
        ? "OneDrive connector credentials are present."
        : "OneDrive connector has not been configured. You can still paste a OneDrive link in Docs.",
    },
    collab: collabStatusPayload(env),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function publicAppOrigin(origin) {
  const value = String(origin || "").trim().replace(/\/$/, "");
  if (!value || /workers\.dev$/i.test(new URL(value).hostname) || /localhost|127\.0\.0\.1/i.test(value)) {
    return "https://certo.work";
  }
  return value;
}

function inviteEmailContent(body, origin) {
  const token = String(body.inviteToken || "").trim();
  const appOrigin = publicAppOrigin(origin);
  const inviteUrl = token ? `${appOrigin}/invite/${encodeURIComponent(token)}` : `${appOrigin}/`;
  const workspaceName = String(body.workspaceName || "Certo Work").trim();
  const toEmail = String(body.toEmail || "").trim().toLowerCase();
  const role = String(body.role || "member").trim();
  const inviterName = String(body.inviterName || body.inviterEmail || "Your workspace admin").trim();
  const subject = `${inviterName} invited you to ${workspaceName} in Certo Work`;
  const textContent = [
    `You have been invited to ${workspaceName} in Certo Work.`,
    "",
    "Use this invitation link (do not request beta access):",
    inviteUrl,
    "",
    `1. Open the link above.`,
    `2. Sign in or create your password with this exact email: ${toEmail}`,
    "3. Certo Work will add you to the workspace automatically.",
    `Role: ${role}`,
    "",
    "If the button/link does not open, copy and paste the URL into your browser.",
    "Check spam/promotions if you are looking for this email later.",
    "",
    "— Certo Work",
  ].join("\n");
  const htmlContent = `<!doctype html>
<html>
  <body style="margin:0;background:#f7faf7;font-family:Inter,Arial,sans-serif;color:#23352b;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="border:1px solid #dfe8e1;border-radius:22px;background:#ffffff;padding:28px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#587061;">Certo Work</div>
        <h1 style="margin:18px 0 10px;font-size:28px;line-height:1.05;letter-spacing:-.04em;color:#143d2e;">You’ve been invited to ${escapeHtml(workspaceName)}.</h1>
        <p style="margin:0 0 18px;color:#5d6d63;line-height:1.6;">${escapeHtml(inviterName)} invited you to collaborate in Certo Work.</p>
        <div style="border-radius:16px;background:#eef7f1;padding:14px 16px;margin:18px 0;color:#244b39;">
          <strong>Use this exact email:</strong><br />
          <span>${escapeHtml(toEmail)}</span><br />
          <small>Role: ${escapeHtml(role)}</small>
        </div>
        <a href="${inviteUrl}" style="display:inline-block;border-radius:999px;background:#214b39;color:#ffffff;padding:13px 18px;text-decoration:none;font-weight:800;">Accept invitation</a>
        <p style="margin:20px 0 0;color:#6f7d74;font-size:13px;line-height:1.6;">Open the button above and sign in or create your password with that email. Do not use “Request beta access” — this link already grants workspace access. If you do not see this email in your inbox, check spam/promotions.</p>
        <p style="margin:14px 0 0;color:#8a9690;font-size:12px;line-height:1.5;word-break:break-all;">${escapeHtml(inviteUrl)}</p>
      </div>
    </div>
  </body>
</html>`;
  return { subject, textContent, htmlContent, inviteUrl };
}

async function sendBrevoTransactionalEmail(env, message) {
  if (!env.BREVO_API_KEY) {
    return { sent: false, configured: false, error: "BREVO_API_KEY is not configured" };
  }
  const response = await fetch(BREVO_TRANSACTIONAL_EMAIL_URL, {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(message),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      sent: false,
      configured: true,
      error: payload?.message || `Brevo request failed (${response.status})`,
      status: response.status,
    };
  }
  return { sent: true, configured: true, messageId: payload?.messageId };
}

async function sendInviteEmail(request, env) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
  if (!body.userId || !body.workspaceId || !body.toEmail) {
    return json({ error: "userId, workspaceId and toEmail are required" }, 400);
  }
  try {
    await authorize(request, body, env);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Authentication failed" }, 401);
  }
  const toEmail = String(body.toEmail || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return json({ error: "A valid recipient email is required" }, 400);
  }
  const origin = env.CERTO_APP_ORIGIN || new URL(request.url).origin;
  const content = inviteEmailContent({ ...body, toEmail }, origin);
  const senderEmail = env.CERTO_EMAIL_FROM || "support@certo.work";
  const senderName = env.CERTO_EMAIL_FROM_NAME || "Certo Work";
  const replyToEmail = env.CERTO_EMAIL_REPLY_TO || senderEmail;
  const result = await sendBrevoTransactionalEmail(env, {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: String(body.toName || body.toEmail || "").trim() }],
    replyTo: { email: replyToEmail, name: senderName },
    subject: content.subject,
    htmlContent: content.htmlContent,
    textContent: content.textContent,
    tags: ["workspace-invite"],
    headers: {
      "X-Mailin-custom": JSON.stringify({ workspaceId: body.workspaceId, invite: true }),
    },
    params: {
      workspaceId: body.workspaceId,
      role: body.role || "member",
    },
  });
  if (!result.sent) {
    return json({ ...result, inviteUrl: content.inviteUrl }, result.configured ? 502 : 503);
  }
  return json({ ...result, inviteUrl: content.inviteUrl });
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
      const health = aiHealth(env);
      return json({
        ok: true,
        service: "delivereeos-codex-sites",
        aiProvider: health.providerConfigured ? "openai" : "offline-safe",
        ai: health,
      });
    }
    if (request.method === "GET" && url.pathname === "/api/ai/health") {
      const health = aiHealth(env);
      if (url.searchParams.get("probe") === "1" && openaiIsConfigured(env)) {
        try {
          const probe = await fetch("https://api.openai.com/v1/models", {
            headers: { authorization: `Bearer ${openaiApiKey(env)}` },
          });
          health.connectionStatus = probe.ok ? "connected" : "error";
          health.providerAvailable = probe.ok;
        } catch {
          health.connectionStatus = "error";
          health.providerAvailable = false;
        }
      }
      return json(health);
    }
    if (request.method === "GET" && url.pathname === "/api/capabilities") {
      return json(capabilities(env));
    }
    if (request.method === "GET" && url.pathname === "/api/session") {
      const identity = platformIdentity(request);
      if (!identity) return json({ authenticated: false }, 401);
      return json({ authenticated: true, provider: "codex-sites", user: identity });
    }
    if (request.method === "GET" && url.pathname.startsWith("/api/widget/")) {
      const token = decodeURIComponent(url.pathname.slice("/api/widget/".length).split("/")[0] || "");
      try {
        const snapshot = await loadAppleWidgetSnapshot(token, env);
        if (!snapshot) return json({ error: "Widget unavailable" }, 404);
        return json({ snapshot });
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Widget unavailable" },
          500,
        );
      }
    }
    if (request.method === "POST" && url.pathname === "/api/voice/transcribe") {
      return transcribeVoice(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/boldi/chat") {
      return chat(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/certo/rewrite") {
      return rewriteField(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/certo/magic-project") {
      return extractMagicProject(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/email/invite") {
      return sendInviteEmail(request, env);
    }
    {
      const capture = createCaptureRequestsHandlers({
        json,
        readJson,
        authorize,
        sendBrevoTransactionalEmail,
      });
      if (request.method === "POST" && url.pathname === "/api/capture/understand") {
        return capture.handleUnderstand(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/capture/triage") {
        return capture.handleTriage(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/capture/inbound/email") {
        return capture.handleInboundEmail(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/requests/reply") {
        return capture.handleTicketReply(request, env);
      }
    }
    if (request.method === "GET" && url.pathname === "/api/collab/status") {
      return json(collabStatusPayload(env, url.origin));
    }
    if (request.method === "POST" && url.pathname === "/api/collab/sso") {
      try {
        const body = await readJson(request);
        await authorize(request, body, env);
        const result = await provisionCollabSso(env, body, url.origin, { syncRooms: false });
        return json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Chat Collab is unavailable.";
        const status = error?.status || (message.includes("Authentication") ? 401 : 502);
        return json(
          {
            error: message,
            configured: collabStatusPayload(env, url.origin).configured,
          },
          status,
        );
      }
    }
    if (request.method === "POST" && url.pathname === "/api/collab/rooms") {
      try {
        const body = await readJson(request);
        await authorize(request, body, env);
        const result = await provisionCollabSso(env, body, url.origin, { syncRooms: true });
        return json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Chat Collab is unavailable.";
        const status = error?.status || (message.includes("Authentication") ? 401 : 502);
        return json(
          {
            error: message,
            configured: collabStatusPayload(env, url.origin).configured,
          },
          status,
        );
      }
    }
    if (request.method === "GET" && isCertoCollabBrandPath(url.pathname)) {
      const mark = new URL("/certo-mark.svg", request.url);
      return serveAsset(
        new Request(mark.toString(), {
          method: "GET",
          headers: { accept: "image/svg+xml" },
        }),
        env,
      );
    }
    if (isChatwootProxyPath(url.pathname)) {
      return proxyChatwoot(request, env);
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
