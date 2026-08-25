export function chatwootConfig(env = {}) {
  const origin = String(env.CHATWOOT_URL || "").trim().replace(/\/+$/, "");
  const token = String(env.CHATWOOT_PLATFORM_TOKEN || "").trim();
  const accountId = String(env.CHATWOOT_ACCOUNT_ID || "").trim();
  return {
    origin,
    token,
    accountId,
    configured: Boolean(origin && token && accountId),
  };
}

export function publicOriginFrom(value) {
  try {
    return new URL(value).origin;
  } catch {
    return String(value || "").replace(/\/+$/, "");
  }
}

export function collabStatusPayload(env = {}, publicOrigin = "") {
  const { accountId, configured } = chatwootConfig(env);
  return {
    configured,
    origin: configured ? publicOriginFrom(publicOrigin) : "",
    accountId: configured ? accountId : "",
    ready: configured,
    mount: "same-origin",
  };
}

const CHATWOOT_EXACT_PATHS = new Set(["/app", "/auth", "/cable", "/widget", "/survey", "/packs", "/vite"]);
const CHATWOOT_PREFIXES = [
  "/app/",
  "/auth/",
  "/cable/",
  "/api/v1/",
  "/api/v2/",
  "/platform/api/",
  "/survey/",
  "/packs/",
  "/vite/",
  "/vite-dev/",
  "/rails/",
  "/omniauth/",
  "/super_admin/",
  "/installation/",
  "/hc/",
  "/webhooks/",
  "/monitoring/",
  "/public/api/",
  "/swagger/",
  "/audio/",
];

export function isChatwootProxyPath(pathname) {
  const path = String(pathname || "/");
  if (path === "/__/auth" || path.startsWith("/__/auth/")) return false;
  if (path === "/api/collab" || path.startsWith("/api/collab/")) return false;
  if (path === "/api/widget" || path.startsWith("/api/widget/")) return false;
  if (path.startsWith("/widget/")) return false;
  if (CHATWOOT_EXACT_PATHS.has(path) || path === "/swagger") return true;
  return CHATWOOT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function rewriteChatwootPublicUrl(value, backendOrigin, publicOrigin) {
  const source = String(value ?? "");
  if (!source) return source;
  let fromHost = "";
  let toOrigin = "";
  let toHost = "";
  try {
    fromHost = new URL(backendOrigin).host;
  } catch {
    return source;
  }
  try {
    const next = new URL(publicOrigin);
    toOrigin = next.origin;
    toHost = next.host;
  } catch {
    return source;
  }
  if (!fromHost || !toHost || fromHost === toHost) return source;
  const toWs = toOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  return source
    .split(`https://${fromHost}`).join(toOrigin)
    .split(`http://${fromHost}`).join(toOrigin)
    .split(`wss://${fromHost}`).join(toWs)
    .split(`ws://${fromHost}`).join(toWs);
}

export function rewriteChatwootLocation(location, backendOrigin, publicOrigin) {
  if (!location) return location;
  const siteOrigin = publicOriginFrom(publicOrigin);
  try {
    const next = new URL(location, `${siteOrigin}/`);
    let backendHost = "";
    try {
      backendHost = new URL(backendOrigin).host;
    } catch {
      backendHost = "";
    }
    if (backendHost && next.host === backendHost) {
      return `${siteOrigin}${next.pathname}${next.search}${next.hash}`;
    }
    if (siteOrigin && next.origin === siteOrigin) {
      return `${next.origin}${next.pathname}${next.search}${next.hash}`;
    }
  } catch {
    // Keep the original header if it is not a valid URL.
  }
  return rewriteChatwootPublicUrl(location, backendOrigin, publicOrigin) || location;
}

export function rewriteChatwootCookie(cookie) {
  return String(cookie || "").replace(/;\s*domain=[^;]*/gi, "");
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "x");
  return `Cw.${raw}9!`;
}

