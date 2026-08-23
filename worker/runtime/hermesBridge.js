import { executeCertoMcpTool } from "../mcp/certoMcp.js";

export function hermesRuntimeEnabled(env = {}) {
  const flag = String(env.CERTO_HERMES_RUNTIME || env.HERMES_RUNTIME || "")
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/**
 * Optional Hermes path for Odysseus. Default remains legacy odiseus-agent loop.
 * When enabled and Hermes is reachable, returns assistant content; otherwise null.
 */
/** Normalize Hermes base URL: strip trailing slash and accidental `/v1` suffix. */
export function normalizeHermesBaseUrl(raw) {
  return String(raw || "http://127.0.0.1:8642")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/v1$/i, "");
}

export async function tryHermesChat(env, { messages, agentId = "odysseus", traceId }) {
  if (!hermesRuntimeEnabled(env)) return null;
  const baseUrl = normalizeHermesBaseUrl(env.HERMES_BASE_URL || "http://127.0.0.1:8642");
  const apiKey = String(env.HERMES_API_SERVER_KEY || env.API_SERVER_KEY || "").trim();
  if (!apiKey) return { error: "HERMES_API_KEY_MISSING" };

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "hermes-agent",
      messages: messages || [],
      stream: false,
      metadata: { agentId, traceId },
    }),
  });
  if (!res.ok) {
    return { error: `HERMES_${res.status}`, body: await res.text() };
  }
  const raw = await res.json();
  return {
    id: raw?.id,
    content: raw?.choices?.[0]?.message?.content || "",
    usage: raw?.usage,
  };
}

export { executeCertoMcpTool };
