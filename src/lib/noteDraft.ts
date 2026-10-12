export type NoteDraftFields = {
  title: string;
  content: string;
  projectId: string;
  tagsText: string;
};

export type NoteDraftSource = {
  title?: string;
  content?: string;
  projectId?: string | null;
  tags?: string[];
};

function tagsFromText(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

/** True only when the editor differs from the saved note. Opening a note is not a change. */
export function noteDraftChanged(editor: NoteDraftFields, note: NoteDraftSource) {
  return (
    editor.title !== (note.title || "") ||
    editor.content !== (note.content || "") ||
    (editor.projectId || "") !== (note.projectId || "") ||
    tagsFromText(editor.tagsText).join(",") !== (note.tags || []).join(",")
  );
}
