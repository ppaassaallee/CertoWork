import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectDocumentContext } from "../src/lib/projectContext";

test("retrieves relevant project-document excerpts without sending an entire long PRD", () => {
  const filler = "ordinary background context ".repeat(180);
  const context = buildProjectDocumentContext(
    [{
      id: "prd-1",
      title: "FieldOps PRD",
      projectId: "fieldops",
      content: `${filler} Security requires tenant isolation and an auditable authorization boundary. ${filler}`,
    }],
    "What does the PRD require for security and authorization?",
  );

  assert.equal(context.length, 1);
  assert.equal(context[0].id, "prd-1");
  assert.ok(context[0].characterCount > 2_800);
  assert.ok(context[0].excerpts.some((chunk) => chunk.excerpt.includes("tenant isolation")));
  assert.ok(context[0].excerpts.reduce((sum, chunk) => sum + chunk.excerpt.length, 0) < context[0].characterCount);
});
