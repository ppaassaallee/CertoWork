import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCodexHandoffBrief,
  codexEventTaskPatch,
  createHandoffCode,
  isExecutableWorkItem,
  serializeCodexWorkItem,
} from "../src/lib/codexBridge";
import { codexBridgeTools } from "../worker/codex-bridge.js";

test("Codex handoff codes are recognizable and non-secret selectors", () => {
  assert.match(createHandoffCode(), /^DOS-[A-F0-9]{10}$/);
});

test("the bridge shares canonical executable work without flattening planning containers", () => {
  assert.equal(isExecutableWorkItem({ workItemType: "epic" }), false);
  assert.equal(isExecutableWorkItem({ workItemType: "feature" }), false);
  assert.equal(isExecutableWorkItem({ workItemType: "pbi" }), true);
  assert.equal(isExecutableWorkItem({ workItemType: "bug" }), true);
  assert.equal(isExecutableWorkItem({ workItemType: "subtask" }), true);

  const item = serializeCodexWorkItem({
    id: "pbi-1",
    key: "KRU-42",
    title: "Implement secure sign-in callback",
    workItemType: "pbi",
    projectId: "kruops",
    acceptanceCriteria: "The callback returns to the requested route.",
  }, true);
  assert.equal(item.type, "pbi");
  assert.equal(item.key, "KRU-42");
  assert.equal(item.readyForCodex, true);
});

test("the launch brief requires claim, evidence, and truthful delivery reporting", () => {
  const brief = buildCodexHandoffBrief({
    connection: {
      handoffCode: "DOS-ABC1234567",
      repositoryRoot: "/work/kruops",
      repositoryUrl: "",
      defaultBranch: "main",
      versioningStrategy: "simple_semver",
      releaseChannel: "staging",
      syncMode: "completion_and_notes",
    },
    project: { id: "kruops", title: "KruOps" },
    workItems: [{ id: "pbi-1", key: "KRU-42", title: "Fix auth", type: "bug", readyForCodex: true }],
  });
  assert.match(brief, /get_delivery_context/);
  assert.match(brief, /claim only/i);
  assert.match(brief, /tests/i);
  assert.match(brief, /Repository and version contract/);
  assert.match(brief, /Do not treat a commit as a release/);
  assert.match(brief, /Do not invent GitHub, build, deployment, test, or completion status/);
});

test("completion events update the canonical work item and retain delivery evidence", () => {
  const patch = codexEventTaskPatch({
    id: "event-1",
    connectionId: "connection-1",
    workItemId: "pbi-1",
    kind: "work_item_completed",
    status: "authorized",
    payload: {
      summary: "Implemented and tested",
      filesChanged: ["src/auth.ts"],
      tests: ["auth callback test passed"],
      acceptanceEvidence: ["redirect preserved"],
      branchName: "fix/auth-callback",
      commitSha: "abc123",
      buildUrl: "https://ci.example/build/1",
      releaseVersion: "v1.2.3",
      rollbackPlan: "Redeploy v1.2.2",
    },
  });
  assert.equal(patch.status, "done");
  assert.equal(patch.codexStatus, "completed");
  assert.deepEqual(patch.deliveryEvidence.filesChanged, ["src/auth.ts"]);
  assert.equal(patch.deliveryEvidence.branchName, "fix/auth-callback");
  assert.equal(patch.deliveryEvidence.commitSha, "abc123");
  assert.equal(patch.deliveryEvidence.releaseVersion, "v1.2.3");
  assert.equal(patch.deliveryEvidence.rollbackPlan, "Redeploy v1.2.2");
});

test("the MCP surface separates reads, scoped updates, completion, and new-scope review", () => {
  const names = codexBridgeTools.map((tool) => tool.name);
  assert.deepEqual(names, [
    "list_delivery_links",
    "get_delivery_context",
    "list_ready_work_items",
    "link_codex_task",
    "claim_work_item",
    "report_work_item_progress",
    "complete_work_item",
    "report_project_gap",
  ]);
  assert.equal(codexBridgeTools.find((tool) => tool.name === "get_delivery_context")?.annotations.readOnlyHint, true);
  assert.equal(codexBridgeTools.find((tool) => tool.name === "complete_work_item")?.annotations.readOnlyHint, false);
});
