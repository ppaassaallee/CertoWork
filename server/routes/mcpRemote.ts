import type { Express, Request, Response } from "express";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { handleMcpAdmin, handleMcpHttp, McpError } from "../../worker/mcp/remoteCore.js";
import { createMcpRepository } from "../mcpRepository";

function sendPacked(res: Response, result: { status: number; headers?: Record<string, string>; body: string }) {
  res.status(result.status);
  for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
  if (!result.body) return res.end();
  return res.send(result.body);
}

export function registerMcpRoutes(
  app: Express,
  deps: { getDb: () => { collection: (name: string) => any } | null | undefined },
) {
  const serve = async (req: Request, res: Response) => {
    const db = deps.getDb();
    if (!db) {
      return res.status(503).json({
        code: "unavailable",
        message: "API tokens need the Firebase admin credential on this server.",
      });
    }
    try {
      const result = await handleMcpHttp({
        repo: createMcpRepository(db),
        method: req.method,
        authorization: String(req.headers.authorization || ""),
        accept: String(req.headers.accept || ""),
        body: req.method === "POST" ? req.body : null,
      });
      return sendPacked(res, result);
    } catch (error) {
      const status = error instanceof McpError ? error.status : 500;
      const code = error instanceof McpError ? error.code : "internal";
      return res.status(status).json({ code, message: error instanceof Error ? error.message : "MCP request failed." });
    }
  };

  app.options("/mcp", serve);
  app.get("/mcp", serve);
  app.post("/mcp", serve);
  app.delete("/mcp", serve);

  app.use("/api/mcp/tokens", async (req: Request, res: Response) => {
    const db = deps.getDb();
    if (!db) {
      return res.status(503).json({
        code: "unavailable",
        message: "API tokens need the Firebase admin credential on this server.",
      });
    }
    try {
      const header = String(req.headers.authorization || "");
      const match = header.match(/^Bearer\s+(\S+)$/i);
      if (!match) {
        return res.status(401).json({ code: "unauthorized", message: "Sign in to manage API tokens." });
      }
      const decoded = await getAdminAuth().verifyIdToken(match[1]);
      const url = new URL(req.originalUrl, "http://localhost");
      const result = await handleMcpAdmin({
        repo: createMcpRepository(db),
        method: req.method,
        path: url.pathname,
        body: req.body,
        user: { uid: decoded.uid, email: decoded.email || "" },
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      const status = error instanceof McpError ? error.status : 401;
      const code = error instanceof McpError ? error.code : "unauthorized";
      return res.status(status).json({
        code,
        message: error instanceof Error ? error.message : "Could not manage API tokens.",
      });
    }
  });
}
