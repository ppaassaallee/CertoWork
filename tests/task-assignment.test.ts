import assert from "node:assert/strict";
import test from "node:test";

import {
  assignmentDiff,
  assignmentFieldsFromMembers,
  buildAssignmentNotificationDocs,
  buildMemberIdRemapPatch,
  collaboratorDiff,
  normalizeAssignmentPatch,
  normalizeCollaboratorsPatch,
  patchTouchesAssignment,
  patchTouchesCollaborators,
  resolveAssigneeNamePatch,
  resolveAssigneeSwimlanePatch,
  splitMultiAssigneeToCollaborators,
} from "../src/lib/taskAssignment";
import { applyKanbanAutomations, swimlaneMovePatch } from "../src/lib/kanbanFeatures";
import { isAssignedToActor } from "../src/lib/myWorkItems";
import { memberAssignmentValue } from "../src/lib/workspaceCollaboration";
import { buildTaskAccessPatch } from "../src/lib/accessControl";

const ana = {
  id: "ws_ana",
  userId: "uid-ana",
  alias: "Ana",
  email: "ana@certo.work",
  emailLower: "ana@certo.work",
  status: "active",
};

const bo = {
  id: "ws_bo",
  userId: "uid-bo",
  alias: "Bo",
  email: "bo@certo.work",
  emailLower: "bo@certo.work",
  status: "active",
};

const pendingLuis = {
  id: "ws_invite_luis",
  userId: "pending:luis@certo.work",
  email: "luis@certo.work",
  emailLower: "luis@certo.work",
  status: "invited",
  acceptedMemberId: undefined as string | undefined,
};

test("status patches do not count as assignment writes", () => {
  assert.equal(patchTouchesAssignment({ status: "doing" }), false);
  assert.equal(patchTouchesAssignment({ dueDate: "2026-09-30" }), false);
  assert.equal(patchTouchesAssignment({ assigneeIds: ["ws_ana"] }), true);
  assert.equal(patchTouchesAssignment({ assignee: "Ana" }), true);
  assert.equal(patchTouchesCollaborators({ collaboratorMemberIds: ["ws_bo"] }), true);
});

test("Certo keeps exactly one primary assignee and demotes extras to collaborators", () => {
  const fields = assignmentFieldsFromMembers([ana, bo]);
  assert.deepEqual(fields.assigneeIds, ["ws_ana"]);
  assert.equal(fields.assigneeId, "ws_ana");

  const normalized = normalizeAssignmentPatch(
    {},
    { assigneeIds: [ana.id, bo.id], assignees: ["Ana", "Bo"] },
    [ana, bo],
  );
  assert.deepEqual(normalized.assigneeIds, ["ws_ana"]);
  assert.deepEqual(normalized.collaboratorMemberIds, ["ws_bo"]);

  const split = splitMultiAssigneeToCollaborators(
    { assigneeIds: [ana.id, bo.id], assignees: ["Ana", "Bo"] },
    [ana, bo],
  );
  assert.deepEqual(split?.assigneeIds, ["ws_ana"]);
  assert.deepEqual(split?.collaboratorMemberIds, ["ws_bo"]);
});

test("normalizeAssignmentPatch keeps ids out of status-only patches and resolves name-only assigns", () => {
  const current = {
    assigneeIds: ["ws_bob"],
    assignees: ["Bob"],
    assignee: "Bob",
    owner: "Bob",
  };
  assert.deepEqual(normalizeAssignmentPatch(current, { status: "done" }, [ana]), {
    status: "done",
  });

  const byIds = normalizeAssignmentPatch(
    current,
    { assigneeIds: [ana.id], assignees: ["Pending acceptance"] },
    [ana],
  );
  assert.deepEqual(byIds.assigneeIds, ["ws_ana"]);
  assert.deepEqual(byIds.assignees, ["Ana"]);
  assert.equal(byIds.assignee, "Ana");

  const byName = normalizeAssignmentPatch(
    current,
    { assignee: "Ana", owner: "Ana", assignees: ["Ana"] },
    [ana],
  );
  assert.deepEqual(byName.assigneeIds, ["ws_ana"]);
  assert.equal(byName.assignee, "Ana");
});

test("kanban swimlane and automations write assigneeIds when the member is known", () => {
  assert.deepEqual(swimlaneMovePatch("assignee", "Ana", [], [ana]), {
    assigneeIds: ["ws_ana"],
    assignees: ["Ana"],
    owner: "Ana",
    assignee: "Ana",
    assigneeId: "ws_ana",
  });
  assert.deepEqual(swimlaneMovePatch("assignee", "Unassigned", [], [ana]), {
    assigneeIds: [],
    assignees: [],
    owner: "",
    assignee: "",
    assigneeId: "",
  });

  const automation = applyKanbanAutomations(
    { assignees: ["Ana"], assigneeIds: ["ws_ana"] },
    "doing",
    [{ id: "r1", whenColumn: "doing", setPriority: "1", setAssignee: "Ana" }],
    [ana],
  );
  assert.equal(automation.priority, "1");
  assert.deepEqual(automation.assigneeIds, ["ws_ana"]);
  assert.equal(automation.assignee, "Ana");
});

