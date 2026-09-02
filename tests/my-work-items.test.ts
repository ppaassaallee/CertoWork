import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  creatorAssigneePatch,
  filterMyWorkTasks,
  isAssignedToActor,
  needsCreatorAssigneeRestore,
  todayPlanGroups,
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

test("Assigned keeps items I created even when they were stored without assignees", () => {
  const assigned = {
    id: "mine",
    title: "TASK-1",
    assigneeIds: ["ws_user-alejandro"],
    assignees: ["Alejandro"],
    createdBy: "user-alejandro",
  };
  const myUnassigned = {
    id: "errand",
    title: "Buy milk",
    assigneeIds: [],
    createdBy: "user-alejandro",
    userId: "user-alejandro",
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
    [assigned, myUnassigned, unassigned, teammate],
    "assigned",
    actor,
    [alejandro, agustin],
  );
  assert.deepEqual(
    assignedTab.map((item) => item.id).sort(),
    ["errand", "mine"],
  );
  assert.equal(assignedTab.includes(myUnassigned), true);
  assert.equal(assignedTab.includes(unassigned), false);
  assert.equal(assignedTab.includes(teammate), false);
});

test("My Work filtering never mutates or drops the source record object", () => {
  const capture = {
    id: "errand",
    title: "Buy milk",
    createdBy: "user-alejandro",
    userId: "user-alejandro",
    assigneeIds: [],
  };
  const [visible] = filterMyWorkTasks([capture], "assigned", actor, [alejandro]);
  assert.equal(visible, capture);
  assert.equal(needsCreatorAssigneeRestore(capture, actor), true);
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

test("today tab groups must-dos and should-dos from today's goals", () => {
  const must = {
    id: "must",
    title: "Ship demo",
    assigneeIds: ["ws_user-alejandro"],
    priority: "1",
    dueDate: "2026-09-02",
    isOneThing: true,
    status: "todo",
  };
  const should = {
    id: "should",
    title: "Review copy",
    assigneeIds: ["ws_user-alejandro"],
    priority: "2",
    timeSector: "today",
    status: "todo",
  };
  const later = {
    id: "later",
    title: "Next month",
    assigneeIds: ["ws_user-alejandro"],
    priority: "1",
    timeSector: "next_month",
    status: "todo",
  };
  const todayTab = filterMyWorkTasks(
    [must, should, later],
    "today",
    actor,
    [alejandro],
  );
  assert.deepEqual(todayTab.map((item) => item.id).sort(), ["must", "should"]);
  const plan = todayPlanGroups(todayTab);
  assert.deepEqual(plan.mustDos.map((item) => item.id), ["must"]);
  assert.deepEqual(plan.shouldDos.map((item) => item.id), ["should"]);
});

test("My Work passes a filtered task list instead of the whole workspace", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const helpers = readFileSync(resolve("src/lib/myWorkItems.ts"), "utf8");
  assert.match(workspace, /filterMyWorkTasks/);
  assert.match(workspace, /tasks=\{myWorkTasks\}/);
  assert.match(workspace, /MyWorkTodayPanel/);
  assert.match(workspace, /data-testid="my-work-today-tab"/);
  assert.match(workspace, /withCreatorAssignee/);
  assert.match(workspace, /needsCreatorAssigneeRestore/);
  assert.match(workspace, /updateDoc\(doc\(db, "tasks", item\.id\)/);
  assert.match(helpers, /My Work is a view\. It never deletes records\./);
  assert.doesNotMatch(helpers, /deleteDoc/);
});

test("self-created items without createdBy still belong in Assigned", () => {
  const legacy = {
    id: "legacy",
    title: "Old capture",
    userId: "user-alejandro",
    assigneeIds: [],
  };
  assert.deepEqual(
    filterMyWorkTasks([legacy], "assigned", actor, [alejandro]).map((item) => item.id),
    ["legacy"],
  );
  assert.equal(needsCreatorAssigneeRestore(legacy, actor), true);
});

test("teammate unassigned items are not restored onto my assignee list", () => {
  const theirs = {
    id: "open",
    title: "TASK-3",
    userId: "user-agustin",
    createdBy: "user-agustin",
    assigneeIds: [],
  };
  assert.equal(needsCreatorAssigneeRestore(theirs, actor), false);
  assert.deepEqual(filterMyWorkTasks([theirs], "assigned", actor, [alejandro, agustin]), []);
  assert.deepEqual(creatorAssigneePatch(actor, [alejandro]).assigneeIds, ["ws_user-alejandro"]);
});
