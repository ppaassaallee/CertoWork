import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isHomeConversation,
  isStandaloneConversation,
  selectHomeConversation,
} from "../src/lib/conversationScope";
import { isPersonalWorkItem } from "../src/lib/personalHomeContext";

const rules = readFileSync(resolve("firestore.rules"), "utf8");
const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
const knowledgeBase = readFileSync(resolve("src/components/KnowledgeBase.tsx"), "utf8");
const knowledgeService = readFileSync(resolve("src/services/KnowledgeService.ts"), "utf8");
const projectSurfaces = readFileSync(resolve("src/components/ProjectSurfaces.tsx"), "utf8");
const workItems = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");

function ruleFn(name: string) {
  const start = rules.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} missing from firestore.rules`);
  const end = rules.indexOf("\n    }", start);
  return rules.slice(start, end);
}

test("project read rules and client queries stay aligned", () => {
  const canRead = ruleFn("canReadProject");
  assert.match(canRead, /data\.userId == request\.auth\.uid/);
  assert.match(canRead, /hasExplicitUserAccess\(data\)/);
  assert.match(canRead, /hasProjectRoleAccess\(data\)/);
  assert.match(canRead, /isPortfolioViewer\(data\.workspaceId\)/);
  assert.match(canRead, /isWorkspaceAdmin\(data\.workspaceId\)/);

  assert.match(workspace, /canSeeWorkspacePortfolio/);
  assert.match(workspace, /where\("userId", "==", user\.uid\)/);
  assert.match(workspace, /where\("visibleToUserIds", "array-contains", user\.uid\)/);
  assert.match(workspace, /where\("teamMemberIds", "array-contains", memberId\)/);
  assert.match(workspace, /where\("projectManagerId", "==", memberId\)/);
});

test("item read rules and client queries stay aligned", () => {
  const canRead = ruleFn("canReadTask");
  assert.match(canRead, /data\.userId == request\.auth\.uid/);
  assert.match(canRead, /createdBy/);
  assert.match(canRead, /isWorkspaceOwner\(data\.workspaceId\)/);
  assert.match(canRead, /assigneeIds/);
  assert.match(canRead, /accessMemberIds/);
  assert.match(canRead, /sharedWithUserIds/);

  assert.match(workspace, /workspace\.ownerId === user\.uid/);
  assert.match(workspace, /where\("createdBy", "==", user\.uid\)/);
  assert.match(workspace, /where\("assigneeIds", "array-contains", memberId\)/);
  assert.match(workspace, /where\("sharedWithUserIds", "array-contains", user\.uid\)/);
});

test("shared workspace members can update projects they can already see", () => {
  const canWrite = ruleFn("canWriteProject");
  assert.match(canWrite, /hasExplicitUserAccess\(data\)/);
  assert.match(canWrite, /isWorkspaceMember\(data\.workspaceId\)/);
  assert.match(canWrite, /!isWorkspaceViewer\(data\.workspaceId\)/);
  assert.match(workspace, /Project update was not saved/);
  assert.doesNotMatch(workspace, /replacePureAiPortfolioFromMaster/);
});

test("project sharing writes user ids that the rules can honor", () => {
  assert.match(projectSurfaces, /value=\{member\.userId \|\| member\.id\}/);
  assert.match(projectSurfaces, /visibleToUserIds: ids, sharedWithUserIds: ids/);
  assert.match(workItems, /sharedWithUserIds: shared, visibleToUserIds:/);
  const explicit = ruleFn("hasExplicitUserAccess");
  assert.match(explicit, /request\.auth\.uid in data\.visibleToUserIds/);
});

test("knowledge and document reads stay owner-scoped in rules and queries", () => {
  const start = rules.indexOf("match /knowledge_items/{id} {");
  const end = rules.indexOf("\n    }", start);
  const block = rules.slice(start, end);
  assert.match(block, /resource\.data\.userId == request\.auth\.uid/);
  assert.doesNotMatch(block, /isWorkspaceMember\(resource\.data\.workspaceId\)/);

  assert.match(workspace, /makeQuery\("knowledge_items", setKnowledgeItems, false, true\)/);
  assert.match(knowledgeBase, /where\("userId", "==", user\.uid\), where\("workspaceId", "==", workspace\.id\)/);
  assert.match(knowledgeService, /where\("userId", "==", request\.userId\)/);
});

test("conversations stay personal; Home and project scopes stay distinct", () => {
  assert.match(workspace, /makeQuery\(\s*"boldi_conversations"/);
  assert.match(workspace, /selectHomeConversation\(sorted\)/);
  assert.match(rules, /function canAccessBoldiRecord\(data\)/);
  assert.match(rules, /data\.userId == request\.auth\.uid/);

  const home = { id: "h1", conversationType: "chief_of_staff", isChiefOfStaff: true, sourceContext: "home" };
  const project = { id: "p1", linkedProjectIds: ["fieldops"], sourceContext: "project" };
  assert.equal(isStandaloneConversation(home), true);
  assert.equal(isHomeConversation(home), true);
  assert.equal(isHomeConversation(project), false);
  assert.equal(selectHomeConversation([project, home])?.id, "h1");
});

test("workspace membership helpers remain available to project access rules", () => {
  assert.match(rules, /function isWorkspaceMember\(workspaceId\)/);
  assert.match(rules, /function isPortfolioViewer\(workspaceId\)/);
  assert.match(rules, /match \/workspace_members\/\{memberId\}/);
  assert.match(workspace, /workspace_members/);
});

test("invoice documents are member-listed and finance-operated", () => {
  const operator = ruleFn("isFinanceOperator");
  assert.match(operator, /isWorkspaceAdmin\(workspaceId\)/);
  assert.match(operator, /financeAccess == true/);
  assert.match(rules, /match \/invoice_documents\/\{id\}/);
  assert.match(workspace, /doc\(db, "invoice_documents"/);
  assert.match(workspace, /pushPendingInvoice/);
});

test("feedback reports are member-created and admin-triaged", () => {
  const canRead = ruleFn("canReadFeedbackReport");
  assert.match(canRead, /data\.userId == request\.auth\.uid/);
  assert.match(canRead, /isWorkspaceAdmin\(data\.workspaceId\)/);
  assert.match(rules, /match \/feedback_reports\/\{id\}/);
  assert.match(workspace, /collection\(db, "feedback_reports"\)/);
  assert.match(workspace, /convertFeedbackToPbi/);
});

test("personal Home context still excludes another member's assigned work", () => {
  const actor = { userId: "user-a", memberId: "ws_user-a", email: "a@certo.work" };
  assert.equal(isPersonalWorkItem({ assigneeIds: ["ws_user-a"] }, actor), true);
  assert.equal(isPersonalWorkItem({ userId: "user-b", title: "Theirs" }, actor), false);
});
