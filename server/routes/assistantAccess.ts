import type { Express, Request, Response } from "express";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { dispatchAssistantRequest } from "../../worker/assistantAccessCore.js";
import { createFirestoreAssistantRepo } from "../assistantRepository";

export function registerAssistantAccessRoutes(
  app: Express,
  deps: {
    getDb: () => any;
    loadWorkspaceAccess: (workspaceId: string, uid: string) => Promise<boolean>;
  },
) {
  app.use("/api/assistant", async (req: Request, res: Response) => {
    const db = deps.getDb();
    const url = new URL(req.originalUrl, "http://localhost");
    const query = Object.fromEntries(url.searchParams.entries());
    const result = await dispatchAssistantRequest(
      {
        method: req.method,
        path: url.pathname,
        query,
        body: req.body,
        headers: { authorization: String(req.headers.authorization || "") },
      },
      {
        env: process.env,
        repo: db
          ? createFirestoreAssistantRepo(db, (userId, workspaceId) =>
              deps.loadWorkspaceAccess(workspaceId, userId),
            )
          : null,
        verifyUser: async (token: string) => {
          const decoded = await getAdminAuth().verifyIdToken(token);
          return { uid: decoded.uid, email: decoded.email || "" };
        },
      },
    );
    res.status(result.status).json(result.body);
  });
}
