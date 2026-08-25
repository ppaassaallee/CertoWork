import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workItems = readFileSync(
  resolve("src/components/WorkItemsCenter.tsx"),
  "utf8",
);
const workspace = readFileSync(
  resolve("src/components/DelivereeWorkspace.tsx"),
  "utf8",
);
const projectSurfaces = readFileSync(
  resolve("src/components/ProjectSurfaces.tsx"),
  "utf8",
);

const expectedFields = [
  "project",
  "delivery_entity",
  "client_entity",
  "tags",
  "work_category",
  "product_phase",
  "status",
  "priority",
  "gtd",
  "bucket",
  "assignees",
  "due",
  "sprint",
];

test("My Work uses the same unscoped item center as project backlog", () => {
  const myWork = workspace.match(
    /data-testid="my-work-shell"[\s\S]*?<WorkItemsCenter[\s\S]*?\/>/,
  );
  assert.ok(myWork, "My Work shell is missing WorkItemsCenter");
  assert.match(myWork[0], /activeProject=\{null\}/);
  assert.match(myWork[0], /tasks=\{myWorkTasks\}/);
  assert.match(myWork[0], /tags=\{categories\}/);
  assert.match(myWork[0], /onCreateSprint=\{createSprint\}/);

  const projectItems = projectSurfaces.match(
    /data-testid="project-items"[\s\S]*?<WorkItemsCenter[\s\S]*?\/>/,
  );
  assert.ok(projectItems, "project Items tab is missing WorkItemsCenter");
  assert.match(projectItems[0], /tags=\{tags\}/);
  assert.match(projectItems[0], /onCreateControlledOption=\{onCreateControlledOption\}/);
  assert.match(projectItems[0], /projects=\{workspaceProjects/);
});

test("item field picker exposes every backlog field, including Project", () => {
  assert.doesNotMatch(workItems, /\.slice\(0,\s*6\)/);
  assert.match(workItems, /data-testid="item-fields-button"/);
  assert.match(workItems, /data-testid="item-fields-picker"/);
  assert.match(workItems, /selectableItemColumns\(\)/);
  assert.match(workItems, /\| "project"/);
  assert.match(workItems, /\| "sprint"/);
  assert.match(workItems, /aria-label=\{`Project for \$\{title\(item\)\}`\}/);
  assert.match(workItems, /aria-label=\{`Sprint for \$\{title\(item\)\}`\}/);

  for (const field of expectedFields) {
    assert.match(
      workItems,
      new RegExp(`itemColumnSet\\.has\\("${field}"\\)`),
      `list rows must render the ${field} field`,
    );
  }
});

test("My Work keeps backlog features that used to require an active project", () => {
  assert.match(workItems, /aria-label="Epics view"/);
  assert.doesNotMatch(
    workItems,
    /\{activeProject && <button aria-label="Epics view"/,
  );
  assert.match(workItems, /<option value="sprint">Sprint<\/option>/);
  assert.match(workItems, /\{onCreateSprint && \(/);
  assert.doesNotMatch(
    workItems,
    /\{activeProject && onCreateSprint && \(/,
  );
});

test("items and project backlog can paste a line-per-PBI list with tabbed subtasks", () => {
  assert.match(workItems, /aria-label="Paste bulk items"/);
  assert.match(workItems, /parseBulkPasteItems/);
  assert.match(workItems, /workItemType: kind/);
  assert.match(workspace, /activeProject=\{null\}/);
  assert.match(projectSurfaces, /activeProject=\{project\}/);
});
