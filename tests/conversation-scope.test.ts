import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationIncludesProject,
  conversationProjectIds,
  conversationScopeLabel,
  conversationScopeType,
  conversationTaskIds,
  isProjectConversation,
  isStandaloneConversation,
} from "../src/lib/conversationScope";

test("keeps legacy project conversations compatible", () => {
  const conversation = { contextEntityId: "fieldops", sourceContext: "project" };
  assert.deepEqual(conversationProjectIds(conversation), ["fieldops"]);
  assert.equal(conversationIncludesProject(conversation, "fieldops"), true);
});

test("classifies general, project, task, and mixed conversation scopes", () => {
  assert.equal(conversationScopeType([], []), "general");
  assert.equal(conversationScopeType(["a"], []), "project");
  assert.equal(conversationScopeType(["a", "b"], []), "multi_project");
  assert.equal(conversationScopeType([], ["t1"]), "task");
  assert.equal(conversationScopeType([], ["t1", "t2"]), "multi_task");
  assert.equal(conversationScopeType(["a"], ["t1"]), "mixed");
});

test("describes multi-entity context without pretending it is one project", () => {
  const conversation = { linkedProjectIds: ["a", "b"], linkedTaskIds: ["t1"] };
  assert.deepEqual(conversationTaskIds(conversation), ["t1"]);
  assert.equal(
    conversationScopeLabel(
      conversation,
      [{ id: "a", title: "FieldOps" }, { id: "b", title: "Payments" }],
      [{ id: "t1", title: "Ship pilot" }],
    ),
    "2 projects · 1 task",
  );
});

test("home history only treats chats without project ids as standalone", () => {
  assert.equal(isStandaloneConversation({ linkedProjectIds: ["fieldops"] }), false);
  assert.equal(isProjectConversation({ contextEntityId: "fieldops", sourceContext: "project" }), true);
});
