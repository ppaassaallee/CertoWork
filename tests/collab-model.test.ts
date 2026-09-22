import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  conversationSchema,
  emptyMentions,
  participantDocId,
  presenceDocId,
} from "../src/lib/collab/types.ts";

test("conversation schema accepts a minimal dm", () => {
  const parsed = conversationSchema.parse({
    id: "c1",
    workspaceId: "w1",
    type: "dm",
    title: "Ana · Bo",
    participantIds: ["u1", "u2"],
    agentIds: [],
    guestIds: [],
    isPrivate: true,
    status: "active",
    messageCount: 0,
    pinnedMessageIds: [],
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(parsed.type, "dm");
  assert.deepEqual(emptyMentions().agentIds, []);
  assert.equal(participantDocId("c1", "u1"), "c1_u1");
  assert.equal(presenceDocId("w1", "u1"), "w1_u1");
});

test("firestore rules scope conversations to workspace members", () => {
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  assert.match(rules, /match \/conversations\/\{id\}/);
  assert.match(rules, /match \/conversation_messages\/\{id\}/);
  assert.match(rules, /canReadConversation/);
  assert.match(rules, /canWriteAsParticipant/);
  assert.match(rules, /match \/guests\/\{id\}/);
  assert.match(rules, /allow write: if false/);
});
