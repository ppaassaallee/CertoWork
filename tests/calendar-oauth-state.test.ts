import assert from "node:assert/strict";
import test from "node:test";
import {
  signCalendarState,
  verifyCalendarState,
} from "../worker/calendarCrypto.js";

test("calendar oauth state survives URL-safe roundtrip and workspace ids with colons", () => {
  const env = { CALENDAR_TOKEN_KEY: "test-secret-key-123" };
  const state = signCalendarState(env, "uid_abc", "ws:with:colons");
  assert.equal(state.includes("+"), false);
  assert.equal(state.includes("/"), false);
  assert.equal(state.includes("|"), false);
  const parsed = verifyCalendarState(env, state);
  assert.ok(parsed);
  assert.equal(parsed.uid, "uid_abc");
  assert.equal(parsed.workspaceId, "ws:with:colons");
});

test("calendar oauth state rejects tampering and wrong secret", () => {
  const env = { CALENDAR_TOKEN_KEY: "secret-a" };
  const state = signCalendarState(env, "u1", "w1");
  assert.equal(verifyCalendarState({ CALENDAR_TOKEN_KEY: "secret-b" }, state), null);
  assert.equal(verifyCalendarState(env, state.slice(0, -2) + "xx"), null);
});

test("calendar oauth state accepts legacy pipe format", () => {
  const env = { CALENDAR_TOKEN_KEY: "legacy" };
  const iat = Date.now();
  const body = `uid1:ws1:${iat}`;
  const legacy = `${body}|${btoa(body + ":legacy")}`;
  const parsed = verifyCalendarState(env, legacy);
  assert.ok(parsed);
  assert.equal(parsed.uid, "uid1");
  assert.equal(parsed.workspaceId, "ws1");
});
