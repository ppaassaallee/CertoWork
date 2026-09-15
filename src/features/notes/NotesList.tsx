import { Link2, Sparkles } from "../../components/ui/Icon";
import { t } from "../../lib/i18n";
import type { NotebookEntry } from "../../lib/notebookContext";
import { withDefaults } from "../../lib/notes";

function excerpt(content: string) {
  return String(content || "")
    .replace(/:::[a-z0-9_]+\s*/gi, " ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function relative(value: unknown, locale: "es" | "en") {
  const ms =
    typeof (value as { toMillis?: () => number })?.toMillis === "function"
      ? (value as { toMillis: () => number }).toMillis()
      : typeof (value as { seconds?: number })?.seconds === "number"
        ? (value as { seconds: number }).seconds * 1000
        : typeof value === "string"
          ? Date.parse(value)
          : 0;
  if (!ms) return "";
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 1) return locale === "es" ? "ahora" : "now";
  if (mins < 60) return locale === "es" ? `hace ${mins} min` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return locale === "es" ? `hace ${hours} h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return locale === "es" ? `hace ${days} d` : `${days}d ago`;
}

export type NotesListProps = {
  notebookTitle: string;
  notes: NotebookEntry[];
  selectedNoteId: string;
  tab: "all" | "meetings" | "mine" | "linked";
  showMineTab: boolean;
  showLinkedTab: boolean;
  onTab: (tab: NotesListProps["tab"]) => void;
  onSelect: (id: string) => void;
  onCreate: (noteType: "note" | "meeting" | "idea" | "spec" | "client") => void;
  locale: "es" | "en";
  currentUserId?: string;
};

export function NotesList({
  notebookTitle,
  notes,
  selectedNoteId,
  tab,
  showMineTab,
  showLinkedTab,
  onTab,
  onSelect,
  onCreate,
  locale,
  currentUserId,
}: NotesListProps) {
  const filtered = notes.filter((note) => {
    const ext = withDefaults(note);
    if (tab === "meetings") return ext.noteType === "meeting";
    if (tab === "mine") return note.userId === currentUserId || note.createdBy === currentUserId;
    if (tab === "linked") return (ext.linkCount || 0) > 0;
    return true;
  });

  return (
    <aside className="cw-notes-list" data-testid="notes-list">
      <div className="cw-notes-list-head">
        <strong>{notebookTitle || t("notes.untitled")}</strong>
        <details>
          <summary className="cw-notes-muted-btn" style={{ listStyle: "none", cursor: "pointer" }}>
            + {locale === "es" ? "Nota" : "Note"} ▾
          </summary>
          <div className="cw-notes-popover" style={{ position: "relative" }}>
            {(
              [
                ["note", locale === "es" ? "Nota" : "Note"],
                ["meeting", locale === "es" ? "Reunión" : "Meeting"],
                ["idea", "Idea"],
                ["spec", "Spec"],
                ["client", locale === "es" ? "Cliente" : "Client"],
              ] as const
            ).map(([type, label]) => (
              <button key={type} onClick={() => onCreate(type)} type="button">
                {label}
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className="cw-notes-tabs">
        <button className={tab === "all" ? "is-active" : ""} onClick={() => onTab("all")} type="button">
          {locale === "es" ? "Todas" : "All"} {notes.length}
        </button>
        <button className={tab === "meetings" ? "is-active" : ""} onClick={() => onTab("meetings")} type="button">
          {locale === "es" ? "Reuniones" : "Meetings"}
        </button>
        {showMineTab ? (
          <button className={tab === "mine" ? "is-active" : ""} onClick={() => onTab("mine")} type="button">
            {locale === "es" ? "Mías" : "Mine"}
          </button>
        ) : null}
        {showLinkedTab ? (
          <button className={tab === "linked" ? "is-active" : ""} onClick={() => onTab("linked")} type="button">
            {locale === "es" ? "Vinculadas" : "Linked"}
          </button>
        ) : null}
      </div>
      <div style={{ overflow: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div className="cw-notes-empty">
            {t("notes.emptyList")}{" "}
            <button className="cw-notes-muted-btn" onClick={() => onCreate("note")} type="button">
              + {locale === "es" ? "Nota" : "Note"}
            </button>
          </div>
        ) : (
          filtered.map((note) => {
            const ext = withDefaults(note);
            const ritual = ext.noteType === "review" || ext.noteType === "journal";
            return (
              <button
                className={`cw-notes-row ${selectedNoteId === note.id ? "is-active" : ""}`}
                key={note.id}
                onClick={() => onSelect(note.id)}
                type="button"
              >
                <strong>{note.title || t("notes.untitled")}</strong>
                <span className="cw-notes-excerpt">{excerpt(String(note.content || ""))}</span>
                <span className="cw-notes-meta-line">
                  {ritual ? <Sparkles size={12} /> : null}
                  <span>{relative(ext.lastEditedAt || note.updatedAt, locale)}</span>
                  {(ext.linkCount || 0) > 0 ? (
                    <span>
                      <Link2 size={12} /> {ext.linkCount}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
