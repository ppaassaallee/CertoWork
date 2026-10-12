import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  planIsWorkspaceWideOnly,
  readableRecordQueryPlans,
  readableTableQueryPlans,
  SHARED_TABLE_VISIBILITIES,
} from "../src/lib/tables/readableQueries";
import { classifyDataSyncError } from "../src/lib/workspaceLoadError";

test("table list plans never ask for every table in the workspace", () => {
  const plans = readableTableQueryPlans("ws-1", "user-1");
  assert.equal(plans.length, 1 + SHARED_TABLE_VISIBILITIES.length);
  for (const plan of plans) {
    assert.equal(planIsWorkspaceWideOnly(plan), false);
    assert.equal(plan.some((clause) => clause.field === "workspaceId" && clause.value === "ws-1"), true);
    assert.equal(plan.some((clause) => clause.op === "in"), false);
  }
  for (const visibility of SHARED_TABLE_VISIBILITIES) {
    assert.ok(plans.some((plan) => plan.some((clause) => clause.field === "visibility" && clause.value === visibility)));
  }
  assert.equal(plans.some((plan) => plan.some((clause) => clause.value === "private")), false);
  assert.deepEqual(readableTableQueryPlans("", "user-1"), []);
  assert.deepEqual(readableTableQueryPlans("ws-1", ""), []);
});

test("record plans follow visible tables and stay chunked", () => {
  assert.deepEqual(readableRecordQueryPlans("ws-1", []), []);
  const ids = Array.from({ length: 11 }, (_, index) => `table-${index}`);
  const plans = readableRecordQueryPlans("ws-1", ids);
  assert.equal(plans.length, 2);
  assert.equal((plans[0][1].value as string[]).length, 10);
  assert.deepEqual(plans[1][1].value, ["table-10"]);
  for (const plan of plans) {
    assert.equal(planIsWorkspaceWideOnly(plan), false);
    assert.equal(plan[0].field, "workspaceId");
    assert.equal(plan[1].field, "tableId");
  }
});

test("permission denials and missing indexes become a recoverable banner", () => {
  assert.equal(classifyDataSyncError({ code: "permission-denied" }), "permission");
  assert.equal(
    classifyDataSyncError({ code: "firestore/permission-denied", message: "Missing or insufficient permissions." }),
    "permission",
  );
  assert.equal(classifyDataSyncError({ code: "failed-precondition" }), "unavailable");
  assert.equal(classifyDataSyncError({ code: "resource-exhausted" }), "quota");
  assert.equal(classifyDataSyncError(new Error("offline")), null);
});

test("rules and listeners keep private tables out of the workspace list", () => {
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  const shell = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const loader = readFileSync(resolve("src/data/startWorkspaceData.ts"), "utf8");
  const indexes = readFileSync(resolve("firestore.indexes.json"), "utf8");
  assert.match(rules, /function canReadWorkspaceContent\(workspaceId\)/);
  assert.match(rules, /workspaceMembersContainAuthEmail\(workspaceId\)/);
  assert.match(rules, /workspaceMembersContainAuthEmail\(resource\.data\.workspaceId\)/);
  assert.match(shell, /readableTableQueryPlans\(workspace\.id, user\.uid\)/);
  assert.match(shell, /readableRecordQueryPlans/);
  assert.match(shell, /setTablesSyncIssue/);
  assert.match(shell, /onTables \? tablesSyncIssue/);
  assert.match(loader, /isFirestorePermissionError\(error\)/);
  assert.match(indexes, /"collectionGroup": "tables"/);
  assert.match(indexes, /"fieldPath": "createdBy"/);
  assert.match(indexes, /"fieldPath": "visibility"/);
});
