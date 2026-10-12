export type NoteDraft = {
  title: string;
  content: string;
  tagsText: string;
  projectId: string;
};

export type NoteSnapshot = {
  title?: string;
  content?: string;
  tags?: string[];
  projectId?: string;
};

function tagsFromText(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function noteDraftMatches(editor: NoteDraft, note: NoteSnapshot | null) {
  if (!note) return false;
  return (
    editor.title === (note.title || "") &&
    editor.content === (note.content || "") &&
    editor.projectId === (note.projectId || "") &&
    tagsFromText(editor.tagsText).join(",") === (note.tags || []).join(",")
  );
}

/**
 * Opening a note hydrates the editor. That is not an edit.
 * Autosave runs only after the user changes the draft for the note that was hydrated.
 */
export function mayAutosaveNote(input: {
  hydratedNoteId: string | null;
  noteId: string | null;
  userEdited: boolean;
}) {
  return Boolean(
    input.userEdited && input.noteId && input.hydratedNoteId === input.noteId,
  );
}
