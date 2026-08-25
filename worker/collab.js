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

async function chatwootRequest(env, path, { method = "GET", body } = {}) {
  const { origin, token } = chatwootConfig(env);
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      api_access_token: token,
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
    body: { user_id: userId, role: "agent" },
  });

  const login = await chatwootRequest(env, `/platform/api/v1/users/${userId}/login`);
  if (!login?.url) throw new Error("Chatwoot did not return a sign-in link.");
  const siteOrigin = publicOriginFrom(publicOrigin);
  return {
    url: rewriteChatwootLocation(login.url, config.origin, siteOrigin || config.origin),
    userId,
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
