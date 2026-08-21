import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

export type AuthPrincipal = {
  uid: string;
  email?: string;
  name?: string;
  workspaceId: string;
};

export type TokenClaims = {
  uid: string;
  email?: string;
  name?: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthPrincipal;
      requestId?: string;
      rawBody?: Buffer;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}

export function principalDisplayName(req: Request) {
  const name = String(req.authUser?.name || "").trim();
  if (name) return name.split(/\s+/)[0];
  const email = String(req.authUser?.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "there";
}

export function requestedWorkspaceId(req: Request) {
  return String(
    req.params?.workspaceId ||
      req.body?.workspaceId ||
      req.body?.workspaceContext?.workspaceId ||
      req.query?.workspaceId ||
      "",
  ).trim();
}

export function createRequireWorkspaceApiAuth(deps: {
  verifyIdToken: (token: string) => Promise<TokenClaims>;
  loadWorkspaceAccess: (workspaceId: string, uid: string) => Promise<boolean>;
  adminAvailable: () => boolean;
}) {
  return async function requireWorkspaceApiAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const authorization = String(req.headers.authorization || "");
      if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Authentication required",
          code: "unauthenticated",
          requestId: req.requestId,
        });
      }
      const decoded = await deps.verifyIdToken(authorization.slice(7));
      const bodyUserId = req.body?.userId || req.body?.workspaceContext?.userId;
      if (bodyUserId && String(bodyUserId) !== decoded.uid) {
        return res.status(403).json({
          error: "User scope mismatch",
          code: "forbidden",
          requestId: req.requestId,
        });
      }
      const workspaceId = requestedWorkspaceId(req);
      if (!workspaceId) {
        return res.status(400).json({
          error: "workspaceId is required",
          code: "invalid_request",
          requestId: req.requestId,
        });
      }
      if (!deps.adminAvailable()) {
        return res.status(503).json({
          error: "Workspace authorization is unavailable",
          code: "unavailable",
          requestId: req.requestId,
        });
      }
      const allowed = await deps.loadWorkspaceAccess(workspaceId, decoded.uid);
      if (!allowed) {
        return res.status(403).json({
          error: "Workspace access denied",
          code: "forbidden",
          requestId: req.requestId,
        });
      }
      req.authUser = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        workspaceId,
      };
      if (req.body && typeof req.body === "object") {
        req.body.userId = decoded.uid;
        req.body.workspaceId = workspaceId;
        if (req.body.workspaceContext && typeof req.body.workspaceContext === "object") {
          req.body.workspaceContext.userId = decoded.uid;
          req.body.workspaceContext.workspaceId = workspaceId;
        }
      }
      next();
    } catch {
      res.status(401).json({
        error: "Invalid or expired authentication",
        code: "unauthenticated",
        requestId: req.requestId,
      });
    }
  };
}

export function verifyHubspotSignature(req: Request, res: Response, next: NextFunction) {
  const secret = String(process.env.HUBSPOT_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    return res.status(401).json({
      error: "Webhook signature is required",
      code: "unauthenticated",
      requestId: req.requestId,
    });
  }
  const header = String(
    req.headers["x-hubspot-signature-v3"] || req.headers["x-hubspot-signature"] || "",
  ).trim();
  if (!header) {
    return res.status(401).json({
      error: "Missing webhook signature",
      code: "unauthenticated",
      requestId: req.requestId,
    });
  }
  const provided = header.replace(/^sha256=/i, "");
  const payload = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || "");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return res.status(401).json({
      error: "Invalid webhook signature",
      code: "unauthenticated",
      requestId: req.requestId,
    });
  }
  next();
}
