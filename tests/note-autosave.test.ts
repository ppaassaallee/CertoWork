import assert from "node:assert/strict";
import test from "node:test";

import { mayAutosaveNote, noteDraftMatches } from "../src/lib/noteAutosave";

test("opening a note does not count as an edit", () => {
  assert.equal(
    mayAutosaveNote({
      hydratedNoteId: "note-1",
      noteId: "note-1",
      userEdited: false,
    }),
    false,
  );
});

test("a hydrated note saves only after the user edits it", () => {
  assert.equal(
    mayAutosaveNote({
      hydratedNoteId: "note-1",
      noteId: "note-1",
      userEdited: true,
    }),
    true,
  );
  assert.equal(
    mayAutosaveNote({
      hydratedNoteId: "note-1",
      noteId: "note-2",
      userEdited: true,
    }),
    false,
  );
});

test("hydration does not treat the active project as a note edit", () => {
  assert.equal(
    noteDraftMatches(
      {
        title: "Standup",
        content: "Notes",
        tagsText: "ops",
        projectId: "",
      },
      { title: "Standup", content: "Notes", tags: ["ops"], projectId: "" },
    ),
    true,
  );
  assert.equal(
    noteDraftMatches(
      {
        title: "Standup",
        content: "Notes",
        tagsText: "ops",
        projectId: "project-from-route",
      },
      { title: "Standup", content: "Notes", tags: ["ops"], projectId: "" },
    ),
    false,
  );
});
