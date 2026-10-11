import {
  assistantAccessEnabled,
  dispatchAssistantRequest,
  generateId,
  ITEM_FETCH_CAP,
} from "./assistantAccessCore.js";
import {
  firestoreGetDocument,
  firestoreRunQuery,
  firestoreUpsertDocument,
  firestorePatchDocument,
} from "./firestoreAdmin.js";

const FIREBASE_PROJECT_ID = "gen-lang-client-0277783597";
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const TOKENS = "assistant_access_tokens";
const PROPOSALS = "assistant_proposals";
const AUDITS = "assistant_audit_events";

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function verifyUser(token, env) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed identity token");
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported identity token");
  const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID;
  const jwksResponse = await fetch(FIREBASE_JWKS_URL);
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
  if (!payload.sub) throw new Error("Identity is missing a subject");
  return { uid: payload.sub, email: payload.email || "" };
}

function equalFilter(field, value) {
  return {
    fieldFilter: {
      field: { fieldPath: field },
      op: "EQUAL",
      value: { stringValue: value },
    },
  };
}

async function queryEqual(env, collectionId, field, value, limit) {
  const result = await firestoreRunQuery(env, {
    from: [{ collectionId }],
    where: equalFilter(field, value),
    limit,
  });
  if (!result.ok) {
    const error = new Error(result.reason || "Assistant storage is unavailable");
    error.status = 503;
    error.code = "unavailable";
    throw error;
  }
  return result.documents;
}

function withTaskStamps(data) {
  const next = { ...data };
  for (const key of ["createdAt", "updatedAt"]) {
    if (typeof next[key] === "string" && Number.isFinite(Date.parse(next[key]))) {
      next[key] = new Date(next[key]);
    }
  }
  return next;
}

export function createWorkerAssistantRepo(env) {
  return {
    async isMember(userId, workspaceId) {
      const [workspace, member] = await Promise.all([
        firestoreGetDocument(env, "workspaces", workspaceId),
        firestoreGetDocument(env, "workspace_members", `${workspaceId}_${userId}`),
      ]);
      const owner = workspace && workspace.ownerId === userId;
      const active = member && String(member.status || "") === "active";
      return Boolean(owner || active);
    },
    listTokensForUser(userId) {
      return queryEqual(env, TOKENS, "userId", userId, 50);
    },
    async saveToken(record) {
      const { id, ...data } = record;
      const saved = await firestoreUpsertDocument(env, TOKENS, id, data);
      if (!saved.ok) throw new Error(saved.reason || "Could not save token");
    },
    getToken(id) {
      return firestoreGetDocument(env, TOKENS, id);
    },
    async findTokenByHash(hash) {
      const rows = await queryEqual(env, TOKENS, "tokenHash", hash, 2);
      return rows.length === 1 ? rows[0] : null;
    },
    async patchToken(id, patch) {
      const saved = await firestorePatchDocument(env, TOKENS, id, patch);
      if (!saved.ok) throw new Error(saved.reason || "Could not update token");
    },
    listItems(workspaceId) {
      return queryEqual(env, "tasks", "workspaceId", workspaceId, ITEM_FETCH_CAP);
    },
    async getItem(workspaceId, itemId) {
      const item = await firestoreGetDocument(env, "tasks", itemId);
      if (!item || String(item.workspaceId || "") !== workspaceId) return null;
      return item;
    },
    listTags(workspaceId) {
      return queryEqual(env, "categories", "workspaceId", workspaceId, 500);
    },
    async saveProposal(record) {
      const { id, ...data } = record;
      const saved = await firestoreUpsertDocument(env, PROPOSALS, id, data);
      if (!saved.ok) throw new Error(saved.reason || "Could not save proposal");
    },
    listProposals(userId) {
      return queryEqual(env, PROPOSALS, "userId", userId, 200);
    },
    getProposal(id) {
      return firestoreGetDocument(env, PROPOSALS, id);
    },
    async patchProposal(id, patch) {
      const saved = await firestorePatchDocument(env, PROPOSALS, id, patch);
      if (!saved.ok) throw new Error(saved.reason || "Could not update proposal");
    },
    async createItem(data) {
      const id = generateId("task").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
      const saved = await firestoreUpsertDocument(env, "tasks", id, withTaskStamps(data));
      if (!saved.ok) throw new Error(saved.reason || "Could not create item");
      return { id };
    },
    async updateItem(workspaceId, itemId, patch) {
      const existing = await firestoreGetDocument(env, "tasks", itemId);
      if (!existing || String(existing.workspaceId || "") !== workspaceId) {
        const error = new Error("Item not found");
        error.status = 404;
        error.code = "not_found";
        throw error;
      }
      const saved = await firestorePatchDocument(env, "tasks", itemId, withTaskStamps(patch));
      if (!saved.ok) throw new Error(saved.reason || "Could not update item");
    },
    async writeAudit(event) {
      const { id, ...data } = event;
      const saved = await firestoreUpsertDocument(env, AUDITS, id, data);
      if (!saved.ok) throw new Error(saved.reason || "Could not write audit");
    },
  };
}

export async function handleAssistantWorkerRequest(request, env, url) {
  if (!assistantAccessEnabled(env)) {
    return {
      status: 404,
      body: { error: "Assistant access is disabled", code: "assistant_access_disabled" },
    };
  }
  let body = {};
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.json().catch(() => ({}));
  }
  return dispatchAssistantRequest(
    {
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
      headers: { authorization: request.headers.get("authorization") || "" },
    },
    {
      env,
      repo: createWorkerAssistantRepo(env),
      verifyUser: (token) => verifyUser(token, env),
    },
  );
}
