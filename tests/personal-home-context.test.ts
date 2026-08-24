import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildConversationRequestContext } from "../src/lib/conversationContextBuilder";
import {
  isPersonalWorkItem,
  scopePersonalHomeRecords,
} from "../src/lib/personalHomeContext";

const actor = {
  userId: "user-a",
  memberId: "ws1_user-a",
  email: "a@certo.work",
};

test("personal work matching uses owner, assignee, and member ids", () => {
  assert.equal(
    isPersonalWorkItem({ userId: "user-a", title: "Mine" }, actor),
    true,
  );
  assert.equal(
    isPersonalWorkItem({ assigneeIds: ["ws1_user-a"], title: "Assigned" }, actor),
    true,
  );
  assert.equal(
    isPersonalWorkItem({ createdBy: "user-b", title: "Theirs" }, actor),
    false,
  );
});

test("Home RAG keeps this user's tasks and only a compact workspace radar", () => {
  const scoped = scopePersonalHomeRecords({
    actor,
    openTasks: [
      { id: "mine", title: "Write brief", userId: "user-a", projectId: "p1" },
      { id: "theirs", title: "Secret payroll", userId: "user-b", projectId: "p2" },
    ],
    activeProjects: [
      { id: "p1", title: "FieldOps", userId: "user-a" },
      { id: "p2", title: "Payroll", userId: "user-b", healthOverride: "blocked" },
    ],
    milestones: [
      { id: "m1", projectId: "p1", title: "Pilot" },
      { id: "m2", projectId: "p2", title: "Hidden gate" },
    ],
    risks: [
      { id: "r1", projectId: "p2", title: "Vendor lock", status: "open", severity: "critical" },
    ],
    todayTasks: [
      { id: "mine", title: "Write brief" },
      { id: "theirs", title: "Secret payroll" },
    ],
  });

  assert.deepEqual(
    scoped.scopedTasks.map((item) => item.id),
    ["mine"],
  );
  assert.deepEqual(
    scoped.scopedProjects.map((item) => item.id),
    ["p1"],
  );
  assert.deepEqual(
    scoped.scopedMilestones.map((item) => item.id),
    ["m1"],
  );
  assert.equal(
    scoped.scopedTodayTasks.some((item) => item.id === "theirs"),
    false,
  );
  assert.equal(scoped.privacyScope, "personal_home");
  assert.equal(
    scoped.workspaceRadar.some((item) => item.id === "p2" && item.health === "blocked"),
    true,
  );
  assert.equal(
    scoped.workspaceRadar.some((item) => String(item.title).includes("Secret")),
    false,
  );
});

function baseContext(overrides: Record<string, unknown> = {}) {
  return buildConversationRequestContext({
    text: "What should I do today?",
    currentUserMessageId: "msg-1",
    contextualMessages: [],
    isFocusedConversation: false,
    primaryProject: null,
    activeProject: null,
    directContextProjectIds: [],
    contextTaskIds: [],
    contextProjectIds: [],
    contextProjects: [],
    contextTasks: [],
    projectTasks: [],
    openTasks: [
      { id: "mine", title: "Write brief", userId: "user-a", projectId: "p1" },
      { id: "theirs", title: "Secret payroll", userId: "user-b", projectId: "p2" },
    ],
    activeProjects: [
      { id: "p1", title: "FieldOps", userId: "user-a" },
      { id: "p2", title: "Payroll", userId: "user-b", healthOverride: "blocked" },
    ],
    milestones: [],
    risks: [],
    todayTasks: [
      { id: "mine", title: "Write brief", userId: "user-a" },
      { id: "theirs", title: "Secret payroll", userId: "user-b" },
    ],
    projects: [],
    tasks: [],
    conversations: [],
    reviewItems: [],
    strategicGoals: [],
    strategicMeasures: [],
    strategicRecords: [],
    workspaceMembers: [],
    workspaceTeams: [],
    projectDocuments: [],
    notebookEntries: [],
    userId: "user-a",
    workspaceId: "ws-1",
    conversationId: "home-1",
    currentMemberId: "ws-1_user-a",
    currentUserEmail: "a@certo.work",
    odiseusMemory: [{ id: "mem-1", text: "Prefer morning deep work", kind: "preference" }],
    ...overrides,
  });
}

test("unfocused Home context is personal and does not dump teammate tasks", () => {
  const result = baseContext();
  assert.equal(result.workspaceContext.mode, "personal_home");
  assert.equal(result.workspaceContext.privacyScope, "personal_home");
  assert.equal(result.workspaceContext.conversationId, "home-1");
  assert.deepEqual(
    result.workspaceContext.tasks.map((item: { id: string }) => item.id),
    ["mine"],
  );
  assert.equal(
    result.workspaceContext.tasks.some((item: { title?: string }) =>
      String(item.title).includes("Secret"),
    ),
    false,
  );
  assert.equal(result.workspaceSnapshot.scope, "personal_home");
});

test("focused project conversations still receive attached project work", () => {
  const result = baseContext({
    isFocusedConversation: true,
    primaryProject: { id: "p2", title: "Payroll" },
    contextProjects: [{ id: "p2", title: "Payroll" }],
    contextProjectIds: ["p2"],
    directContextProjectIds: ["p2"],
    projectTasks: [{ id: "theirs", title: "Secret payroll", userId: "user-b", projectId: "p2" }],
  });
  assert.equal(result.workspaceContext.mode, "focused_delivery");
  assert.equal(result.workspaceContext.tasks[0].id, "theirs");
});

test("Home navigation attaches the personal Odysseus thread", () => {
  const source = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(source, /selectHomeConversation/);
  assert.match(source, /currentMemberId: personalActor.memberId/);
  assert.match(source, /todayTasks=\{personalTodayTasks\}/);
  assert.match(source, /selectHomeConversation\(conversations\)/);
  assert.match(source, /conversationType: homeThread\s*\n\s*\? "chief_of_staff"/);
});
