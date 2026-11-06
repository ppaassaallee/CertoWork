import type { Express, Request, Response } from "express";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { handleMcpAdmin, handleMcpHttp, McpError } from "../../worker/mcp/remoteCore.js";
import { createMcpRepository } from "../mcpRepository";
import { handleRunOwner } from "../../worker/mcp/runWorkflow.js";
import type { Firestore } from "firebase-admin/firestore";

function sendPacked(res: Response, result: { status: number; headers?: Record<string, string>; body: string }) {
  res.status(result.status);
  for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
  if (!result.body) return res.end();
  return res.send(result.body);
}

export function registerMcpRoutes(
  app: Express,
  deps: { getDb: () => { collection: (name: string) => any;runTransaction?:Firestore["runTransaction"] } | null | undefined },
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
  app.use("/api/run/agent",async(req:Request,res:Response)=>{
    try {
      const db=deps.getDb();
      if(!db)return res.status(503).json({code:"unavailable",message:"Firebase Admin is not configured."});
      const match=String(req.headers.authorization||"").match(/^Bearer\s+(\S+)$/i);
      if(!match)return res.status(401).json({code:"unauthorized"});
      const decoded=await getAdminAuth().verifyIdToken(match[1]);
      const url=new URL(req.originalUrl,"http://localhost");
      const expected=url.pathname==="/api/run/agent/review"?"POST":"GET";
      if(req.method!==expected)return res.status(405).json({code:"method_not_allowed"});
      const result=await handleRunOwner(createMcpRepository(db),{uid:decoded.uid,email:decoded.email||"",emailVerified:decoded.email_verified===true},url.pathname,req.method==="GET"?Object.fromEntries(url.searchParams):req.body);
      res.setHeader("cache-control","no-store");
      return res.json(result);
    }catch(error){
      const failure=error as Error&{status?:number;code?:string};
      return res.status(failure.status||401).json({code:failure.code||"unauthorized",message:failure.message});
    }
  });

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
        user: { uid: decoded.uid, email: decoded.email || "", emailVerified:decoded.email_verified===true },
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
