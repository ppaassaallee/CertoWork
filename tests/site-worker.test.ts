import assert from "node:assert/strict";
import test from "node:test";

import worker, { firebaseAuthProxyUrl } from "../worker/index.js";

function environment(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: {
      async fetch(request: Request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/" || pathname === "/index.html") {
          return new Response("<!doctype html><title>Gazelle</title>", {
            headers: { "content-type": "text/html" },
          });
        }
        return new Response("missing", { status: 404 });
      },
    },
    ...overrides,
  };
}

test("Sites worker reports an offline-safe health state without an API key", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/health"),
    environment(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "delivereeos-codex-sites",
    aiProvider: "offline-safe",
  });
});

test("Firebase auth helpers are resolved through the legacy Firebase host", () => {
  assert.equal(
    firebaseAuthProxyUrl(
      "https://gazelle-boldr-ai.boldrai-3640.chatgpt.site/__/auth/handler?providerId=google.com",
    ),
    "https://gen-lang-client-0277783597.firebaseapp.com/__/auth/handler?providerId=google.com",
  );
});

test("Sites worker truthfully disables Google AI Studio", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/capabilities"),
    environment(),
  );
  const body = (await response.json()) as any;
  assert.equal(body.gemini.configured, false);
  assert.match(body.gemini.description, /not used/i);
  assert.equal(body.activeAIProvider.configured, false);
});

test("Sites worker exposes the signed-in platform identity for the migration path", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/session", {
      headers: {
        "oai-authenticated-user-id": "sites-user-1",
        "oai-authenticated-user-email": "alejandro@getboldr.ai",
        "oai-authenticated-user-full-name": "Alejandro%20Pascual",
        "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
      },
    }),
    environment(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: true,
    provider: "codex-sites",
    user: {
      id: "sites-user-1",
      email: "alejandro@getboldr.ai",
      name: "Alejandro Pascual",
    },
  });
});

test("Sites session endpoint rejects anonymous requests", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/session"),
    environment(),
  );
  assert.equal(response.status, 401);
});

test("Sites worker preserves client-side routes through the SPA fallback", async () => {
  const requestedPaths: string[] = [];
  const env = environment({
    ASSETS: {
      async fetch(request: Request) {
        const url = new URL(request.url);
        requestedPaths.push(`${url.pathname}${url.search}`);
        if (url.pathname === "/" && url.searchParams.get("gazelle-spa") === "1") {
          return new Response("<!doctype html><title>Gazelle</title>", {
            headers: { "content-type": "text/html" },
          });
        }
        return Response.redirect("https://gazelle.test/", 307);
      },
    },
  });
  const response = await worker.fetch(
    new Request("https://gazelle.test/work/projects", {
      headers: { accept: "text/html" },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Gazelle/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(requestedPaths, ["/?gazelle-spa=1"]);
});

test("Boldi compatibility route rejects unauthenticated requests", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/boldi/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        workspaceId: "workspace-1",
        messages: [{ role: "user", content: "Plan my week" }],
      }),
    }),
    environment(),
  );
  assert.equal(response.status, 401);
});
