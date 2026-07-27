import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker/index.js";

function environment(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: {
      async fetch(request: Request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/index.html") {
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
    service: "gazelle-codex-sites",
    aiProvider: "offline-safe",
  });
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

test("Sites worker preserves client-side routes through the SPA fallback", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/work/projects", {
      headers: { accept: "text/html" },
    }),
    environment(),
  );
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Gazelle/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
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
