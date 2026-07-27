import assert from "node:assert/strict";
import test from "node:test";
import {
  CHIEF_OF_STAFF_ORCHESTRATOR,
  SPECIALIST_AGENTS,
} from "../src/lib/agentContracts";

test("keeps one accountable orchestrator and eight bounded specialists", () => {
  assert.equal(CHIEF_OF_STAFF_ORCHESTRATOR.id, "chief_of_staff");
  assert.equal(SPECIALIST_AGENTS.length, 8);
  assert.ok(SPECIALIST_AGENTS.every((agent) => agent.allowedTools.length > 0));
  assert.ok(
    SPECIALIST_AGENTS.filter((agent) => agent.mayWrite).every(
      (agent) => agent.requiresApprovalForWrites,
    ),
  );
});

