import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { reconcileSubscriptionPacks, stopSubscriptionPacks } from "../src/lib/subscriptionPacks";
import { singleFirestoreListenPack, KANBAN_PRESENCE_HEARTBEAT_MS } from "../src/lib/firestoreListenDiet";
import { createSingleFlight, createTokenCache, digestCostKey, shouldRenewCalendarChannels } from "../worker/costControls.js";
import { firestoreGetDocument } from "../worker/firestoreAdmin.js";
import worker, { signPlatformIdentityPayload } from "../worker/index.js";

test("navigation preserves shared packs and closes only unused subscriptions", () => {
  const handles = new Map<string, () => void>();
  const started: string[] = [], stopped: string[] = [];
  const subscribe = (name: string) => { started.push(name); return () => { stopped.push(name); }; };
  reconcileSubscriptionPacks(handles, { tables: true, milestones: true, key: "home" }, subscribe);
  reconcileSubscriptionPacks(handles, { tables: true, notes: true, milestones: false, key: "notes" }, subscribe);
  reconcileSubscriptionPacks(handles, { tables: true, notes: true }, subscribe);
  assert.deepEqual(started, ["tables", "milestones", "notes"]);
  assert.deepEqual(stopped, ["milestones"]);
  stopSubscriptionPacks(handles);
  assert.equal(handles.size, 0);
  assert.deepEqual(stopped, ["milestones", "tables", "notes"]);
});

test("one pack owns only its own listeners", () => {
  for (const name of ["tables", "notes", "financeOps", "milestones"]) {
    const pack = singleFirestoreListenPack(name);
    assert.deepEqual(Object.entries(pack).filter(([, enabled]) => enabled === true).map(([key]) => key), [name]);
  }
});

test("single flight merges only concurrent duplicates and never caches later requests", async () => {
  const run = createSingleFlight();
  let calls = 0;
  const operation = async () => { calls++; return "answer"; };
  assert.deepEqual(await Promise.all([run("tenant-a", operation), run("tenant-a", operation), run("tenant-b", operation)]), ["answer", "answer", "answer"]);
  assert.equal(calls, 2);
  await run("tenant-a", operation);
  assert.equal(calls, 3);
  await assert.rejects(run("failure", async () => { throw new Error("retry"); }));
  assert.equal(await run("failure", operation), "answer");
});

test("single flight bounds memory without dropping overflow requests", async () => {
  const run = createSingleFlight(1);
  let calls = 0;
  await Promise.all([run("a", async () => { calls++; }), run("b", async () => { calls++; }), run("b", async () => { calls++; })]);
  assert.equal(calls, 3);
});

test("OAuth cache coalesces loads, expires, isolates credentials and retries failures", async () => {
  let now = 100, loads = 0;
  const cached = createTokenCache(2, () => now);
  const load = async () => ({ token: `token-${++loads}`, expiresAt: now + 50 });
  assert.deepEqual(await Promise.all([cached("credential-a", load), cached("credential-a", load)]), ["token-1", "token-1"]);
  assert.equal(await cached("credential-a", load), "token-1");
  assert.equal(await cached("credential-b", load), "token-2");
  now = 151;
  assert.equal(await cached("credential-a", load), "token-3");
  await assert.rejects(cached("bad", async () => { throw new Error("oauth unavailable"); }));
  assert.equal(await cached("bad", load), "token-4");
});

test("OAuth cache evicts old identities at its bound", async () => {
  const cached = createTokenCache(1, () => 0);
  let loads = 0;
  const load = async () => ({ token: ++loads, expiresAt: 100 });
  await cached("a", load);
  await cached("b", load);
  await cached("a", load);
  assert.equal(loads, 3);
});

test("credential and tenant cache keys are digests, not plaintext", async () => {
  const a = await digestCostKey("credential-a|user-a|workspace-a");
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, await digestCostKey("credential-a|user-b|workspace-a"));
});

