import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRelationshipRoots,
  buildRelationshipTree,
  relationshipBranchIds,
  relationshipNodeCount,
} from "../src/lib/relationshipMap";

const projects = [
  { id: "project-a", title: "Alpha rollout", clientEntity: "Acme", deliveryEntity: "OneSource" },
  { id: "project-b", title: "Beta support", clientEntity: "Beta", deliveryEntity: "OneSource" },
];

const tasks = [
  { id: "epic-a", projectId: "project-a", title: "Foundation", workItemType: "epic" },
  { id: "feature-a", projectId: "project-a", parentId: "epic-a", epicId: "epic-a", title: "Intake", workItemType: "feature" },
  { id: "pbi-a", projectId: "project-a", parentId: "feature-a", featureId: "feature-a", title: "Capture request", workItemType: "pbi", stakeholderIds: ["person-a"] },
  { id: "sub-a", projectId: "project-a", parentId: "pbi-a", title: "Validate form", workItemType: "subtask" },
  { id: "pbi-b", projectId: "project-b", title: "Respond to ticket", workItemType: "pbi", stakeholderIds: ["person-b"] },
  { id: "standalone", title: "Call customer", workItemType: "pbi", stakeholderIds: ["person-a"] },
];

test("relationship roots connect clients and delivery entities without cross-project leakage", () => {
  const clients = buildRelationshipRoots({ lens: "client", projects, tasks, stakeholders: [] });
  const acme = clients.find((root) => root.label === "Acme");
  assert.deepEqual(acme?.projectIds, ["project-a"]);
  assert.ok(acme?.itemIds.includes("pbi-a"));
  assert.equal(acme?.itemIds.includes("pbi-b"), false);

  const delivery = buildRelationshipRoots({ lens: "delivery", projects, tasks, stakeholders: [] });
  const oneSource = delivery.find((root) => root.label === "OneSource");
  assert.deepEqual(new Set(oneSource?.projectIds), new Set(["project-a", "project-b"]));
});

test("people roots include related projects and true standalone commitments", () => {
  const people = buildRelationshipRoots({
    lens: "people",
    projects,
    tasks,
    stakeholders: [
      { id: "person-a", name: "Ana", role: "Sponsor" },
      { id: "person-b", name: "Ben" },
    ],
  });
  const ana = people.find((root) => root.id === "person-a")!;
  assert.deepEqual(ana.projectIds, ["project-a"]);
  assert.deepEqual(new Set(ana.itemIds), new Set(["pbi-a", "standalone"]));

  const tree = buildRelationshipTree({ root: ana, projects, tasks });
  assert.equal(tree[0].kind, "project");
  assert.equal(tree.at(-1)?.id, "standalone");
});

test("map preserves Project to Epic to Feature to PBI to Sub Task hierarchy", () => {
  const root = buildRelationshipRoots({ lens: "project", projects, tasks, stakeholders: [] })
    .find((entry) => entry.id === "project-a")!;
  const tree = buildRelationshipTree({ root, projects, tasks });
  assert.equal(tree[0].kind, "project");
  assert.equal(tree[0].children[0].kind, "epic");
  assert.equal(tree[0].children[0].children[0].kind, "feature");
  assert.equal(tree[0].children[0].children[0].children[0].kind, "pbi");
  assert.equal(tree[0].children[0].children[0].children[0].children[0].kind, "subtask");
  assert.equal(relationshipNodeCount(tree), 5);
  assert.deepEqual(relationshipBranchIds(tree), ["project-a", "epic-a", "feature-a", "pbi-a"]);
});
