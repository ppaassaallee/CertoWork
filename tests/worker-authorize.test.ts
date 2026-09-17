import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  authorize,
  enforceRateLimit,
  platformIdentity,
  signPlatformIdentityPayload,
} from "../worker/index.js";

const SECRET = "unit-test-platform-secret";

async function signedHeaders(id: string, email: string, secret = SECRET, timestamp = Date.now()) {
  const signature = await signPlatformIdentityPayload(secret, { id, email, timestamp });
  return {
    "oai-authenticated-user-id": id,
    "oai-authenticated-user-email": email,
    "oai-authenticated-user-timestamp": String(timestamp),
    "oai-authenticated-user-signature": signature,
  };
}

test("platformIdentity ignores unsigned oai-* headers even when a secret is configured", async () => {
  const request = new Request("https://gazelle.test/api/session", {
    headers: {
      "oai-authenticated-user-id": "spoof",
      "oai-authenticated-user-email": "a@b.com",
    },
  });
  assert.equal(await platformIdentity(request, { PLATFORM_IDENTITY_SECRET: SECRET }), null);
});

test("platformIdentity ignores oai-* headers when PLATFORM_IDENTITY_SECRET is unset", async () => {
  const headers = await signedHeaders("user-1", "a@b.com");
  const request = new Request("https://gazelle.test/api/session", { headers });
  assert.equal(await platformIdentity(request, {}), null);
});

test("platformIdentity accepts a valid HMAC signature", async () => {
  const headers = await signedHeaders("user-1", "a@b.com");
  const request = new Request("https://gazelle.test/api/session", { headers });
  assert.deepEqual(await platformIdentity(request, { PLATFORM_IDENTITY_SECRET: SECRET }), {
    id: "user-1",
    email: "a@b.com",
    name: "",
  });
});

test("platformIdentity rejects expired timestamps", async () => {
  const headers = await signedHeaders("user-1", "a@b.com", SECRET, Date.now() - 10 * 60_000);
  const request = new Request("https://gazelle.test/api/session", { headers });
  assert.equal(await platformIdentity(request, { PLATFORM_IDENTITY_SECRET: SECRET }), null);
});

test("authorize refuses unsigned platform identity and requires Bearer", async () => {
  const request = new Request("https://gazelle.test/api/boldi/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "spoof",
    },
    body: "{}",
  });
  await assert.rejects(
    () => authorize(request, { userId: "spoof" }, { PLATFORM_IDENTITY_SECRET: SECRET }),
    /Authentication required/,
  );
});

test("authorize accepts signed platform identity without Firebase", async () => {
  const headers = await signedHeaders("sites-user", "sites@example.com");
  const request = new Request("https://gazelle.test/api/boldi/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: "{}",
  });
  const auth = await authorize(request, { userId: "sites-user" }, { PLATFORM_IDENTITY_SECRET: SECRET });
  assert.deepEqual(auth, {
    provider: "codex-sites",
    subject: "sites-user",
    email: "sites@example.com",
  });
});

test("enforceRateLimit returns 429 after the window is exhausted", async () => {
  const auth = { provider: "codex-sites", subject: `rate-limit-${Date.now()}`, email: "" };
  const request = new Request("https://gazelle.test/api/boldi/chat", { method: "POST" });
  const env = {};
  const route = `test-route-${auth.subject}`;
  for (let i = 0; i < 3; i += 1) {
    const ok = await enforceRateLimit(request, env, auth, { route, limit: 3 });
    assert.equal(ok, null);
  }
  const blocked = await enforceRateLimit(request, env, auth, { route, limit: 3 });
  assert.ok(blocked);
  assert.equal(blocked!.status, 429);
  const body = (await blocked!.json()) as { code: string };
  assert.equal(body.code, "rate_limited");
});

test("chat route rejects unsigned oai-* spoofing without Firebase", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/boldi/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-id": "attacker",
        "oai-authenticated-user-email": "attacker@example.com",
      },
      body: JSON.stringify({
        userId: "attacker",
        workspaceId: "ws-1",
        messages: [{ role: "user", content: "hi" }],
      }),
    }),
    { PLATFORM_IDENTITY_SECRET: SECRET },
  );
  assert.equal(response.status, 401);
});
