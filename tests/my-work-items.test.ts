import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  filterMyWorkTasks,
  isAssignedToActor,
  isMyWorkInboxItem,
  withCreatorAssignee,
} from "../src/lib/myWorkItems";

const actor = {
  userId: "user-alejandro",
  memberId: "ws_user-alejandro",
  email: "alejandro@getboldr.ai",
};

const alejandro = {
  id: "ws_user-alejandro",
  userId: "user-alejandro",
  alias: "Alejandro",
  email: "alejandro@getboldr.ai",
  emailLower: "alejandro@getboldr.ai",
  status: "active",
};

const agustin = {
  id: "ws_user-agustin",
  userId: "user-agustin",
  alias: "Agustin",
  email: "agustin@getboldr.ai",
  emailLower: "agustin@getboldr.ai",
  status: "active",
};

test("Assigned to me only includes items where this user is an assignee", () => {
  const assigned = {
    id: "mine",
    title: "TASK-1",
    assigneeIds: ["ws_user-alejandro"],
    assignees: ["Alejandro"],
    createdBy: "user-alejandro",
  };
  const unassigned = {
    id: "open",
    title: "TASK-3",
    assigneeIds: [],
    assignees: [],
    createdBy: "user-agustin",
    userId: "user-agustin",
  };
  const teammate = {
    id: "theirs",
    title: "Project PBI",
    assigneeIds: ["ws_user-agustin"],
    assignees: ["Agustin"],
    createdBy: "user-agustin",
    userId: "user-agustin",
    projectId: "p1",
  };

  assert.equal(isAssignedToActor(assigned, actor, [alejandro, agustin]), true);
  assert.equal(isAssignedToActor(unassigned, actor, [alejandro, agustin]), false);
  assert.equal(isAssignedToActor(teammate, actor, [alejandro, agustin]), false);

  const assignedTab = filterMyWorkTasks(
    [assigned, unassigned, teammate],
    "assigned",
    actor,
    [alejandro, agustin],
  );
  assert.deepEqual(
    assignedTab.map((item) => item.id),
    ["mine"],
  );
});

test("unassigned items I created land in Inbox, not Assigned", () => {
  const capture = {
    id: "errand",
    title: "Buy milk",
    createdBy: "user-alejandro",
    userId: "user-alejandro",
    assigneeIds: [],
  };
  assert.equal(isMyWorkInboxItem(capture, actor, [alejandro]), true);
  assert.deepEqual(
    filterMyWorkTasks([capture], "assigned", actor, [alejandro]).map((item) => item.id),
    [],
  );
  assert.deepEqual(
    filterMyWorkTasks([capture], "inbox", actor, [alejandro]).map((item) => item.id),
    ["errand"],
  );
});

test("creating an item without assignees assigns the creator", () => {
  const patch = withCreatorAssignee(
    { title: "New PBI", assigneeIds: [] },
    actor,
    [alejandro],
  );
  assert.deepEqual(patch.assigneeIds, ["ws_user-alejandro"]);
  assert.deepEqual(patch.assignees, ["Alejandro"]);
  assert.equal(isAssignedToActor(patch, actor, [alejandro]), true);
});

test("explicit assignees are preserved when someone else is picked", () => {
  const patch = withCreatorAssignee(
    {
      title: "For Agustin",
      assigneeIds: ["ws_user-agustin"],
      assignees: ["Agustin"],
    },
    actor,
    [alejandro, agustin],
  );
  assert.deepEqual(patch.assigneeIds, ["ws_user-agustin"]);
  assert.equal(isAssignedToActor(patch, actor, [alejandro, agustin]), false);
});

test("waiting tab only shows assigned waiting-for items", () => {
  const waiting = {
    id: "wait",
    assigneeIds: ["ws_user-alejandro"],
    gtdActionType: "waiting_for",
  };
  const next = {
    id: "next",
    assigneeIds: ["ws_user-alejandro"],
    gtdActionType: "next_action",
  };
  assert.deepEqual(
    filterMyWorkTasks([waiting, next], "waiting", actor, [alejandro]).map((item) => item.id),
    ["wait"],
  );
  assert.deepEqual(
    filterMyWorkTasks([waiting, next], "assigned", actor, [alejandro]).map((item) => item.id),
    ["next"],
  );
});

test("My Work passes a filtered task list instead of the whole workspace", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(workspace, /filterMyWorkTasks/);
  assert.match(workspace, /tasks=\{myWorkTasks\}/);
  assert.match(workspace, /withCreatorAssignee/);
});
