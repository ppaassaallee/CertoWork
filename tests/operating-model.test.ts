import assert from "node:assert/strict";
import test from "node:test";

import {
  operatingStateForItem,
  summarizeOperatingModel,
} from "../src/lib/operatingModel";
import {
  deliveryEvidenceReadiness,
  repositoryVersionContractText,
} from "../src/lib/repositoryVersioning";

test("Action Board model clarifies captured work before it enters execution", () => {
  const state = operatingStateForItem({
    title: "Call Jennifer about vendor contract",
    stageId: "capture",
    globalStageId: "inbox",
  });
  assert.equal(state.phase, "clarify");
  assert.equal(state.needsClarification, true);
  assert.match(state.nextSystemPrompt, /outcome|next physical action|time sector/i);
});

test("Action Board model separates today execution from waiting and someday work", () => {
  const summary = summarizeOperatingModel([
    { title: "Ship release note", timeSector: "today", priority: 1 },
    { title: "Waiting for finance approval", globalStageId: "waiting", itemType: "waiting_for" },
    { title: "Maybe build iPad handwriting", globalStageId: "someday" },
    { title: "Completed auth fix", status: "done" },
  ]);
  assert.equal(summary.today, 1);
  assert.equal(summary.waiting, 1);
  assert.equal(summary.someday, 1);
  assert.equal(summary.review, 1);
});

test("repository versioning distinguishes code readiness from release readiness", () => {
  assert.equal(deliveryEvidenceReadiness({
    commitSha: "abc123",
    tests: ["pnpm test"],
  }).status, "code_ready");

  const ready = deliveryEvidenceReadiness({
    branchName: "feature/auth",
    commitSha: "abc123",
    tests: ["pnpm test"],
    releaseVersion: "v1.4.0",
    deploymentUrl: "https://example.com",
    knowledgeNotes: ["Auth callback preserved after deployment."],
  });
  assert.equal(ready.status, "release_ready");
  assert.deepEqual(ready.missing, []);
  assert.match(repositoryVersionContractText(), /Do not treat a commit as a release/);
});
