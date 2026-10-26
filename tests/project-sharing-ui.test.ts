import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { projectOwnerDisplay } from "../src/features/views/ProjectsViewsSurface";

test("project owner labels resolve member ids without exposing opaque identifiers", () => {
  const members = [
    {
      id: "ws_member_alejandro",
      userId: "2duHALPBnsgbFpzO1j4XA0SdqCt20",
      displayName: "Alejandro Pascual",
      email: "alejandro@getboldr.ai",
      status: "active",
    },
  ];

  assert.equal(
    projectOwnerDisplay(
      { id: "project-1", projectManagerId: "2duHALPBnsgbFpzO1j4XA0SdqCt20" },
      members,
    ),
    "Alejandro Pascual",
  );
  assert.equal(
    projectOwnerDisplay(
      { id: "project-2", ownerId: "unresolvedOpaqueAuthId123456789" },
      members,
    ),
    "—",
  );
  assert.equal(
    projectOwnerDisplay({ id: "project-3", projectManager: "Isaac" }, members),
    "Isaac",
  );
});

test("project and item surfaces expose direct workspace sharing", () => {
  const projects = readFileSync(resolve("src/features/views/ProjectsViewsSurface.tsx"), "utf8");
  const itemModal = readFileSync(resolve("src/features/items/ItemModal/ItemModal.tsx"), "utf8");

  assert.match(projects, /Share project/);
  assert.match(projects, /withCollaboratorAccess/);
  assert.match(projects, /collaborationShareGrant/);
  assert.match(itemModal, /Share item with/);
  assert.match(itemModal, /withCollaboratorAccess/);
  assert.match(itemModal, /collaborationShareGrant/);
});

test("moving an assigned item grants its people access to the destination project", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const updateStart = workspace.indexOf("const updateProjectTask = async");
  const updateEnd = workspace.indexOf("const deleteProjectTask", updateStart);
  const updateTask = workspace.slice(updateStart, updateEnd > updateStart ? updateEnd : undefined);

  assert.match(updateTask, /const movesProject/);
  assert.match(updateTask, /touchesAssignment \|\| touchesCollaborators \|\| movesProject/);
  assert.match(updateTask, /teamMemberIds: arrayUnion/);
  assert.doesNotMatch(updateTask, /projects\.some\(\(project\) => project\.id === linkedProjectId\)/);
});

test("legacy access repair is additive and preserves explicitly private items", () => {
  const repair = readFileSync(resolve("scripts/repair-project-access.mjs"), "utf8");
  assert.match(repair, /if \(!String\(task\.visibility \|\| ""\)\.trim\(\)\)/);
  assert.match(repair, /visibility: "project"/);
  assert.match(repair, /teamMemberIds: FieldValue\.arrayUnion/);
  assert.match(repair, /visibleToUserIds: FieldValue\.arrayUnion/);
  assert.doesNotMatch(repair, /visibility:\s*"private"/);
  assert.match(repair, /const apply = process\.argv\.includes\("--apply"\)/);
});
