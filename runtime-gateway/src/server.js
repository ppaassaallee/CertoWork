/**
 * Certo Runtime Gateway — private front door to Hermes.
 * Browser never calls this with Hermes secrets; Certo Worker does.
 */
import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 8787);
const HERMES_BASE_URL = String(process.env.HERMES_BASE_URL || "http://127.0.0.1:8642").replace(/\/+$/, "");
const HERMES_API_KEY = String(process.env.HERMES_API_SERVER_KEY || process.env.API_SERVER_KEY || "").trim();
const GATEWAY_TOKEN = String(process.env.CERTO_RUNTIME_GATEWAY_TOKEN || "").trim();

function requireGatewayAuth(req, res, next) {
  if (!GATEWAY_TOKEN) {
    return res.status(503).json({ error: "GATEWAY_TOKEN_NOT_CONFIGURED" });
  }
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== GATEWAY_TOKEN) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  return next();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "certo-runtime-gateway",
    hermesConfigured: Boolean(HERMES_API_KEY),
  });
});

app.get("/runtime/health", requireGatewayAuth, async (_req, res) => {
  try {
    const upstream = await fetch(`${HERMES_BASE_URL}/v1/models`, {
      headers: { authorization: `Bearer ${HERMES_API_KEY}` },
    });
    res.status(upstream.ok ? 200 : 502).json({
      hermes: upstream.ok ? "healthy" : "degraded",
      status: upstream.status,
    });
  } catch (error) {
    res.status(502).json({ hermes: "offline", error: String(error?.message || error) });
  }
});

app.post("/runtime/agents/:agentId/runs", requireGatewayAuth, async (req, res) => {
  if (!HERMES_API_KEY) {
    return res.status(503).json({ error: "HERMES_API_KEY_MISSING" });
  }
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) {
    return res.status(400).json({ error: "messages_required" });
  }
  try {
    const upstream = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${HERMES_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: req.body?.model || "hermes-agent",
        messages,
        stream: false,
      }),
    });
    const text = await upstream.text();
    res.status(upstream.status).type("application/json").send(text);
  } catch (error) {
    res.status(502).json({ error: String(error?.message || error) });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[certo-runtime-gateway] listening on 127.0.0.1:${PORT}`);
});