test("calendar maintenance runs hourly, retaining 15-minute routines", () => {
  for (const minute of [0, 15, 30, 45]) {
    assert.equal(shouldRenewCalendarChannels(Date.UTC(2026, 9, 15, 12, minute)), minute === 0);
  }
  assert.equal(shouldRenewCalendarChannels(NaN), false);
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /\*\/15 \* \* \* \*/);
});

test("watched table sweep avoids global metadata scans and duplicate record reads", () => {
  const source = readFileSync(new URL("../worker/routinesScheduler.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /queryTablesWithDateKey/);
  assert.match(source, /new Set\(watches.map/);
  assert.match(source, /recordsByTable.has\(watch.tableId\)/);
  assert.match(source, /table.workspaceId !== watch.workspaceId/);
  assert.equal(KANBAN_PRESENCE_HEARTBEAT_MS, 90_000);
});

test("Firestore REST integration reuses a token across concurrent and later reads", async () => {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const key = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ client_email: "cost-test@example.invalid", private_key: `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----` }) };
  const originalFetch = globalThis.fetch;
  let tokenCalls = 0, documentCalls = 0;
  globalThis.fetch = async (input) => {
    if (String(input) === "https://oauth2.googleapis.com/token") {
      tokenCalls++;
      return Response.json({ access_token: "fixture-token", expires_in: 3600 });
    }
    assert.match(String(input), /^https:\/\/firestore.googleapis.com\/v1\//);
    documentCalls++;
    return Response.json({ fields: { title: { stringValue: "Fixture" } } });
  };
  try {
    const results = await Promise.all([firestoreGetDocument(env, "tasks", "a"), firestoreGetDocument(env, "tasks", "b")]);
    assert.deepEqual(results.map((row) => row.title), ["Fixture", "Fixture"]);
    await firestoreGetDocument(env, "tasks", "c");
    assert.equal(tokenCalls, 1);
    assert.equal(documentCalls, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test("rewrite HTTP coalesces matching requests but isolates verified identities and workspaces", async () => {
  const secret = "cost-rewrite-fixture";
  const env = { PLATFORM_IDENTITY_SECRET: secret, OPENAI_API_KEY: "fixture-not-a-real-key", AI_RATE_LIMIT: "100" };
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    upstreamCalls++;
    await gate;
    return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ text: "Fix login" }) }] }], usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 20 }, output_tokens: 10 } });
  };
  const request = async (id: string, workspaceId = "workspace-a") => {
    const timestamp = Date.now();
    const email = `${id}@example.invalid`;
    const signature = await signPlatformIdentityPayload(secret, { id, email, timestamp });
    return worker.fetch(new Request("https://certo.test/api/certo/rewrite", {
      method: "POST", headers: { "content-type": "application/json", "oai-authenticated-user-id": id, "oai-authenticated-user-email": email, "oai-authenticated-user-timestamp": String(timestamp), "oai-authenticated-user-signature": signature },
      // Deliberately identical claimed userId: cache must use the verified subject.
      body: JSON.stringify({ userId: "claimed-user", workspaceId, text: "fix login", fieldKind: "work_item_title" }),
    }), env);
  };
  try {
    const pending = [request("user-a"), request("user-a"), request("user-b"), request("user-a", "workspace-b")];
    // Allow asynchronous signature verification and digest work to reach the gate.
    for (let attempt = 0; attempt < 100 && upstreamCalls < 3; attempt++) await new Promise((resolve) => setTimeout(resolve, 2));
    assert.equal(upstreamCalls, 3);
    release();
    const responses = await Promise.all(pending);
    for (const response of responses) {
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.text, "Fix login");
      assert.equal(payload.provider.usage.cachedInputTokens, 20);
    }
    assert.equal(upstreamCalls, 3);
    await request("user-a");
    assert.equal(upstreamCalls, 4);
  } finally { release(); globalThis.fetch = originalFetch; }
});
