/**
 * Assistant access — pure rules for personal access tokens, item reads,
 * and the proposal queue. No Firestore, no network. Both the Express server
 * and the Cloudflare worker call this with a repository.
 *
 * Disabled unless ASSISTANT_ACCESS_ENABLED is 1/true/on/yes.
 * New collections only. Does not change existing task shapes except when an
 * owner explicitly approves a proposal (or a token with items:write is used).
 */

export const ASSISTANT_SCOPES = ["items:read", "items:propose", "items:write"];
export const DEFAULT_SCOPES = ["items:read"];
export const PROPOSAL_ACTIONS = ["create", "update", "close", "reprioritize"];
export const PROPOSAL_LIMIT = 30;
export const PROPOSAL_WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const MIN_TOKEN_TTL_MS = 60 * 60 * 1000;
export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 100;
export const ITEM_FETCH_CAP = 2000;
export const TOKEN_PREFIX = "cw_pat_";

const WRITABLE_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "assigneeIds",
  "assignees",
  "parentId",
  "epicId",
  "featureId",
  "projectId",
  "deliveryEntity",
  "clientEntity",
  "tagIds",
  "externalRef",
  "workItemType",
];

export function assistantAccessEnabled(env = {}) {
  const raw = String(env.ASSISTANT_ACCESS_ENABLED || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export function timestampMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const ms = value.toMillis();
      return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      const ms = date instanceof Date ? date.getTime() : 0;
      return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value.seconds === "number") return value.seconds * 1000;
    if (typeof value._seconds === "number") return value._seconds * 1000;
  }
  return 0;
}

