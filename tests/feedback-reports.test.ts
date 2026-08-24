import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  feedbackKindLabel,
  feedbackStatusLabel,
  feedbackToTaskPatch,
  isOpenFeedback,
  workItemTypeForFeedback,
} from "../src/lib/feedbackReports";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";

test("feedback kinds map onto backlog work item types", () => {
  assert.equal(workItemTypeForFeedback("bug"), "bug");
  assert.equal(workItemTypeForFeedback("feature"), "pbi");
  assert.equal(feedbackKindLabel("bug"), "Bug");
  assert.equal(feedbackStatusLabel("converted"), "Converted to PBI");
  assert.equal(isOpenFeedback("submitted"), true);
  assert.equal(isOpenFeedback("converted"), false);
});

test("converting feedback produces a PBI patch linked to the report", () => {
  const patch = feedbackToTaskPatch({
    id: "fb-1",
    kind: "feature",
    title: "Add fields",
    description: "Need a Project field",
    userId: "user-1",
  });
  assert.equal(patch.workItemType, "pbi");
  assert.equal(patch.source, "user_feedback");
  assert.equal(patch.linkedEntityType, "feedback_report");
  assert.equal(patch.linkedEntityId, "fb-1");
  assert.match(String(patch.description), /Need a Project field/);
});

test("feedback routes split submit from the admin queue", () => {
  assert.deepEqual(resolveDelivereeLens("/feedback"), {
    kind: "feedback",
    section: "submit",
  });
  assert.deepEqual(resolveDelivereeLens("/report-bug"), {
    kind: "feedback",
    section: "submit",
    intent: "bug",
  });
  assert.deepEqual(resolveDelivereeLens("/feature-request"), {
    kind: "feedback",
    section: "submit",
    intent: "feature",
  });
  assert.deepEqual(resolveDelivereeLens("/workspace/feedback"), {
    kind: "feedback",
    section: "queue",
  });
});

test("feedback rules and UI stay aligned", () => {
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  const workspace = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  const center = readFileSync(resolve("src/components/FeedbackCenter.tsx"), "utf8");

  assert.match(rules, /match \/feedback_reports\/\{id\}/);
  assert.match(rules, /function canReadFeedbackReport\(data\)/);
  assert.match(rules, /isWorkspaceAdmin\(data\.workspaceId\)/);
  assert.match(workspace, /collection\(db, "feedback_reports"\)/);
  assert.match(workspace, /convertFeedbackToPbi/);
  assert.match(center, /feedback-submit/);
  assert.match(center, /feedback-admin-queue/);
  assert.match(center, /Convert to/);
});
