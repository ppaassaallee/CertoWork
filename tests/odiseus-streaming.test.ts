import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("worker chat supports SSE step streaming", () => {
  const source = readFileSync(resolve("worker/index.js"), "utf8");
  assert.match(source, /text\/event-stream/);
  assert.match(source, /event: \$\{event\}/);
  assert.match(source, /onStep:/);
});

test("client chat requests and consumes SSE", () => {
  const source = readFileSync(resolve("src/lib/conversationClient.ts"), "utf8");
  assert.match(source, /Accept: "text\/event-stream"/);
  assert.match(source, /stream: true/);
  assert.match(source, /readSseChat/);
});

test("firestore rules cover odiseus memory", () => {
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  assert.match(rules, /match \/odiseus_memory\/\{id\}/);
});
