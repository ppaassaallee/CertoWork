import assert from "node:assert/strict";
import test from "node:test";
import { isProjectConversation, isStandaloneConversation } from "../src/lib/conversationScope";
import { inviteActivationPath, inviteIsExpired, inviteIsUsable } from "../src/lib/inviteLifecycle";
import { kanbanColumnForStatus, statusForKanbanColumn } from "../src/lib/kanbanBoard";
import { canDeleteProject } from "../src/lib/projectPermissions";
import {
  PROJECT_RESOURCE_MAX_BYTES,
  isAllowedProjectResourceSize,
  looksLikeExternalUrl,
} from "../src/lib/projectResources";
import { buildProjectStatusReport, sanitizeStatusReportSnapshot } from "../src/lib/projectStatusReport";
import { sidebarProjectGroups } from "../src/lib/projectPortfolio";
import { itemMatchesSprint } from "../src/lib/sprints";

test("standalone conversations exclude project-linked chats", () => {
  assert.equal(isStandaloneConversation({ conversationType: "chief_of_staff" }), true);
  assert.equal(isStandaloneConversation({ linkedProjectIds: [] }), true);
  assert.equal(isStandaloneConversation({ linkedProjectIds: ["p1"] }), false);
  assert.equal(isProjectConversation({ linkedProjectIds: ["p1"] }), true);
});

test("kanban maps statuses to delivery columns without duplicating items", () => {
  assert.equal(kanbanColumnForStatus("todo"), "backlog");
  assert.equal(kanbanColumnForStatus("in_progress"), "doing");
  assert.equal(kanbanColumnForStatus("blocked"), "blocked");
  assert.equal(kanbanColumnForStatus("done"), "done");
  assert.equal(statusForKanbanColumn("doing", "in_review"), "in_review");
  assert.equal(statusForKanbanColumn("doing"), "in_progress");
});

test("project delete is limited to manager or workspace owner", () => {
  const project = { projectManagerId: "ws_manager" };
  assert.equal(canDeleteProject(project, { uid: "manager" }, { ownerId: "owner" }, "ws_manager"), true);
  assert.equal(canDeleteProject(project, { uid: "owner" }, { ownerId: "owner" }, "ws_other"), true);
  assert.equal(canDeleteProject(project, { uid: "other" }, { ownerId: "owner" }, "ws_other"), false);
});

test("project resources reject files over 20MB and accept https links", () => {
  assert.equal(isAllowedProjectResourceSize(20 * 1024 * 1024), true);
  assert.equal(isAllowedProjectResourceSize(PROJECT_RESOURCE_MAX_BYTES + 1), false);
  assert.equal(looksLikeExternalUrl("https://drive.google.com/file/d/abc"), true);
  assert.equal(looksLikeExternalUrl("javascript:alert(1)"), false);
});

test("invite tokens expire after 14 days and used invites are not reusable", () => {
  assert.equal(inviteActivationPath("abc"), "/invite/abc");
  assert.equal(inviteIsUsable({ status: "pending" }), true);
  assert.equal(inviteIsUsable({ status: "accepted" }), false);
  assert.equal(inviteIsExpired({ createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000 }), true);
  assert.equal(inviteIsExpired({ expiresAt: Date.now() + 60_000 }), false);
});

test("home recency keeps six recent projects", () => {
  const projects = Array.from({ length: 8 }, (_, index) => ({
    id: `p${index}`,
    status: "active",
    updatedAt: { seconds: 100 + index },
  }));
  assert.equal(sidebarProjectGroups(projects).recent.length, 6);
});

test("status report and sprint matching use the same item records", () => {
  const project = { id: "p1", title: "Alpha", status: "active", projectManager: "Ada" };
  const tasks = [
    { id: "e1", projectId: "p1", workItemType: "epic", title: "Epic A", status: "in_progress" },
    { id: "t1", projectId: "p1", workItemType: "task", title: "Task A", status: "blocked", sprintId: "s1" },
  ];
  const report = buildProjectStatusReport(project, tasks, [], []);
  assert.equal(report.title, "Alpha");
  assert.equal(report.epics.length, 1);
  assert.equal(report.blockers.length, 1);
  assert.equal(itemMatchesSprint({ sprintId: "s1" }, "s1"), true);
  assert.equal(itemMatchesSprint({ sprintId: "s1" }, "none"), false);
});

test("public status snapshots only include report fields", () => {
  const snapshot = sanitizeStatusReportSnapshot(
    buildProjectStatusReport({ id: "p1", title: "Alpha", status: "active", secret: "nope" }, [], [], []),
  );
  assert.equal(snapshot.title, "Alpha");
  assert.equal("secret" in snapshot, false);
  assert.ok(Array.isArray(snapshot.epics));
});