test("collaborators get access without becoming My Work assignees", () => {
  const collabPatch = normalizeCollaboratorsPatch(
    { collaboratorMemberIds: [bo.id] },
    [ana, bo],
  );
  assert.deepEqual(collabPatch.collaboratorMemberIds, ["ws_bo"]);
  assert.deepEqual(collaboratorDiff({}, collabPatch).added, ["ws_bo"]);

  const access = buildTaskAccessPatch({
    task: {
      assigneeIds: [ana.id],
      collaboratorMemberIds: [bo.id],
    },
    workspaceId: "ws",
    userId: "uid-boss",
    email: "boss@certo.work",
    members: [ana, bo],
  });
  assert.deepEqual(access.assigneeIds, ["ws_ana"]);
  assert.ok(access.accessMemberIds.includes("ws_bo"));
  assert.ok(access.visibleToUserIds.includes("uid-bo"));
  assert.equal(
    isAssignedToActor(
      { assigneeIds: [ana.id], collaboratorMemberIds: [bo.id] },
      { userId: "uid-bo", memberId: "ws_bo", email: "bo@certo.work" },
      [ana, bo],
    ),
    false,
  );
  assert.equal(
    isAssignedToActor(
      { assigneeIds: [ana.id], collaboratorMemberIds: [bo.id] },
      { userId: "uid-ana", memberId: "ws_ana", email: "ana@certo.work" },
      [ana, bo],
    ),
    true,
  );
});

test("invite accept remap replaces pending member ids and grants auth visibility", () => {
  const patch = buildMemberIdRemapPatch(
    {
      assigneeIds: ["ws_invite_luis"],
      collaboratorMemberIds: ["ws_invite_luis"],
      accessMemberIds: ["ws_invite_luis"],
      visibleToUserIds: [],
      sharedWithUserIds: [],
      visibleToEmails: ["luis@certo.work"],
    },
    "ws_invite_luis",
    "ws_uid-luis",
    { userId: "uid-luis", email: "luis@certo.work" },
  );
  assert.deepEqual(patch?.assigneeIds, ["ws_uid-luis"]);
  assert.deepEqual(patch?.collaboratorMemberIds, ["ws_uid-luis"]);
  assert.deepEqual(patch?.accessMemberIds, ["ws_uid-luis"]);
  assert.deepEqual(patch?.visibleToUserIds, ["uid-luis"]);
  assert.deepEqual(patch?.sharedWithUserIds, ["uid-luis"]);
});

test("My Work matches pending assignee seats by email and acceptedMemberId", () => {
  const actor = {
    userId: "uid-luis",
    memberId: "ws_uid-luis",
    email: "luis@certo.work",
  };
  const pendingSeat = { ...pendingLuis };
  const activeSeat = {
    id: "ws_uid-luis",
    userId: "uid-luis",
    alias: "Luis",
    email: "luis@certo.work",
    emailLower: "luis@certo.work",
    status: "active",
  };
  const remappedPending = {
    ...pendingSeat,
    status: "accepted",
    acceptedMemberId: "ws_uid-luis",
    acceptedUserId: "uid-luis",
  };

  assert.equal(
    isAssignedToActor(
      { assigneeIds: ["ws_invite_luis"], assignees: ["Pending acceptance"] },
      actor,
      [pendingSeat, activeSeat],
    ),
    true,
  );
  assert.equal(
    isAssignedToActor(
      { assigneeIds: ["ws_invite_luis"] },
      actor,
      [remappedPending, activeSeat],
    ),
    true,
  );
  assert.equal(
    isAssignedToActor({ assigneeIds: ["ws_uid-luis"], assignees: ["Luis"] }, actor, [activeSeat]),
    true,
  );
});

test("assignment notifications target auth users, not pending seats", () => {
  const docs = buildAssignmentNotificationDocs({
    taskId: "t1",
    taskTitle: "Ship overhaul",
    workspaceId: "ws1",
    assignedByUserId: "uid-boss",
    assignedByName: "Boss",
    members: [ana, pendingLuis],
    addedMemberIds: ["ws_ana", "ws_invite_luis"],
  });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].userId, "uid-ana");
  assert.equal(docs[0].type, "task_assigned");
});

test("invited members store email labels instead of Pending acceptance", () => {
  assert.equal(memberAssignmentValue(pendingLuis), "luis@certo.work");
  assert.deepEqual(assignmentFieldsFromMembers([pendingLuis as any]).assignees, [
    "luis@certo.work",
  ]);
  assert.deepEqual(resolveAssigneeNamePatch("luis@certo.work", [pendingLuis as any]).assigneeIds, [
    "ws_invite_luis",
  ]);
  assert.deepEqual(resolveAssigneeSwimlanePatch("Unassigned"), {
    assignee: "",
    owner: "",
    assignees: [],
    assigneeIds: [],
    assigneeId: "",
  });
  assert.deepEqual(assignmentDiff({ assigneeIds: ["a"] }, { assigneeIds: ["a", "b"] }).added, ["b"]);
});
