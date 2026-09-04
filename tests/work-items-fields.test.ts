import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workItems = readFileSync(
  resolve("src/components/WorkItemsCenter.tsx"),
  "utf8",
);
const itemViewMemory = readFileSync(
  resolve("src/lib/itemViewMemory.ts"),
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
  assert.match(myWork[0], /hierarchyTasks=\{tasks\}/);
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

test("project Work tab uses the same Kanban center as Items", () => {
  const projectWork = projectSurfaces.match(
    /data-testid="project-work-kanban"[\s\S]*?<WorkItemsCenter[\s\S]*?\/>/,
  );
  assert.ok(projectWork, "project Work tab is missing WorkItemsCenter");
  assert.match(projectWork[0], /forceMode="kanban"/);
  assert.match(projectWork[0], /activeProject=\{project\}/);
  assert.match(workItems, /forceMode/);
});

test("item field picker exposes every backlog field, including Project", () => {
  assert.doesNotMatch(workItems, /\.slice\(0,\s*6\)/);
  assert.match(workItems, /data-testid="item-fields-button"/);
  assert.match(workItems, /data-testid="item-fields-picker"/);
  assert.match(workItems, /selectableItemColumns\(\)/);
  assert.match(itemViewMemory, /\| "project"/);
  assert.match(itemViewMemory, /\| "sprint"/);
  assert.match(workItems, /aria-label=\{`Project for \$\{title\(item\)\}`\}/);
  assert.match(workItems, /aria-label=\{`Sprint for \$\{title\(item\)\}`\}/);
  assert.match(workItems, /data-testid="item-attr-icons"/);
  assert.match(workItems, /itemAttributePresent/);
  assert.match(workItems, /const ATTR_ICONS/);
  assert.match(workItems, /data-testid="item-attr-parent"/);
  assert.match(workItems, /data-testid="item-assign-parent"/);
  assert.match(workItems, /data-testid="item-parent-field"/);
  assert.match(workItems, /hierarchyTasks/);
  assert.match(workItems, /allowedParentItems/);

  for (const field of expectedFields) {
    assert.match(
      workItems,
      new RegExp(`\\n\\s*${field}:`),
      `list rows must render the ${field} attribute icon`,
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

test("items and project backlog sort families by the parent, not each child", () => {
  assert.match(workItems, /sortHierarchyForest/);
  assert.match(workItems, /hierarchyRoot\(item, tasks\)/);
  assert.match(workItems, /FAMILY_GROUP_BY/);
  assert.match(workItems, /compareVisibleSiblings/);
});

test("items list hides unique keys and shows an inline type icon", () => {
  assert.match(workItems, /do-items-type-flag is-icon is-\$\{kind\}/);
  assert.match(workItems, /data-testid="item-type-flag"/);
  assert.match(workItems, /data-tip=\{workItemLabel\(kind\)\}/);
  assert.match(workItems, /WORK_ITEM_TYPE_ICONS/);
  assert.doesNotMatch(workItems, /do-items-type-flag-label/);
  assert.match(workItems, /do-items-section-head/);
  assert.doesNotMatch(workItems, /workItemLabel\(kind\)\} · \$\{item\.key\}/);
  assert.doesNotMatch(workItems, /item\.key \? `\$\{workItemLabel/);
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(css, /\.do-items-type-flag\.is-icon::after/);
  assert.match(css, /content: attr\(data-tip\)/);
});

test("epic section heads include a complete/reopen control like other rows", () => {
  assert.match(workItems, /data-testid="item-section-head"/);
  assert.match(workItems, /data-testid="item-epic-complete"/);
  assert.match(workItems, /Mark epic done/);
  assert.match(workItems, /toggleDone\(item\)/);
});

test("hierarchy keeps parents collapsed until toggled for this visit", () => {
  assert.match(workItems, /expandedTreeNodes/);
  assert.match(workItems, /isTreeNodeCollapsedState/);
  assert.match(workItems, /data-collapsed=\{collapsed \? "true" : "false"\}/);
  assert.match(workItems, /data-testid="item-tree-children"/);
});

test("expanded parents hide completed children unless status filter includes them", () => {
  assert.match(workItems, /matchesStatusFilter/);
  assert.match(workItems, /visibleChildrenOf/);
  assert.match(workItems, /hierarchyChildren\(childPool, parentIdValue\)\.filter\(\(child\) => matchesStatusFilter\(child, statusFilter\)\)/);
});

test("items list shows faded attribute icons instead of field columns", () => {
  assert.match(workItems, /data-testid="item-attr-icons"/);
  assert.match(workItems, /do-item-attr/);
  assert.match(workItems, /is-off/);
  assert.doesNotMatch(workItems, /data-testid="item-column-resizer"/);
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(css, /\.do-item-attr\.is-off/);
  assert.match(css, /opacity: 0\.16/);
});

test("items list CSS is Asana-like: inline flags, pills, and no boxed fields", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(css, /\.do-items-title \{\s*display: flex/);
  assert.match(css, /\.do-item-attrs/);
  assert.match(css, /\.do-items-status-pill/);
  assert.match(css, /\.do-items-section-head/);
  assert.match(css, /\.do-items-section-head\.do-items-row\.is-icon-list \{\s*[\s\S]*?grid-template-columns: 20px 20px 28px minmax\(0, 1fr\) auto 28px/);
  assert.match(css, /\.do-items-row select,\s*\.do-items-row input \{\s*[\s\S]*?border: 0;/);
  assert.match(css, /\.do-items-row \{\s*[\s\S]*?border-bottom: 1px solid var\(--border\)/);
});

test("items and backlog keep last sort and named views per signed-in user", () => {
  assert.match(workItems, /writeLastItemSession\(viewerId, surface/);
  assert.match(workItems, /readLastItemSession\(viewerId, surface\)/);
  assert.match(workItems, /upsertNamedItemView/);
  assert.match(workItems, /data-testid="item-save-view"/);
  assert.match(workItems, /data-testid="item-view-name"/);
  assert.match(workItems, /Name this view first/);
  assert.doesNotMatch(
    workItems,
    /setGroupBy\(activeProject \? "hierarchy" : "project"\);\s*setPrimarySort\("project"\);\s*setSecondarySort\("priority"\);/,
  );
  assert.doesNotMatch(workItems, /saveItemView\(\); setViewsOpen\(false\)/);
});

test("kanban board uses compact cards, WIP bounce, rules, and flow", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(workItems, /data-testid="kanban-card"/);
  assert.match(workItems, /do-kanban-priority-stripe/);
  assert.match(workItems, /do-kanban-add-task/);
  assert.match(workItems, /data-testid="kanban-column-resizer"/);
  assert.match(workItems, /startKanbanColumnResize/);
  assert.match(workItems, /createKanbanItem/);
  assert.match(workItems, /data-testid="kanban-swimlane"/);
  assert.match(workItems, /data-testid="kanban-board-settings"/);
  assert.match(workItems, /data-testid="kanban-analytics"/);
  assert.match(workItems, /data-testid="kanban-calendar"/);
  assert.match(workItems, /data-testid="item-checklist"/);
  assert.match(workItems, /data-testid="item-comments"/);
  assert.match(workItems, /data-testid="kanban-add-rule"/);
  assert.match(workItems, /canAcceptWipDrop/);
  assert.match(workItems, /WIP limit/);
  assert.match(workItems, /Calendar view/);
  assert.match(workItems, /Flow analytics/);
  assert.doesNotMatch(
    workItems,
    /do-kanban-card[\s\S]{0,800}GTD action type for/,
  );
  assert.match(css, /\.do-kanban-priority-stripe/);
  assert.match(css, /\.do-kanban-col-resizer/);
  assert.match(css, /\.do-kanban-column\.is-drop-ok/);
  assert.match(css, /\.do-kanban-cfd-area/);
  assert.match(css, /cursor: col-resize/);
});

test("any item including epics can be deleted with a grey-to-red bin", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(workItems, /data-testid="item-delete"/);
  assert.match(workItems, /status: "archived"/);
  assert.match(workItems, /archivedAt:/);
  assert.match(workItems, /renderDeleteButton\(item\)/);
  assert.match(workItems, /renderDeleteButton\(selectedItem\)/);
  assert.match(workItems, /renderAttributeIcons\(item\)/);
  assert.match(workItems, /data-testid="item-section-head"/);
  assert.match(workItems, /renderTitleCell\(item, kind, childCount/);
  assert.match(workItems, /data-testid="item-section-head"[\s\S]{0,2000}renderAttributeIcons\(item\)/);
  assert.match(workItems, /data-testid="item-section-head"[\s\S]{0,2000}renderDeleteButton\(item\)/);
  assert.match(workItems, /data-testid="item-section-head"[\s\S]{0,2000}item-epic-complete/);
  assert.doesNotMatch(workItems, /deleteDoc/);
  assert.match(css, /\.do-items-delete \{[\s\S]*?color: var\(--text-muted\)/);
  assert.match(css, /\.do-items-delete:hover[\s\S]*?color: var\(--status-danger\)/);
});

test("list hierarchy nests children under epics and opens an expanded item popup", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(workItems, /data-testid="item-tree-node"/);
  assert.match(workItems, /data-testid="item-tree-toggle"/);
  assert.match(workItems, /hierarchyChildren/);
  assert.match(workItems, /renderForest/);
  assert.match(workItems, /const childPool = parentPool/);
  assert.match(workItems, /visibleChildrenOf/);
  assert.match(workItems, /hierarchyChildren\(childPool, parentIdValue\)/);
  assert.match(workItems, /data-testid="item-expanded-modal"/);
  assert.match(workItems, /createPortal/);
  assert.match(css, /\.do-item-modal-backdrop/);
  assert.match(css, /\.do-item-modal \{/);
});

test("My Work hierarchy expands children from the full pool like Asana project lists", () => {
  assert.match(workItems, /hierarchyTasks/);
  assert.match(workItems, /const parentPool = hierarchyTasks\?\.length \? hierarchyTasks : tasks/);
  assert.match(workItems, /const childPool = parentPool/);
  assert.match(workItems, /hierarchyRoots\(items\)/);
  assert.match(workspace, /hierarchyTasks=\{tasks\}/);
  assert.match(workspace, /tasks=\{myWorkTasks\}/);
});

test("items and backlog can select all visible rows and bulk-edit assignee, date, and project", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(workItems, /data-testid=\{testId\}/);
  assert.match(workItems, /data-testid="items-select-all-summary"/);
  assert.match(workItems, /renderSelectAll\("items-select-all-bulk"\)/);
  assert.match(workItems, /data-testid="item-bulk-select"/);
  assert.match(workItems, /toggleSelectAllVisible/);
  assert.match(workItems, /<option value="none">Unassigned<\/option>/);
  assert.match(workItems, /bulkAssigneeId === "none" \? "Unassign"/);
  assert.match(workItems, /assigneeIds: \[\],/);
  assert.match(workItems, />Clear date</);
  assert.match(workItems, /<option value="none">Remove from project<\/option>/);
  assert.match(workItems, />Apply project</);
  assert.match(css, /\.do-items-select-all/);
  assert.match(css, /\.do-items-select-all-label/);
});

test("portfolio list opens a project from the title and renames on double-click", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(projectSurfaces, /function ProjectTitleCell/);
  assert.match(projectSurfaces, /data-testid="project-title-open"/);
  assert.match(projectSurfaces, /data-testid="project-title-rename"/);
  assert.match(projectSurfaces, /onDoubleClick/);
  assert.match(projectSurfaces, /event.stopPropagation\(\)/);
  assert.match(projectSurfaces, /isTypingTarget/);
  assert.match(projectSurfaces, /onOpen=\{\(\) => onOpenProject\(project\)\}/);
  assert.match(projectSurfaces, /data-testid="projects-select-all-header"/);
  assert.match(projectSurfaces, /toggleSelectAllProjects/);
  assert.match(projectSurfaces, /<option value="none">Unassigned<\/option>/);
  assert.match(projectSurfaces, /Unassign PM/);
  assert.match(projectSurfaces, /Bulk project due date/);
  assert.match(projectSurfaces, /Click the name to open the project/);
  assert.doesNotMatch(projectSurfaces, /Edit the name directly/);
  assert.match(css, /\.do-command-project-title-open/);
});

test("type filter matches exact work item kinds only", () => {
  assert.match(workItems, /const matchesType = typeFilter === "all" \|\| itemKind === typeFilter/);
  assert.doesNotMatch(
    workItems,
    /typeFilter === "pbi" && \["pbi", "story", "task", "bug"\]/,
  );
});

test("detail modal can change item type and re-validate parent", () => {
  assert.match(workItems, /data-testid="item-assign-type"/);
  assert.match(workItems, /changeItemType/);
  assert.match(workItems, /allowedParentKinds\(kind\)/);
  assert.match(workItems, /parentLinkPatch\(parentOk \? currentParent : null\)/);
});

test("expanded tree nodes offer an inline add-child control", () => {
  assert.match(workItems, /data-testid="item-inline-add-child"/);
  assert.match(workItems, /do-items-inline-add-btn/);
  assert.match(workItems, /inlineAddOpen/);
  assert.match(workItems, /createInlineChild/);
  assert.match(workItems, /allowedChildKinds/);
  assert.match(workItems, /parentLinkPatch\(parent\)/);
  assert.match(workItems, /focusInlineAdd/);
});

test("add item form exposes optional quick attributes before create", () => {
  assert.match(workItems, /data-testid="item-create-due"/);
  assert.match(workItems, /data-testid="item-create-assignee"/);
  assert.match(workItems, /data-testid="item-create-priority"/);
  assert.match(workItems, /data-testid="item-create-delivery"/);
  assert.match(workItems, /newDueDate/);
  assert.match(workItems, /newAssigneeId/);
  assert.match(workItems, /newPriority/);
  assert.match(workItems, /newDeliveryEntity/);
  assert.match(workItems, /dueDate: newDueDate \|\| null/);
});

test("toolbar views fields filter sort are icon-only with hover titles", () => {
  assert.match(workItems, /className=\{`do-items-toolbar-icon/);
  assert.match(workItems, /title="Views"/);
  assert.match(workItems, /title="Fields"/);
  assert.match(workItems, /title="Filter"/);
  assert.match(workItems, /title="Sort"/);
  assert.match(workItems, /<LayoutGrid size=\{14\} \/>/);
  assert.match(workItems, /<Settings2 size=\{14\} \/>/);
  assert.match(workItems, /<ArrowUpDown size=\{14\} \/>/);
  assert.doesNotMatch(workItems, />Views<\/button>/);
  assert.doesNotMatch(workItems, />Fields<\/button>/);
  assert.doesNotMatch(workItems, />Sort<\/button>/);
});

test("add item quick attributes use icon popovers like item attrs", () => {
  assert.match(workItems, /do-items-create-attrs/);
  assert.match(workItems, /data-testid="item-create-project"/);
  assert.match(workItems, /data-testid="item-create-type"/);
  assert.match(workItems, /data-testid="item-create-parent"/);
  assert.match(workItems, /createAttr/);
  assert.match(workItems, /WORK_ITEM_TYPE_ICONS\[newType\]/);
});
