import assert from "node:assert/strict";
import test from "node:test";
import { countBulkPasteItems, parseBulkPasteItems } from "../src/lib/bulkPasteItems";
import { fallbackMagicProject, normalizeMagicProject } from "../src/lib/magicProject";
import { plainNoteText } from "../src/lib/noteMarkup";

test("bulk paste turns each line into a PBI and tabs into subtasks", () => {
  const tree = parseBulkPasteItems(
    "Launch checkout\n\tMap payment errors\n\tWrite retry copy\nPilot store\n  Train cashiers",
  );
  assert.equal(tree.length, 2);
  assert.equal(tree[0].kind, "pbi");
  assert.equal(tree[0].title, "Launch checkout");
  assert.equal(tree[0].children.length, 2);
  assert.equal(tree[0].children[0].kind, "subtask");
  assert.equal(tree[0].children[0].title, "Map payment errors");
  assert.equal(tree[1].title, "Pilot store");
  assert.equal(tree[1].children[0].title, "Train cashiers");
  assert.deepEqual(countBulkPasteItems(tree), { pbis: 2, subtasks: 3 });
});

test("bulk paste ignores markdown bullets and empty lines", () => {
  const tree = parseBulkPasteItems("- First PBI\n\n* Second PBI\n\t- Nested work");
  assert.equal(tree.map((item) => item.title).join("|"), "First PBI|Second PBI");
  assert.equal(tree[1].children[0].title, "Nested work");
});

test("magic project fallback reads a pasted definition", () => {
  const blueprint = fallbackMagicProject(`# FieldOps Pilot
Owner: Alejandro
Target date: 2026-09-15
Outcome: Run one technician assignment pilot.
Why: Prove the model before expanding.

Success criteria:
Pilot journey completed
Owner can see status

Backlog:
Kickoff workshop
	Send agenda
Scope gate
`);
  assert.equal(blueprint.title, "FieldOps Pilot");
  assert.equal(blueprint.owner, "Alejandro");
  assert.equal(blueprint.targetDate, "2026-09-15");
  assert.ok(blueprint.successCriteria.includes("Pilot journey completed"));
  assert.equal(blueprint.items[0].title, "Kickoff workshop");
  assert.equal(blueprint.items[0].children?.[0]?.title, "Send agenda");
  assert.match(blueprint.kickoff.title, /Kickoff FieldOps Pilot/);
});

test("magic project normalize fills missing AI fields from the source text", () => {
  const blueprint = normalizeMagicProject(
    { title: "KruOps", methodology: "Scrum", items: [{ title: "Epic one", kind: "epic" }] },
    "Project: Ignore me\nOutcome: Marketplace live.",
  );
  assert.equal(blueprint.title, "KruOps");
  assert.equal(blueprint.methodology, "Scrum");
  assert.equal(blueprint.items[0].kind, "epic");
  assert.match(blueprint.outcome, /Marketplace live|Deliver KruOps/);
});

test("note markup strips markers for list snippets", () => {
  assert.equal(plainNoteText("**Bold** and *italic* plan"), "Bold and italic plan");
});
