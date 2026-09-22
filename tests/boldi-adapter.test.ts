import assert from "node:assert/strict";
import test from "node:test";
import {
  boldiAgentToDefinition,
  boldiAgentToVersion,
  migrateBoldiAgents,
} from "../src/lib/agent-platform/boldiAdapter";

test("boldi adapter maps systemPrompt and tools into version + definition", () => {
  const doc = {
    id: "a1",
    name: "Risk Bot",
    systemPrompt: "Watch for slipped dates",
    toolsAllowed: ["read_items", "post_update"],
    permissionsProfile: { change_state: "ask", send_email: "deny" },
    status: "active",
    userId: "u1",
  };
  const def = boldiAgentToDefinition(doc, "ws1");
  const ver = boldiAgentToVersion(doc, "ws1");
  assert.equal(def.status, "published");
  assert.equal(def.runtime, "legacy_odysseus");
  assert.equal(ver.instructions, "Watch for slipped dates");
  assert.deepEqual(ver.connections[0]?.allowedTools, ["read_items", "post_update"]);
  assert.equal(ver.actionPolicy.change_state, "ask");
  assert.equal(ver.owns?.length ? true : false, true);
  const plan = migrateBoldiAgents([doc], "ws1");
  assert.equal(plan.dryRun, true);
  assert.equal(plan.count, 1);
});
