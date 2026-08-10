import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotebookContext,
  collectWorkspaceTags,
  parseTags,
} from "../src/lib/notebookContext";

test("normalizes reusable tags for notes and workspace records", () => {
  assert.deepEqual(parseTags("Field Ops, #PRD\nClient Discovery, field ops"), [
    "field-ops",
    "prd",
    "client-discovery",
  ]);
  assert.deepEqual(collectWorkspaceTags([
    { tags: ["prd", "client"] },
    { labels: ["urgent", "client"] },
  ]), ["client", "prd", "urgent"]);
});

test("builds notebook context from notebook section note hierarchy", () => {
  const context = buildNotebookContext([
    { id: "nb1", kind: "notebook", title: "KruOps Notebook" },
    { id: "sec1", kind: "section", title: "PRD", notebookId: "nb1" },
    {
      id: "note1",
      kind: "note",
      title: "Pilot assumptions",
      content: "The Castillo Retail pilot needs traceability, assignment flow, and deployment evidence.",
      notebookId: "nb1",
      sectionId: "sec1",
      projectId: "project1",
      tags: ["pilot", "prd"],
      status: "active",
      updatedAt: 2_000,
    },
    {
      id: "note2",
      kind: "note",
      title: "Personal scratch",
      content: "Buy coffee.",
      status: "active",
      updatedAt: 1_000,
    },
  ], "assignment pilot evidence", { activeProjectId: "project1" });

  assert.equal(context[0].id, "note1");
  assert.equal(context[0].notebook, "KruOps Notebook");
  assert.equal(context[0].section, "PRD");
  assert.equal(context[0].type, "Notebook note");
});

test("archived notes are not sent into assistant context", () => {
  const context = buildNotebookContext([
    {
      id: "note1",
      kind: "note",
      title: "Archived",
      content: "Important old content",
      status: "archived",
    },
  ], "important");

  assert.equal(context.length, 0);
});