export function toIso(value) {
  const ms = timestampMs(value);
  return ms ? new Date(ms).toISOString() : null;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const btoaFn = globalThis.btoa;
  if (typeof btoaFn !== "function") {
    return Buffer.from(bytes).toString("base64url");
  }
  return btoaFn(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generatePersonalAccessToken() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `${TOKEN_PREFIX}${bytesToBase64Url(bytes)}`;
}

export function generateId(prefix) {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${bytesToBase64Url(bytes)}`;
}

export async function sha256Hex(value) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(String(value)).digest("hex");
}

export function isPersonalAccessToken(value) {
  return String(value || "").startsWith(TOKEN_PREFIX) && String(value).length >= TOKEN_PREFIX.length + 20;
}

export function tokenPrefix(token) {
  return String(token || "").slice(0, 16);
}

export function normalizeScopes(input) {
  const requested = new Set(
    (Array.isArray(input) && input.length ? input : DEFAULT_SCOPES).map((scope) =>
      String(scope || "").trim(),
    ),
  );
  requested.add("items:read");
  return ASSISTANT_SCOPES.filter((scope) => requested.has(scope));
}

export function hasScope(token, scope) {
  const scopes = Array.isArray(token?.scopes) ? token.scopes : [];
  if (scope === "items:read") return scopes.includes("items:read") || scopes.length === 0;
  return scopes.includes(scope);
}

export function publicToken(record) {
  return {
    id: record.id,
    label: record.label,
    token_prefix: record.tokenPrefix,
    scopes: record.scopes || DEFAULT_SCOPES,
    workspace_ids: record.workspaceIds || [],
    expires_at: record.expiresAt,
    revoked_at: record.revokedAt || null,
    created_at: record.createdAt,
    last_used_at: record.lastUsedAt || null,
  };
}

export function assertTokenUsable(token, workspaceId, now = Date.now()) {
  if (!token) {
    const error = new Error("Unknown access token");
    error.status = 401;
    error.code = "unauthenticated";
    throw error;
  }
  if (token.revokedAt) {
    const error = new Error("Access token has been revoked");
    error.status = 401;
    error.code = "token_revoked";
    throw error;
  }
  const expires = timestampMs(token.expiresAt);
  if (!expires || expires <= now) {
    const error = new Error("Access token has expired");
    error.status = 401;
    error.code = "token_expired";
    throw error;
  }
  const allowed = Array.isArray(token.workspaceIds) ? token.workspaceIds : [];
  if (!workspaceId || !allowed.includes(workspaceId)) {
    const error = new Error("Token is not valid for this workspace");
    error.status = 403;
    error.code = "cross_tenant_denied";
    throw error;
  }
}

export function hierarchyKind(item) {
  const value = String(
    item?.workItemType || item?.taskType || item?.issueType || item?.kind || item?.type || item?.itemType || "",
  ).toLowerCase();
  if (value.includes("epic")) return "epic";
  if (value.includes("feature")) return "feature";
  if (value.includes("subtask") || value.includes("sub_task")) return "subtask";
  if (value.includes("story")) return "story";
  if (value.includes("bug")) return "bug";
  if (value.includes("ticket")) return "ticket";
  if (value.includes("issue")) return "issue";
  if (value === "task" || value.includes("project_task")) return "task";
  return "pbi";
}

function tagName(tag) {
  return String(tag?.name || tag?.title || tag?.id || "").trim();
}

export function resolveItemTags(item, catalog = []) {
  const raw = Array.isArray(item?.tagIds)
    ? item.tagIds
    : Array.isArray(item?.tags)
      ? item.tags
      : [];
  const ids = [...new Set(raw.map((value) => String(value || "").trim()).filter(Boolean))];
  return ids.map((id) => {
    const exact = catalog.find((tag) => String(tag.id) === id);
    if (exact) return { id: String(exact.id), name: tagName(exact) };
    const byName = catalog.find((tag) => tagName(tag).toLowerCase() === id.toLowerCase());
    if (byName) return { id: String(byName.id), name: tagName(byName) };
    return { id, name: null, unresolved: true };
  });
}

export function projectWorkItem(item, catalog = []) {
  const assigneeIds = Array.isArray(item?.assigneeIds)
    ? item.assigneeIds.map((id) => String(id || "")).filter(Boolean)
    : [];
  const assigneeNames = Array.isArray(item?.assignees)
    ? item.assignees.map((name) => String(name || "")).filter(Boolean)
    : [item?.owner, item?.assignee].map((name) => String(name || "").trim()).filter(Boolean);
  return {
    id: String(item.id),
    external_ref: item.externalRef || item.external_ref || null,
    workspace_id: String(item.workspaceId || ""),
    project_id: item.projectId ? String(item.projectId) : null,
    kind: hierarchyKind(item),
    title: String(item.title || item.name || "").trim(),
    parent_id: item.parentId ? String(item.parentId) : null,
    epic_id: item.epicId ? String(item.epicId) : null,
    feature_id: item.featureId ? String(item.featureId) : null,
    status: item.status == null ? null : String(item.status),
    priority: item.priority == null || item.priority === "" ? null : item.priority,
    due_date: item.dueDate || item.targetDate || null,
    assignee: {
      ids: assigneeIds,
      names: [...new Set(assigneeNames)],
    },
    attributes: {
      delivery_entity: item.deliveryEntity || item.bpo || null,
      client_entity: item.clientEntity || item.client || null,
    },
    tags: resolveItemTags(item, catalog),
    description: String(item.description || item.definitionOfDone || ""),
    created_at: toIso(item.createdAt),
    updated_at: toIso(item.updatedAt || item.createdAt),
  };
}

function itemSortKey(item) {
  return {
    ms: timestampMs(item.updatedAt || item.createdAt),
    id: String(item.id || ""),
  };
}

export function encodeCursor(item) {
  const key = itemSortKey(item);
  const json = JSON.stringify({ ms: key.ms, id: key.id });
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodeCursor(cursor) {
  const raw = String(cursor || "").trim();
  if (!raw) return null;
  try {
    let json = "";
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(raw, "base64url").toString("utf8");
    } else {
      const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
      json = atob(padded);
    }
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed.ms !== "number" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function afterCursor(item, cursor) {
  if (!cursor) return true;
  const key = itemSortKey(item);
  if (key.ms > cursor.ms) return true;
  if (key.ms < cursor.ms) return false;
  return key.id > cursor.id;
}

export function listWorkItems(items, options = {}) {
  const workspaceId = String(options.workspaceId || "");
  const since = options.updatedSince ? timestampMs(options.updatedSince) : 0;
  const cursor = options.cursor || null;
  const limit = Math.min(
    PAGE_LIMIT_MAX,
    Math.max(1, Number(options.limit) || PAGE_LIMIT_DEFAULT),
  );
  const catalog = options.tags || [];
  const scoped = (items || []).filter((item) => String(item?.workspaceId || "") === workspaceId);
  const filtered = scoped.filter((item) => {
    if (since && timestampMs(item.updatedAt || item.createdAt) <= since) return false;
    return afterCursor(item, cursor);
  });
  filtered.sort((left, right) => {
    const delta = itemSortKey(left).ms - itemSortKey(right).ms;
    if (delta) return delta;
    return itemSortKey(left).id.localeCompare(itemSortKey(right).id);
  });
  const page = filtered.slice(0, limit);
  const next = filtered.length > limit ? encodeCursor(page[page.length - 1]) : null;
  return {
    items: page.map((item) => projectWorkItem(item, catalog)),
    next_cursor: next,
  };
}

function cleanString(value, max) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

export function sanitizeItemPatch(input = {}, { action } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const patch = {};
  if (source.title != null || source.name != null) {
    const title = cleanString(source.title ?? source.name, 500);
    if (title) patch.title = title;
  }
  if (source.description != null) patch.description = String(source.description).slice(0, 20000);
  if (source.status != null) patch.status = cleanString(source.status, 64);
  if (Object.prototype.hasOwnProperty.call(source, "priority")) {
    patch.priority = source.priority == null || source.priority === "" ? null : source.priority;
  }
  if (source.due_date != null || source.dueDate != null) {
    patch.dueDate = cleanString(source.due_date ?? source.dueDate, 40);
  }
  if (Array.isArray(source.assignee_ids) || Array.isArray(source.assigneeIds)) {
    const ids = (source.assignee_ids || source.assigneeIds).map((id) => String(id || "").trim()).filter(Boolean).slice(0, 20);
    patch.assigneeIds = ids;
  }
  if (Array.isArray(source.assignee_names) || Array.isArray(source.assignees)) {
    const names = (source.assignee_names || source.assignees).map((name) => String(name || "").trim()).filter(Boolean).slice(0, 20);
    patch.assignees = names;
  }
  for (const [apiKey, field] of [
    ["parent_id", "parentId"],
    ["epic_id", "epicId"],
    ["feature_id", "featureId"],
    ["project_id", "projectId"],
  ]) {
    if (source[apiKey] != null || source[field] != null) {
      patch[field] = cleanString(source[apiKey] ?? source[field], 128);
    }
  }
  if (source.delivery_entity != null || source.deliveryEntity != null) {
    patch.deliveryEntity = cleanString(source.delivery_entity ?? source.deliveryEntity, 200);
  }
  if (source.client_entity != null || source.clientEntity != null) {
    patch.clientEntity = cleanString(source.client_entity ?? source.clientEntity, 200);
  }
  if (Array.isArray(source.tag_ids) || Array.isArray(source.tagIds)) {
    patch.tagIds = (source.tag_ids || source.tagIds).map((id) => String(id || "").trim()).filter(Boolean).slice(0, 30);
  }
  if (source.external_ref != null || source.externalRef != null) {
    patch.externalRef = cleanString(source.external_ref ?? source.externalRef, 200);
  }
  if (source.kind != null || source.workItemType != null) {
    patch.workItemType = cleanString(source.kind ?? source.workItemType, 40);
  }
  if (action === "close") patch.status = "done";
  if (action === "reprioritize" && patch.priority == null && source.priority == null) {
    const error = new Error("reprioritize requires priority");
    error.status = 400;
    error.code = "invalid_request";
    throw error;
  }
  const unknown = Object.keys(patch).filter((key) => !WRITABLE_FIELDS.includes(key));
  if (unknown.length) {
    const error = new Error(`Unsupported fields: ${unknown.join(", ")}`);
    error.status = 400;
    error.code = "invalid_request";
    throw error;
  }
  return patch;
}

export function consumeProposalRate(token, now = Date.now()) {
  const start = timestampMs(token?.proposalWindowStart);
  const inWindow = start && now - start < PROPOSAL_WINDOW_MS;
  const count = inWindow ? Number(token?.proposalWindowCount || 0) : 0;
  if (count >= PROPOSAL_LIMIT) {
    const error = new Error("Proposal rate limit exceeded");
    error.status = 429;
    error.code = "rate_limited";
    error.retryAt = new Date(start + PROPOSAL_WINDOW_MS).toISOString();
    throw error;
  }
  return {
    proposalWindowStart: inWindow ? new Date(start).toISOString() : new Date(now).toISOString(),
    proposalWindowCount: count + 1,
  };
}

export function proposalPatchForApply(proposal, approverUserId, nowIso) {
  const action = proposal.action;
  const patch = sanitizeItemPatch(proposal.payload || {}, { action });
  if (action === "create" && !patch.title) {
    const error = new Error("create requires a title");
    error.status = 400;
    error.code = "invalid_request";
    throw error;
  }
  if ((action === "update" || action === "close" || action === "reprioritize") && !proposal.itemId) {
    const error = new Error("item_id is required");
    error.status = 400;
    error.code = "invalid_request";
    throw error;
  }
  patch.updatedAt = nowIso;
  patch.assistantAttribution = {
    proposalId: proposal.id,
    tokenId: proposal.tokenId,
    assistantLabel: proposal.assistantLabel || "assistant",
    approvedByUserId: approverUserId,
    appliedAt: nowIso,
    action,
  };
  if (Array.isArray(patch.tagIds)) {
    patch.tags = patch.tagIds;
    patch.labels = patch.tagIds;
  }
  return patch;
}

export function buildCreatedItem(proposal, approverUserId, nowIso) {
  const patch = proposalPatchForApply(proposal, approverUserId, nowIso);
  return {
    userId: proposal.userId,
    workspaceId: proposal.workspaceId,
    title: patch.title,
    status: patch.status || "open",
    createdAt: nowIso,
    createdBy: proposal.userId,
    ...patch,
  };
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function bearer(headers = {}) {
  const raw = headers.authorization || headers.Authorization || "";
  const value = String(raw);
  if (!value.startsWith("Bearer ")) return "";
  return value.slice(7).trim();
}

async function audit(repo, event) {
  if (!repo.writeAudit) return;
  await repo.writeAudit({
    id: generateId("aud"),
    at: new Date().toISOString(),
    ...event,
  });
}

async function requireMember(repo, userId, workspaceId) {
  const allowed = await repo.isMember(userId, workspaceId);
  if (!allowed) throw httpError(403, "forbidden", "Workspace access denied");
}

async function resolveUser(deps, headers) {
  const secret = bearer(headers);
  if (!secret || isPersonalAccessToken(secret)) {
    throw httpError(401, "unauthenticated", "Sign-in required");
  }
  if (!deps.verifyUser) throw httpError(503, "unavailable", "Sign-in verification is unavailable");
  try {
    const user = await deps.verifyUser(secret);
    if (!user?.uid) throw httpError(401, "unauthenticated", "Invalid sign-in");
    return user;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(401, "unauthenticated", "Invalid or expired sign-in");
  }
}

function workspaceFrom(query, body) {
  return String(query?.workspaceId || query?.workspace_id || body?.workspaceId || body?.workspace_id || "").trim();
}

function singleWorkspace(token, requested) {
  if (requested) return requested;
  const ids = token?.workspaceIds || [];
  if (ids.length === 1) return ids[0];
  throw httpError(400, "invalid_request", "workspaceId is required");
}

function requireKnownToken(token) {
  if (!token) throw httpError(401, "unauthenticated", "Unknown access token");
  return token;
}

export async function dispatchAssistantRequest(request, deps) {
  const env = deps.env || {};
  if (!assistantAccessEnabled(env)) {
    return {
      status: 404,
      body: { error: "Assistant access is disabled", code: "assistant_access_disabled" },
    };
  }
  const repo = deps.repo;
  if (!repo) {
    return { status: 503, body: { error: "Assistant access storage is unavailable", code: "unavailable" } };
  }
  const now = deps.now ? deps.now() : Date.now();
  const method = String(request.method || "GET").toUpperCase();
  const path = String(request.path || "/").replace(/\/+$/, "") || "/";
  const query = request.query || {};
  const body = request.body || {};
  const headers = request.headers || {};

  try {
    if (method === "POST" && path === "/api/assistant/mcp") {
      return await dispatchMcp(repo, headers, body, now);
    }

    if (method === "GET" && path === "/api/assistant/tokens") {
      const user = await resolveUser(deps, headers);
      const tokens = await repo.listTokensForUser(user.uid);
      return { status: 200, body: { tokens: tokens.map(publicToken) } };
    }

    if (method === "POST" && path === "/api/assistant/tokens") {
      const user = await resolveUser(deps, headers);
      const label = cleanString(body.label || body.name, 80);
      if (!label) throw httpError(400, "invalid_request", "label is required");
      const workspaceIds = [...new Set((body.workspaceIds || body.workspace_ids || []).map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 20);
      if (!workspaceIds.length) throw httpError(400, "invalid_request", "workspaceIds is required");
      for (const workspaceId of workspaceIds) {
        await requireMember(repo, user.uid, workspaceId);
      }
      const ttl = body.expiresInDays != null
        ? Math.round(Number(body.expiresInDays) * 24 * 60 * 60 * 1000)
        : body.expiresAt
          ? timestampMs(body.expiresAt) - now
          : DEFAULT_TOKEN_TTL_MS;
      if (!Number.isFinite(ttl) || ttl < MIN_TOKEN_TTL_MS || ttl > MAX_TOKEN_TTL_MS) {
        throw httpError(400, "invalid_request", "Token expiry must be between 1 hour and 365 days");
      }
      const secret = generatePersonalAccessToken();
      const record = {
        id: generateId("pat"),
        userId: user.uid,
        workspaceIds,
        label,
        tokenHash: await sha256Hex(secret),
        tokenPrefix: tokenPrefix(secret),
        scopes: normalizeScopes(body.scopes),
        expiresAt: new Date(now + ttl).toISOString(),
        revokedAt: null,
        createdAt: new Date(now).toISOString(),
        lastUsedAt: null,
        proposalWindowStart: null,
        proposalWindowCount: 0,
      };
      await repo.saveToken(record);
      await audit(repo, {
        tokenId: record.id,
        userId: user.uid,
        workspaceId: workspaceIds[0],
        action: "token.create",
        ok: true,
      });
      return {
        status: 201,
        body: { token: secret, access_token: publicToken(record) },
      };
    }

    const revokeMatch = path.match(/^\/api\/assistant\/tokens\/([^/]+)\/revoke$/);
    if (method === "POST" && revokeMatch) {
      const user = await resolveUser(deps, headers);
      const existing = await repo.getToken(revokeMatch[1]);
      if (!existing || existing.userId !== user.uid) throw httpError(404, "not_found", "Token not found");
      await repo.patchToken(existing.id, { revokedAt: new Date(now).toISOString() });
      await audit(repo, {
        tokenId: existing.id,
        userId: user.uid,
        workspaceId: (existing.workspaceIds || [])[0] || "",
        action: "token.revoke",
        ok: true,
      });
      return { status: 200, body: { revoked: true, id: existing.id } };
    }

    if (method === "GET" && path === "/api/assistant/items") {
      const secret = bearer(headers);
      if (!isPersonalAccessToken(secret)) throw httpError(401, "unauthenticated", "Personal access token required");
      const token = requireKnownToken(await repo.findTokenByHash(await sha256Hex(secret)));
      const workspaceId = singleWorkspace(token, workspaceFrom(query, body));
      assertTokenUsable(token, workspaceId, now);
      if (!hasScope(token, "items:read")) throw httpError(403, "insufficient_scope", "Token is missing items:read");
      await requireMember(repo, token.userId, workspaceId);
      const cursor = query.cursor ? decodeCursor(query.cursor) : null;
      if (query.cursor && !cursor) throw httpError(400, "invalid_request", "Invalid cursor");
      const [items, tags] = await Promise.all([
        repo.listItems(workspaceId),
        repo.listTags ? repo.listTags(workspaceId) : [],
      ]);
      const page = listWorkItems(items, {
        workspaceId,
        updatedSince: query.updated_since || query.updatedSince || "",
        cursor,
        limit: query.limit,
        tags,
      });
      await repo.patchToken(token.id, { lastUsedAt: new Date(now).toISOString() });
      await audit(repo, {
        tokenId: token.id,
        userId: token.userId,
        workspaceId,
        action: "items.list",
        ok: true,
      });
      return { status: 200, body: page };
    }

    const itemMatch = path.match(/^\/api\/assistant\/items\/([^/]+)$/);
    if (method === "GET" && itemMatch) {
      const secret = bearer(headers);
      if (!isPersonalAccessToken(secret)) throw httpError(401, "unauthenticated", "Personal access token required");
      const token = requireKnownToken(await repo.findTokenByHash(await sha256Hex(secret)));
      const workspaceId = singleWorkspace(token, workspaceFrom(query, body));
      assertTokenUsable(token, workspaceId, now);
      if (!hasScope(token, "items:read")) throw httpError(403, "insufficient_scope", "Token is missing items:read");
      await requireMember(repo, token.userId, workspaceId);
      const item = await repo.getItem(workspaceId, decodeURIComponent(itemMatch[1]));
      if (!item || String(item.workspaceId || "") !== workspaceId) {
        throw httpError(404, "not_found", "Item not found");
      }
      const tags = repo.listTags ? await repo.listTags(workspaceId) : [];
      await repo.patchToken(token.id, { lastUsedAt: new Date(now).toISOString() });
      await audit(repo, {
        tokenId: token.id,
        userId: token.userId,
        workspaceId,
        action: "items.get",
        ok: true,
        itemId: item.id,
      });
      return { status: 200, body: { item: projectWorkItem(item, tags) } };
    }

    if (method === "POST" && path === "/api/assistant/items") {
      const secret = bearer(headers);
      if (!isPersonalAccessToken(secret)) throw httpError(401, "unauthenticated", "Personal access token required");
      const token = requireKnownToken(await repo.findTokenByHash(await sha256Hex(secret)));
      const workspaceId = singleWorkspace(token, workspaceFrom(query, body));
      assertTokenUsable(token, workspaceId, now);
      if (!hasScope(token, "items:write")) throw httpError(403, "insufficient_scope", "Token is missing items:write");
      await requireMember(repo, token.userId, workspaceId);
      const nowIso = new Date(now).toISOString();
      const proposal = {
        id: "direct",
        action: "create",
        userId: token.userId,
        workspaceId,
        tokenId: token.id,
        assistantLabel: token.label,
        payload: body.fields || body.item || body,
      };
      const created = buildCreatedItem(proposal, token.userId, nowIso);
      created.assistantAttribution = {
        ...created.assistantAttribution,
        action: "direct_write",
        approvedByUserId: token.userId,
      };
      const saved = await repo.createItem(created);
      await repo.patchToken(token.id, { lastUsedAt: nowIso });
      await audit(repo, {
        tokenId: token.id,
        userId: token.userId,
        workspaceId,
        action: "items.write",
        ok: true,
        itemId: saved.id,
      });
      const tags = repo.listTags ? await repo.listTags(workspaceId) : [];
      return { status: 201, body: { item: projectWorkItem({ ...created, id: saved.id }, tags) } };
    }

    if (method === "POST" && path === "/api/assistant/proposals") {
      const secret = bearer(headers);
      if (!isPersonalAccessToken(secret)) throw httpError(401, "unauthenticated", "Personal access token required");
      const token = requireKnownToken(await repo.findTokenByHash(await sha256Hex(secret)));
      const workspaceId = singleWorkspace(token, workspaceFrom(query, body));
      assertTokenUsable(token, workspaceId, now);
      if (!hasScope(token, "items:propose")) throw httpError(403, "insufficient_scope", "Token is missing items:propose");
      await requireMember(repo, token.userId, workspaceId);
      const action = String(body.action || "").trim();
      if (!PROPOSAL_ACTIONS.includes(action)) throw httpError(400, "invalid_request", "Unsupported proposal action");
      const payload = sanitizeItemPatch(body.fields || body.payload || body, { action });
      if (action === "create" && !payload.title) throw httpError(400, "invalid_request", "create requires a title");
      const itemId = cleanString(body.item_id || body.itemId, 128);
      if (action !== "create" && !itemId) throw httpError(400, "invalid_request", "item_id is required");
      if (itemId) {
        const existing = await repo.getItem(workspaceId, itemId);
        if (!existing || String(existing.workspaceId || "") !== workspaceId) {
          throw httpError(404, "not_found", "Item not found");
        }
      }
      const rate = consumeProposalRate(token, now);
      const proposal = {
        id: generateId("prp"),
        workspaceId,
        userId: token.userId,
        tokenId: token.id,
        assistantLabel: token.label || "assistant",
        action,
        itemId: itemId || null,
        payload,
        status: "pending",
        createdAt: new Date(now).toISOString(),
        decidedAt: null,
        decidedByUserId: null,
      };
      await repo.saveProposal(proposal);
      await repo.patchToken(token.id, { ...rate, lastUsedAt: proposal.createdAt });
      await audit(repo, {
        tokenId: token.id,
        userId: token.userId,
        workspaceId,
        action: "items.propose",
        ok: true,
        proposalId: proposal.id,
      });
      return { status: 202, body: { proposal: publicProposal(proposal) } };
    }

    if (method === "GET" && path === "/api/assistant/proposals") {
      const user = await resolveUser(deps, headers);
      const workspaceId = workspaceFrom(query, body);
      if (!workspaceId) throw httpError(400, "invalid_request", "workspaceId is required");
      await requireMember(repo, user.uid, workspaceId);
      const status = String(query.status || "pending");
      const rows = await repo.listProposals(user.uid, workspaceId);
      const proposals = rows
        .filter((row) => String(row.workspaceId) === workspaceId && row.userId === user.uid)
        .filter((row) => status === "all" || row.status === status)
        .map(publicProposal);
      return { status: 200, body: { proposals } };
    }

    if (method === "POST" && path === "/api/assistant/proposals/decide") {
      const user = await resolveUser(deps, headers);
      const workspaceId = workspaceFrom(query, body);
      if (!workspaceId) throw httpError(400, "invalid_request", "workspaceId is required");
      await requireMember(repo, user.uid, workspaceId);
      const decisions = Array.isArray(body.decisions) ? body.decisions.slice(0, 25) : [];
      if (!decisions.length) throw httpError(400, "invalid_request", "decisions is required");
      const results = [];
      for (const decision of decisions) {
        results.push(await decideOne(repo, user.uid, workspaceId, decision, now));
      }
      return { status: 200, body: { results } };
    }

    return { status: 404, body: { error: "Not found", code: "not_found" } };
  } catch (error) {
    const status = error.status || 500;
    return {
      status,
      body: {
        error: status >= 500 ? "Assistant access failed" : error.message,
        code: error.code || "error",
        retry_at: error.retryAt || undefined,
      },
    };
  }
}

function publicProposal(proposal) {
  return {
    id: proposal.id,
    workspace_id: proposal.workspaceId,
    action: proposal.action,
    item_id: proposal.itemId || null,
    payload: proposal.payload || {},
    status: proposal.status,
    assistant_label: proposal.assistantLabel || "assistant",
    created_at: proposal.createdAt,
    decided_at: proposal.decidedAt || null,
    decided_by_user_id: proposal.decidedByUserId || null,
  };
}

async function decideOne(repo, userId, workspaceId, decision, now) {
  const id = String(decision?.id || "").trim();
  const choice = String(decision?.decision || "").trim();
  if (!id || (choice !== "approve" && choice !== "reject")) {
    return { id, ok: false, code: "invalid_request" };
  }
  const proposal = await repo.getProposal(id);
  if (!proposal || proposal.userId !== userId || proposal.workspaceId !== workspaceId) {
    return { id, ok: false, code: "not_found" };
  }
  if (proposal.status !== "pending") return { id, ok: false, code: "already_decided", status: proposal.status };
  const nowIso = new Date(now).toISOString();
  if (choice === "reject") {
    await repo.patchProposal(id, { status: "rejected", decidedAt: nowIso, decidedByUserId: userId });
    await audit(repo, {
      tokenId: proposal.tokenId,
      userId,
      workspaceId,
      action: "proposal.reject",
      ok: true,
      proposalId: id,
    });
    return { id, ok: true, status: "rejected" };
  }
  try {
    if (proposal.action === "create") {
      const created = buildCreatedItem(proposal, userId, nowIso);
      const saved = await repo.createItem(created);
      await repo.patchProposal(id, {
        status: "approved",
        decidedAt: nowIso,
        decidedByUserId: userId,
        appliedItemId: saved.id,
      });
      await audit(repo, {
        tokenId: proposal.tokenId,
        userId,
        workspaceId,
        action: "proposal.approve",
        ok: true,
        proposalId: id,
        itemId: saved.id,
      });
      return { id, ok: true, status: "approved", item_id: saved.id };
    }
    const existing = await repo.getItem(workspaceId, proposal.itemId);
    if (!existing || String(existing.workspaceId || "") !== workspaceId) {
      return { id, ok: false, code: "not_found" };
    }
    const patch = proposalPatchForApply(proposal, userId, nowIso);
    await repo.updateItem(workspaceId, proposal.itemId, patch);
    await repo.patchProposal(id, { status: "approved", decidedAt: nowIso, decidedByUserId: userId });
    await audit(repo, {
      tokenId: proposal.tokenId,
      userId,
      workspaceId,
      action: "proposal.approve",
      ok: true,
      proposalId: id,
      itemId: proposal.itemId,
    });
    return { id, ok: true, status: "approved", item_id: proposal.itemId };
  } catch (error) {
    return { id, ok: false, code: error.code || "apply_failed" };
  }
}

const MCP_TOOLS = [
  {
    name: "list_items",
    description: "List work items the token's user can see in one workspace. Supports updated_since and cursor pagination.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        updated_since: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_item",
    description: "Get one work item by stable id, including hierarchy parent ids.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        item_id: { type: "string" },
      },
      required: ["item_id"],
    },
  },
  {
    name: "propose_item",
    description: "Queue a create, update, close, or reprioritize proposal. Does not change items until the user approves it.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        action: { type: "string", enum: PROPOSAL_ACTIONS },
        item_id: { type: "string" },
        fields: { type: "object" },
      },
      required: ["action"],
    },
  },
];

async function dispatchMcp(repo, headers, body, now) {
  const method = String(body.method || "");
  const id = body.id ?? null;
  if (method === "initialize") {
    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "certo-work", version: "1" },
        },
      },
    };
  }
  if (method === "notifications/initialized") {
    return { status: 202, body: { ok: true } };
  }
  if (method === "tools/list") {
    return { status: 200, body: { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } } };
  }
  if (method !== "tools/call") {
    return {
      status: 200,
      body: { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } },
    };
  }
  const name = String(body.params?.name || "");
  const args = body.params?.arguments || {};
  const secret = bearer(headers);
  if (!isPersonalAccessToken(secret)) {
    return { status: 401, body: { error: "Personal access token required", code: "unauthenticated" } };
  }
  const token = await repo.findTokenByHash(await sha256Hex(secret));
  const toolRequest = {
    method: "POST",
    path: name === "list_items" || name === "get_item" ? "/api/assistant/items" : "/api/assistant/proposals",
    query: {
      workspaceId: args.workspace_id || args.workspaceId,
      updated_since: args.updated_since,
      cursor: args.cursor,
      limit: args.limit,
    },
    body: {
      workspaceId: args.workspace_id || args.workspaceId,
      action: args.action,
      item_id: args.item_id || args.itemId,
      fields: args.fields || args,
    },
    headers,
  };
  if (name === "get_item") {
    toolRequest.method = "GET";
    toolRequest.path = `/api/assistant/items/${encodeURIComponent(String(args.item_id || args.itemId || ""))}`;
  } else if (name === "list_items") {
    toolRequest.method = "GET";
    toolRequest.path = "/api/assistant/items";
  } else if (name === "propose_item") {
    toolRequest.method = "POST";
    toolRequest.path = "/api/assistant/proposals";
  } else {
    return {
      status: 200,
      body: { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool ${name}` } },
    };
  }
  const result = await dispatchAssistantRequest(toolRequest, { repo, env: { ASSISTANT_ACCESS_ENABLED: "1" }, now: () => now });
  if (result.status >= 400) {
    return {
      status: result.status,
      body: {
        jsonrpc: "2.0",
        id,
        error: { code: result.status, message: result.body?.error || "Tool failed", data: result.body },
      },
    };
  }
  return {
    status: 200,
    body: {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: JSON.stringify(result.body) }], structuredContent: result.body },
    },
  };
}

