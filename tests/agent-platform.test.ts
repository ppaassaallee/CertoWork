import assert from "node:assert/strict";
import test from "node:test";

import {
  assertTenant,
  executeCertoMcpTool,
} from "../src/lib/agent-platform/certoMcp";
import { proposeAgentAction } from "../src/lib/agent-platform/actionExecutor";
import { decideActionPolicy, riskForActionType } from "../src/lib/agent-platform/policy";
import { opaqueHermesProfileId } from "../src/lib/agent-platform/types";
import { normalizeCompletedRun } from "../src/lib/agent-platform/hermesAdapter";
import { hermesRuntimeEnabled } from "../worker/runtime/hermesBridge.js";
import { executeCertoMcpTool as workerMcp } from "../worker/mcp/certoMcp.js";

test("policy defaults ask for mutations and deny privileged ops", () => {
  assert.equal(decideActionPolicy("create_task"), "ask");
  assert.equal(decideActionPolicy("prepare_report"), "allow");
  assert.equal(decideActionPolicy("manage_members"), "deny");
  assert.equal(riskForActionType("outbox_communication"), "external_side_effect");
});

test("MCP denies cross-tenant reads", () => {
  const identity = {
    workspaceId: "ws-a",
    agentId: "agent-1",
    agentVersionId: "v1",
    grants: [{ resource: "*", mode: "read" as const }],
  };
  assert.throws(
    () =>
      executeCertoMcpTool(
        "certo_search_projects",
        {},
        identity,
        { workspaceId: "ws-b", projects: [{ id: "p1", title: "Secret" }] },
      ),
    /CROSS_TENANT_DENIED/,
  );
});

test("MCP search returns evidence refs inside tenant", () => {
  const identity = {
    workspaceId: "ws-a",
    agentId: "agent-1",
    agentVersionId: "v1",
    grants: [{ resource: "projects", mode: "read" as const }],
  };
  const result = executeCertoMcpTool(
    "certo_search_projects",
    { query: "alpha" },
    identity,
    {
      workspaceId: "ws-a",
      projects: [
        { id: "p1", title: "Project Alpha", health: "at_risk" },
        { id: "p2", title: "Other", health: "on_track" },
      ],
    },
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].evidenceRef.type, "project");
});

test("worker MCP mirror matches tenant isolation", () => {
  assert.throws(
    () =>
      workerMcp(
        "certo_get_attention_summary",
        {},
        {
          workspaceId: "a",
          agentId: "x",
          agentVersionId: "v",
          grants: [{ resource: "*", mode: "read" }],
        },
        { workspaceId: "b", projects: [], tasks: [] },
      ),
    /CROSS_TENANT_DENIED/,
  );
});

test("proposeAgentAction requires approval for create_task", () => {
  const action = proposeAgentAction({
    workspaceId: "ws",
    agentId: "ag",
    agentVersionId: "v1",
    runId: "run1",
    actionType: "create_task",
    payload: { title: "Follow up" },
    reason: "At risk project",
    fingerprint: "fp1",
  });
  assert.equal(action.status, "approval_required");
  assert.match(action.idempotencyKey, /create_task/);
});

test("hermes profile ids are opaque and stable-ish", () => {
  assert.equal(opaqueHermesProfileId("agent_ABC-123"), "cw-a-agentabc123");
});

test("normalized runtime events are product-safe", () => {
  const events = [...normalizeCompletedRun({ runId: "r1", hermesRunId: "h1", agentId: "a" }, "hello")];
  assert.deepEqual(
    events.map((e) => e.type),
    ["run.started", "message.completed", "run.completed"],
  );
});

test("hermes runtime flag defaults off", () => {
  assert.equal(hermesRuntimeEnabled({}), false);
  assert.equal(hermesRuntimeEnabled({ CERTO_HERMES_RUNTIME: "1" }), true);
});
