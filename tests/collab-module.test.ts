import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { lensToPath, resolveDelivereeLens } from "../src/lib/delivereeRoutes";
import { mobileCoreFallbackPath } from "../src/lib/mobileCore";
import {
  chatwootOrigin,
  isCollabPath,
  isConfiguredCollab,
  productFromPath,
  productHomePath,
} from "../src/lib/collabModule";
import { collabStatusPayload, provisionCollabSso } from "../worker/collab.js";

test("Chat Collab is a separate lens from work surfaces", () => {
  assert.deepEqual(resolveDelivereeLens("/collab"), { kind: "collab" });
  assert.deepEqual(resolveDelivereeLens("/collab/c/12"), { kind: "collab" });
  assert.equal(lensToPath({ kind: "collab" }), "/collab");
  assert.equal(isCollabPath("/collab"), true);
  assert.equal(isCollabPath("/home"), false);
  assert.equal(productFromPath("/projects"), "work");
  assert.equal(productFromPath("/collab"), "collab");
  assert.equal(productHomePath("work"), "/home");
  assert.equal(productHomePath("collab"), "/collab");
});

test("mobile core does not bounce Chat Collab back to Home", () => {
  assert.equal(mobileCoreFallbackPath("/collab"), null);
  assert.equal(mobileCoreFallbackPath("/home"), null);
});

test("collab status never exposes the Chatwoot platform token", () => {
  assert.deepEqual(collabStatusPayload({}), {
    configured: false,
    origin: "",
    accountId: "",
    ready: false,
  });
  const payload = collabStatusPayload({
    CHATWOOT_URL: "https://collab.certo.work/",
    CHATWOOT_PLATFORM_TOKEN: "secret-token",
    CHATWOOT_ACCOUNT_ID: "42",
  });
  assert.equal(payload.configured, true);
  assert.equal(payload.origin, "https://collab.certo.work");
  assert.equal(payload.accountId, "42");
  assert.equal(JSON.stringify(payload).includes("secret-token"), false);
  assert.equal(isConfiguredCollab(payload), true);
  assert.equal(chatwootOrigin("https://collab.certo.work/"), "https://collab.certo.work");
});

test("SSO provisions a Chatwoot agent and returns a login url", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url);
    calls.push(`${init?.method || "GET"} ${path}`);
    if (path.endsWith("/platform/api/v1/users") && init?.method === "POST") {
      return Response.json({ id: 9, email: "ana@certo.work" });
    }
    if (path.includes("/account_users")) {
      return Response.json({ user_id: 9, role: "agent" });
    }
    if (path.endsWith("/login")) {
      return Response.json({
        url: "https://collab.certo.work/app/login?email=ana%40certo.work&sso_auth_token=abc",
      });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }) as typeof fetch;
  try {
    const result = await provisionCollabSso(
      {
        CHATWOOT_URL: "https://collab.certo.work",
        CHATWOOT_PLATFORM_TOKEN: "tok",
        CHATWOOT_ACCOUNT_ID: "7",
      },
      { email: "ana@certo.work", displayName: "Ana", userId: "uid-1", workspaceId: "ws-1" },
    );
    assert.match(result.url, /sso_auth_token=abc/);
    assert.equal(result.userId, 9);
    assert.equal(calls[0], "POST https://collab.certo.work/platform/api/v1/users");
    assert.equal(calls[1], "POST https://collab.certo.work/platform/api/v1/accounts/7/account_users");
    assert.equal(calls[2], "GET https://collab.certo.work/platform/api/v1/users/9/login");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live shell mounts Chat Collab as a separate product", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const collab = readFileSync(resolve("src/components/ChatCollabModule.tsx"), "utf8");
  assert.match(workspace, /ProductSwitcher/);
  assert.match(workspace, /ChatCollabModule/);
  assert.match(workspace, /data-testid="header-collab"/);
  assert.match(workspace, /nav-collab/);
  assert.match(collab, /data-testid="chat-collab-module"/);
  assert.match(collab, /data-testid="chat-collab-setup"/);
  assert.match(collab, /data-testid="chat-collab-frame"/);
});
