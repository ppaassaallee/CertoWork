import { useEffect, useState } from "react";
import { FileText, Plus } from "../../../components/ui/Icon";
import { useAuth } from "../../../lib/AuthContext";
import { getLocale } from "../../../lib/i18n";
import {
  createNote,
  ensurePersonalNotebook,
  ensureProjectNotebook,
  linkNote,
  listNotesLinkedTo,
  noteTemplate,
  withDefaults,
  type NoteType,
} from "../../../lib/notes";
import type { NotebookEntry } from "../../../lib/notebookContext";
import { copy } from "./labels";

function relative(iso: string | null | undefined, locale: "es" | "en") {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return locale === "es" ? "ahora" : "now";
  if (mins < 60) return locale === "es" ? `hace ${mins} min` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return locale === "es" ? `hace ${hours} h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return locale === "es" ? `hace ${days} d` : `${days}d ago`;
}

export function ItemNotesSection({
  item,
  notebookEntries,
  onOpenNote,
}: {
  item: any;
  notebookEntries: NotebookEntry[];
  onOpenNote?: (noteId: string) => void;
}) {
  const { user, workspace } = useAuth();
  const locale = getLocale() === "es" ? "es" : "en";
  const [noteIds, setNoteIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = async () => {
    if (!workspace?.id || !item?.id) return;
    setNoteIds(await listNotesLinkedTo(workspace.id, { type: "task", id: String(item.id) }));
  };

  useEffect(() => {
    void refresh();
  }, [item?.id, workspace?.id, item?.linkedDocumentIds?.length]);

  const linked = noteIds
    .map((id) => notebookEntries.find((entry) => entry.id === id))
    .filter(Boolean)
    .map((entry) => withDefaults(entry as NotebookEntry))
    .slice(0, 5);

  const createLinked = async (noteType: NoteType) => {
    if (!user || !workspace) return;
    setMenuOpen(false);
    const tpl = noteTemplate(noteType, { date: new Date().toISOString().slice(0, 10) });
    let notebookId = "";
    let sectionId: string | null = null;
    const projectId = item.projectId ? String(item.projectId) : null;
    if (projectId) {
      notebookId = await ensureProjectNotebook(
        workspace.id,
        projectId,
        String(item.projectTitle || "Project"),
        user.uid,
      );
    } else {
      const personal = await ensurePersonalNotebook(user.uid, workspace.id);
      notebookId = personal.notebookId;
      sectionId = personal.inboxId;
    }
    const noteId = await createNote({
      userId: user.uid,
      workspaceId: workspace.id,
      notebookId,
      sectionId,
      title: tpl.title,
      noteType,
      projectId,
      contentMarkdown: tpl.content,
    });
    await linkNote({
      workspaceId: workspace.id,
      userId: user.uid,
      noteId,
      target: { type: "task", id: String(item.id) },
    });
    await refresh();
    onOpenNote?.(noteId);
  };

  return (
    <section className="cw-item-card" data-testid="item-notes">
      <header>
        <strong>
          <FileText size={12} style={{ marginRight: 6 }} />
          {copy("notes", locale)} {linked.length || noteIds.length || ""}
        </strong>
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen((v) => !v)} type="button">
            <Plus size={12} />
          </button>
          {menuOpen ? (
            <div className="cw-notes-popover" style={{ right: 0, minWidth: 160 }}>
              <button onClick={() => void createLinked("note")} type="button">
                {locale === "es" ? "Nota rápida" : "Quick note"}
              </button>
              <button onClick={() => void createLinked("meeting")} type="button">
                {locale === "es" ? "Nota de reunión" : "Meeting note"}
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {linked.map((note) => (
        <article key={note.id}>
          <button
            onClick={() => onOpenNote?.(note.id)}
            style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
            type="button"
          >
            <span>
              {note.noteType || "note"} ·{" "}
              {relative(note.lastEditedAt || null, locale)}
            </span>
            <p style={{ fontWeight: 500, margin: "2px 0" }}>{note.title || "Untitled"}</p>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: 0 }}>
              {String(note.content || "")
                .replace(/:::[a-z0-9_]+\s*/g, "")
                .replace(/[#*_`~\[\]]/g, "")
                .slice(0, 90)}
            </p>
          </button>
        </article>
      ))}
      {!linked.length ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
          {locale === "es" ? "Sin notas vinculadas" : "No linked notes"}
        </p>
      ) : null}
    </section>
  );
}