async function chatwootRequest(env, path, { method = "GET", body, accessToken } = {}) {
  const { origin, token } = chatwootConfig(env);
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      api_access_token: accessToken || token,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Chatwoot ${method} ${path} failed`;
    throw new Error(message);
  }
  return payload;
}

export function projectRoomIdentifier(projectId) {
  return `certo:project:${String(projectId || "").trim()}`;
}

export function projectRoomName(name) {
  const title = String(name || "Project").trim() || "Project";
  return `Room · ${title}`.slice(0, 80);
}

export function normalizeCollabProjects(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const projects = [];
  for (const item of input) {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    projects.push({
      id,
      name: String(item?.name || item?.title || "Project").trim() || "Project",
    });
    if (projects.length >= 40) break;
  }
  return projects;
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.payload)) return payload.payload;
  if (Array.isArray(payload?.data?.payload)) return payload.data.payload;
  return [];
}

function conversationDisplayId(conversation) {
  return conversation?.display_id || conversation?.id || conversation?.payload?.display_id || "";
}

export function projectRoomPath(accountId, conversation) {
  const displayId = conversationDisplayId(conversation);
  if (!accountId || !displayId) return "";
  return `/app/accounts/${accountId}/conversations/${displayId}`;
}

async function ensureProjectInbox(env, accessToken, accountId, project) {
  const inboxes = asList(await chatwootRequest(env, `/api/v1/accounts/${accountId}/inboxes`, { accessToken }));
  const existing = inboxes.find((inbox) => {
    const attrs = inbox?.additional_attributes || inbox?.channel?.additional_attributes || {};
    return attrs.certoProjectId === project.id || inbox?.name === projectRoomName(project.name);
  });
  if (existing?.id) return existing;
  const created = await chatwootRequest(env, `/api/v1/accounts/${accountId}/inboxes`, {
    method: "POST",
    accessToken,
    body: {
      name: projectRoomName(project.name),
      enable_auto_assignment: false,
      additional_attributes: { certoProjectId: project.id, certoRoom: true },
      channel: {
        type: "api",
        webhook_url: "",
        hmac_mandatory: false,
        additional_attributes: { certoProjectId: project.id },
      },
    },
  });
  return created?.payload || created;
}

async function ensureProjectContact(env, accessToken, accountId, inboxId, project) {
  const identifier = projectRoomIdentifier(project.id);
  const search = asList(
    await chatwootRequest(
      env,
      `/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(identifier)}`,
      { accessToken },
    ),
  );
  const existing = search.find((contact) => contact?.identifier === identifier);
  if (existing?.id) return existing;
  const created = await chatwootRequest(env, `/api/v1/accounts/${accountId}/contacts`, {
    method: "POST",
    accessToken,
    body: {
      inbox_id: inboxId,
      name: project.name,
      identifier,
      custom_attributes: { certoProjectId: project.id },
    },
  });
  return created?.payload?.contact || created?.payload || created;
}

async function ensureProjectConversation(env, accessToken, accountId, inboxId, contactId, project) {
  const conversations = asList(
    await chatwootRequest(env, `/api/v1/accounts/${accountId}/conversations?inbox_id=${inboxId}`, {
      accessToken,
    }),
  );
  if (conversations[0]) return conversations[0];
  const created = await chatwootRequest(env, `/api/v1/accounts/${accountId}/conversations`, {
    method: "POST",
    accessToken,
    body: {
      inbox_id: inboxId,
      contact_id: contactId,
      source_id: projectRoomIdentifier(project.id),
      status: "open",
      additional_attributes: { certoProjectId: project.id },
      message: { content: `Project room for ${project.name}`, private: true },
    },
  });
  return created?.payload || created;
}

export async function syncProjectRooms(env, { accessToken, accountId, projects, publicOrigin }) {
  const siteOrigin = publicOriginFrom(publicOrigin);
  const rooms = [];
  for (const project of normalizeCollabProjects(projects)) {
    const inbox = await ensureProjectInbox(env, accessToken, accountId, project);
    const inboxId = inbox?.id;
    if (!inboxId) continue;
    const contact = await ensureProjectContact(env, accessToken, accountId, inboxId, project);
    const contactId = contact?.id;
    if (!contactId) continue;
    const conversation = await ensureProjectConversation(
      env,
      accessToken,
      accountId,
      inboxId,
      contactId,
      project,
    );
    const path = projectRoomPath(accountId, conversation);
    rooms.push({
      projectId: project.id,
      name: project.name,
      inboxId,
      conversationId: conversationDisplayId(conversation),
      path,
      url: path && siteOrigin ? `${siteOrigin}${path}` : "",
    });
  }
  return rooms;
}

export async function provisionCollabSso(env, input, publicOrigin = "") {
  const config = chatwootConfig(env);
  if (!config.configured) {
    const error = new Error("Chat Collab is not configured.");
    error.status = 503;
    error.configured = false;
    throw error;
  }
  const email = String(input.email || "").trim().toLowerCase();
  const displayName = String(input.displayName || email || "Certo Work").trim();
  if (!email) {
    const error = new Error("A signed-in email is required for Chat Collab.");
    error.status = 400;
    throw error;
  }

  const user = await chatwootRequest(env, "/platform/api/v1/users", {
    method: "POST",
    body: {
      name: displayName,
      display_name: displayName,
      email,
      password: randomPassword(),
      custom_attributes: {
        certoUserId: input.userId || "",
        certoWorkspaceId: input.workspaceId || "",
      },
    },
  });
  const userId = user?.id;
  if (!userId) throw new Error("Chatwoot did not return a user.");

  await chatwootRequest(env, `/platform/api/v1/accounts/${config.accountId}/account_users`, {
    method: "POST",
    body: { user_id: userId, role: "administrator" },
  });

  const login = await chatwootRequest(env, `/platform/api/v1/users/${userId}/login`);
  if (!login?.url) throw new Error("Chatwoot did not return a sign-in link.");
  const siteOrigin = publicOriginFrom(publicOrigin);
  const url = rewriteChatwootLocation(login.url, config.origin, siteOrigin || config.origin);

  let rooms = [];
  const selectedProjectId = String(input.projectId || "").trim();
  try {
    const tokenPayload = await chatwootRequest(env, `/platform/api/v1/users/${userId}/token`, {
      method: "POST",
    });
    const accessToken = tokenPayload?.access_token;
    if (accessToken) {
      rooms = await syncProjectRooms(env, {
        accessToken,
        accountId: config.accountId,
        projects: input.projects,
        publicOrigin: siteOrigin,
      });
    }
  } catch {
    rooms = [];
  }

  const selected = rooms.find((room) => room.projectId === selectedProjectId) || rooms[0] || null;
  return {
    url,
    userId,
    rooms,
    roomUrl: selected?.url || "",
  };
}

function shouldRewriteChatwootBody(contentType) {
  const type = String(contentType || "").toLowerCase();
  return (
    type.includes("text/html") ||
    type.includes("application/json") ||
    type.includes("javascript") ||
    type.includes("text/css") ||
    type.includes("application/xml") ||
    type.includes("text/plain")
  );
}

export async function proxyChatwoot(request, env) {
  const config = chatwootConfig(env);
  const incoming = new URL(request.url);
  if (!config.origin) {
    return new Response(JSON.stringify({ error: "Chat Collab backend is not configured." }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  let backend;
  try {
    backend = new URL(config.origin);
  } catch {
    return new Response(JSON.stringify({ error: "Chat Collab backend origin is invalid." }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const upstream = new URL(request.url);
  upstream.protocol = backend.protocol;
  upstream.host = backend.host;

  const headers = new Headers(request.headers);
  headers.delete("cf-connecting-ip");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) headers.set("x-forwarded-for", clientIp);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstream.toString(), init);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Chat Collab backend is unreachable.",
      }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      },
    );
  }

  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return upstreamResponse;
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  const location = responseHeaders.get("location");
  if (location) {
    responseHeaders.set("location", rewriteChatwootLocation(location, config.origin, incoming.origin));
  }
  if (typeof responseHeaders.getSetCookie === "function") {
    const cookies = responseHeaders.getSetCookie();
    if (cookies.length) {
      responseHeaders.delete("set-cookie");
      for (const cookie of cookies) {
        responseHeaders.append("set-cookie", rewriteChatwootCookie(cookie));
      }
    }
  }
  responseHeaders.set("x-frame-options", "SAMEORIGIN");
  responseHeaders.delete("content-security-policy");

  const contentType = responseHeaders.get("content-type") || "";
  const contentLength = Number(responseHeaders.get("content-length") || 0);
  if (!shouldRewriteChatwootBody(contentType) || contentLength > 2_000_000) {
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  }

  const text = await upstreamResponse.text();
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  return new Response(rewriteChatwootPublicUrl(text, config.origin, incoming.origin), {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
