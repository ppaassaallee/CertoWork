import { McpError, handleMcpAdmin, handleMcpHttp } from "./remoteCore.js";
import { createWorkerMcpRepo } from "./remoteRepo.js";

const FIREBASE_PROJECT_ID = "gen-lang-client-0277783597";
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

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
  if (parts.length !== 3) throw new McpError("unauthorized", "Sign in to manage API tokens.", 401);
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new McpError("unauthorized", "Unsupported identity token.", 401);
  const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID;
  const jwksResponse = await fetch(FIREBASE_JWKS_URL);
  if (!jwksResponse.ok) throw new McpError("unavailable", "Identity key service is unavailable.", 503);
  const jwks = await jwksResponse.json();
  const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new McpError("unauthorized", "Unknown identity signing key.", 401);
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
  if (!verified) throw new McpError("unauthorized", "Invalid identity signature.", 401);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || payload.iat > now + 60) throw new McpError("unauthorized", "Expired identity token.", 401);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || !payload.sub) {
    throw new McpError("unauthorized", "This identity token is not for Certo Work.", 401);
  }
  return { uid: payload.sub, email: payload.email || "" };
}

function corsHeaders(request) {
  return {
    "access-control-allow-origin": request.headers.get("origin") || "*",
    "access-control-allow-headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function bearer(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}

export async function handleWorkerMcp(request, env, url) {
  const path = url.pathname;
  const isMcp = path === "/mcp" || path === "/mcp/";
  const isAdmin = path === "/api/mcp/tokens" || path.startsWith("/api/mcp/tokens/");
  if (!isMcp && !isAdmin) return null;
  const headers = corsHeaders(request);
  const repo = createWorkerMcpRepo(env);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...headers, allow: "GET, POST, DELETE, OPTIONS" } });
  }
  if (!repo.configured()) {
    return jsonResponse(
      {
        code: "unavailable",
        message: "API tokens need FIREBASE_SERVICE_ACCOUNT on the worker.",
      },
      503,
      headers,
    );
  }
  try {
    if (isMcp) {
      let body = null;
      if (request.method === "POST") {
        body = await request.json().catch(() => null);
      }
      const result = await handleMcpHttp({
        repo,
        method: request.method,
        authorization: request.headers.get("authorization") || "",
        accept: request.headers.get("accept") || "",
        body,
      });
      return new Response(result.body, {
        status: result.status,
        headers: { ...headers, ...(result.headers || {}) },
      });
    }
    const user = await verifyUser(bearer(request), env);
    const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
    const result = await handleMcpAdmin({
      repo,
      method: request.method,
      path,
      body,
      user,
    });
    return jsonResponse(result.body, result.status, headers);
  } catch (error) {
    const status = error instanceof McpError ? error.status : 500;
    return jsonResponse(
      { code: error.code || "internal", message: error.message || "MCP request failed." },
      status,
      headers,
    );
  }
}
