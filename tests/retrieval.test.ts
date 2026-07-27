import assert from "node:assert/strict";
import test from "node:test";
import { rankRetrievalCandidates } from "../server/retrieval";

test("ranks title and semantic-layer matches across multiple record types", () => {
  const results = rankRetrievalCandidates("weekly planning risks", [
    {
      id: "note-1",
      source: "knowledge",
      title: "Weekly planning playbook",
      body: "Review blockers and commitments before selecting priorities.",
    },
    {
      id: "task-1",
      source: "task",
      title: "Buy coffee",
    },
    {
      id: "project-1",
      source: "project",
      title: "Operations initiative",
      body: "The main dependency is the finance approval.",
    },
  ]);

  assert.equal(results[0].id, "note-1");
  assert.ok(results.some((result) => result.id === "project-1"));
  assert.ok(!results.some((result) => result.id === "task-1"));
});

