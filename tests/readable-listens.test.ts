import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isJoinedWorkspaceMember } from "../src/lib/memberListenAccess";
import {
  planIsWorkspaceWideOnly,
  readableRecordQueryPlans,
  readableTableQueryPlans,
} from "../src/lib/tables/readableQueries";

const shell = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
const auth = readFileSync(resolve("src/lib/AuthContext.tsx"), "utf8");
const items = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");
const surfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");

test("table list plans are membership-safe and never workspace-wide only", () => {
  const plans = readableTableQueryPlans("ws-1", "user-1");
  assert.equal(plans.length, 6);
  assert.equal(plans.some(planIsWorkspaceWideOnly), false);
  assert.deepEqual(plans[0], [
    { field: "workspaceId", op: "==", value: "ws-1" },
    { field: "createdBy", op: "==", value: "user-1" },
  ]);
  assert.equal(readableTableQueryPlans("", "user-1").length, 0);
  const records = readableRecordQueryPlans("ws-1", ["a", "a", "b"]);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.[1]?.op, "in");
  assert.deepEqual(records[0]?.[1]?.value, ["a", "b"]);
  assert.equal(readableRecordQueryPlans("ws-1", []).length, 0);
  assert.equal(planIsWorkspaceWideOnly(records[0] || []), false);
});

test("joined membership is an active or accepted member document", () => {
  assert.equal(isJoinedWorkspaceMember("u1", [{ userId: "u1", status: "active" }]), true);
  assert.equal(isJoinedWorkspaceMember("u1", [{ userId: "u1", status: "accepted" }]), true);
  assert.equal(isJoinedWorkspaceMember("u1", [{ userId: "u1", status: "invited" }]), false);
  assert.equal(isJoinedWorkspaceMember("u1", [{ userId: "u1" }]), false);
  assert.equal(isJoinedWorkspaceMember("u1", []), false);
});

test("shell listeners skip collections the rules will deny", () => {
  assert.match(shell, /makeQueryLocal\("support_cases", setSupportCases, false, true\)/);
  assert.doesNotMatch(shell, /makeQueryLocal\(\s*TABLES/);
  assert.match(shell, /readableTableQueryPlans\(workspace\.id, user\.uid\)/);
  assert.match(shell, /readableRecordQueryPlans\(/);
  assert.doesNotMatch(
    shell,
    /collection\(db, TABLE_RECORDS\), where\("workspaceId", "==", workspace\.id\)\)/,
  );
  assert.match(shell, /memberCanList/);
  assert.match(shell, /joinedWorkspace/);
  assert.doesNotMatch(auth, /array-contains', emailLower/);
  assert.doesNotMatch(auth, /Failed to load email-invited workspaces/);
});

test("item open and close keep the project view and the sidebar chrome", () => {
  assert.match(items, /shouldCloseItemOnProjectChange/);
  assert.doesNotMatch(items, /onSelectItem\(null\);\s*\}, \[activeProject\?\.id\]\)/);
  assert.match(surfaces, /projectViewToken/);
  assert.match(shell, /staysOnProjectPath\(location\.pathname, project\.id\)/);
  assert.match(shell, /className="do-top-search"/);
  assert.match(shell, /className="do-create-menu"/);
  assert.doesNotMatch(shell, /centerView !== "portfolio" &&/);
  assert.match(shell, /sidebarProjects\.favorites\.length === 0 && sidebarProjects\.recent\.length === 0/);
  assert.match(shell, /aria-selected=\{lens\.section === "this_week"\}/);
  assert.match(shell, /label: "This week"/);
});
