import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import {
  createRequireWorkspaceApiAuth,
  verifyHubspotSignature,
} from "../server/middleware/auth";
import type { Request, Response } from "express";

function mockRes() {
  const result: {
    statusCode: number;
    body: unknown;
    status: (code: number) => typeof result;
    json: (body: unknown) => typeof result;
    setHeader: () => void;
  } = {
    statusCode: 200,
    body: null,
    status(code: number) {
      result.statusCode = code;
      return result;
    },
    json(body: unknown) {
      result.body = body;
      return result;
    },
    setHeader() {},
  };
  return result;
}

function mockReq(partial: Partial<Request> & { headers?: Record<string, string> }): Request {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    requestId: "test-request",
    ...partial,
  } as Request;
}

test("API auth rejects requests without a Bearer token", async () => {
  const requireAuth = createRequireWorkspaceApiAuth({
    verifyIdToken: async () => ({ uid: "u1" }),
    loadWorkspaceAccess: async () => true,
    adminAvailable: () => true,
  });
  const res = mockRes();
  let nextCalled = false;
  await requireAuth(mockReq({ headers: {} }), res as unknown as Response, () => {
    nextCalled = true;
  });
  assert.equal(res.statusCode, 401);
  assert.equal((res.body as { code: string }).code, "unauthenticated");
  assert.equal(nextCalled, false);
});

test("API auth rejects a body userId that does not match the token", async () => {
  const requireAuth = createRequireWorkspaceApiAuth({
    verifyIdToken: async () => ({ uid: "u1", email: "a@x.com" }),
    loadWorkspaceAccess: async () => true,
    adminAvailable: () => true,
  });
  const res = mockRes();
  await requireAuth(
    mockReq({
      headers: { authorization: "Bearer token" },
      body: { userId: "other", workspaceId: "ws1" },
    }),
    res as unknown as Response,
    () => {},
  );
  assert.equal(res.statusCode, 403);
  assert.equal((res.body as { code: string }).code, "forbidden");
});

test("API auth rejects a workspace the caller cannot access", async () => {
  const requireAuth = createRequireWorkspaceApiAuth({
    verifyIdToken: async () => ({ uid: "u1" }),
    loadWorkspaceAccess: async () => false,
    adminAvailable: () => true,
  });
  const res = mockRes();
  await requireAuth(
    mockReq({
      headers: { authorization: "Bearer token" },
      body: { workspaceId: "ws1" },
    }),
    res as unknown as Response,
    () => {},
  );
  assert.equal(res.statusCode, 403);
});

test("API auth stamps the verified uid onto the body", async () => {
  const requireAuth = createRequireWorkspaceApiAuth({
    verifyIdToken: async () => ({ uid: "u1", name: "Ada" }),
    loadWorkspaceAccess: async (workspaceId, uid) => workspaceId === "ws1" && uid === "u1",
    adminAvailable: () => true,
  });
  const res = mockRes();
  const req = mockReq({
    headers: { authorization: "Bearer token" },
    body: { workspaceId: "ws1", userId: "u1", prompt: "hi" },
  });
  let nextCalled = false;
  await requireAuth(req, res as unknown as Response, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.authUser?.uid, "u1");
  assert.equal(req.body.userId, "u1");
});

test("HubSpot webhook rejects unsigned requests", () => {
  const previous = process.env.HUBSPOT_WEBHOOK_SECRET;
  process.env.HUBSPOT_WEBHOOK_SECRET = "test-secret";
  const res = mockRes();
  let nextCalled = false;
  verifyHubspotSignature(
    mockReq({ body: [{ id: 1 }], rawBody: Buffer.from("[]") }),
    res as unknown as Response,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  process.env.HUBSPOT_WEBHOOK_SECRET = previous;
});

test("HubSpot webhook accepts a valid HMAC signature", () => {
  const previous = process.env.HUBSPOT_WEBHOOK_SECRET;
  process.env.HUBSPOT_WEBHOOK_SECRET = "test-secret";
  const payload = "[]";
  const signature = crypto.createHmac("sha256", "test-secret").update(payload).digest("hex");
  const res = mockRes();
  let nextCalled = false;
  verifyHubspotSignature(
    mockReq({
      headers: { "x-hubspot-signature": signature },
      body: [],
      rawBody: Buffer.from(payload),
    }),
    res as unknown as Response,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, true);
  process.env.HUBSPOT_WEBHOOK_SECRET = previous;
});
