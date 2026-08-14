import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRelativeDate,
  buildProjectTemplate,
  instantiateTemplateItems,
} from "../src/lib/projectTemplates";

test("project templates preserve hierarchy and relative dates", () => {
  const project = { id: "p1", title: "Launch", startDate: "2026-09-01", projectManagerId: "pm1" };
  const tasks = [
    { id: "e1", projectId: "p1", title: "Launch epic", workItemType: "epic", dueDate: "2026-09-08", assigneeIds: ["pm1"] },
    { id: "b1", projectId: "p1", title: "Release PBI", workItemType: "pbi", parentId: "e1", dueDate: "2026-09-15" },
  ];
  const template = buildProjectTemplate(project, tasks, "Launch template");
  assert.equal(template.items[1].parentTemplateKey, template.items[0].templateKey);
  assert.equal(template.items[0].dueOffsetDays, 7);
  assert.equal(template.items[0].assigneeRole, "project_manager");
});

test("applying a template recalculates dates and resolves role placeholders", () => {
  const items = instantiateTemplateItems(
    { items: [{ templateKey: "i1", parentTemplateKey: null, title: "Kick off", dueOffsetDays: 4, startOffsetDays: 1, assigneeRole: "project_manager" }] },
    "2026-10-10",
    { project_manager: { id: "member-1", name: "Alex" } },
  );
  assert.equal(items[0].startDate, "2026-10-11");
  assert.equal(items[0].dueDate, "2026-10-14");
  assert.deepEqual(items[0].assigneeIds, ["member-1"]);
  assert.equal(applyRelativeDate("2026-12-30", 3), "2027-01-02");
});
