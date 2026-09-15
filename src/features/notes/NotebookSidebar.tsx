import { Book, Folder, Users } from "../../components/ui/Icon";
import { t } from "../../lib/i18n";
import type { NotebookEntry } from "../../lib/notebookContext";
import { withDefaults } from "../../lib/notes";

export type NotebookSidebarProps = {
  notebooks: NotebookEntry[];
  sections: NotebookEntry[];
  notes: NotebookEntry[];
  selectedNotebookId: string;
  selectedSectionId: string;
  collapsed: boolean;
  search: string;
  onSearch: (value: string) => void;
  onSelectNotebook: (id: string, sectionId?: string | null) => void;
  onCreateNotebook: (title: string, visibility: "private" | "workspace" | "project") => void;
  locale: "es" | "en";
};

function countNotes(notes: NotebookEntry[], notebookId: string, sectionId?: string) {
  return notes.filter(
    (n) => n.notebookId === notebookId && (!sectionId || n.sectionId === sectionId),
  ).length;
}

export function NotebookSidebar({
  notebooks,
  sections,
  notes,
  selectedNotebookId,
  selectedSectionId,
  collapsed,
  search,
  onSearch,
  onSelectNotebook,
  onCreateNotebook,
  locale,
}: NotebookSidebarProps) {
  const personal = notebooks.filter((n) => withDefaults(n).system === "personal" || withDefaults(n).visibility === "private");
  const team = notebooks.filter((n) => withDefaults(n).visibility === "workspace");
  const projects = notebooks.filter((n) => withDefaults(n).visibility === "project" || withDefaults(n).system === "project");

  return (
    <aside className={`cw-notes-sidebar ${collapsed ? "is-collapsed" : ""}`} data-testid="notes-sidebar">
      <div className="cw-notes-search">
        <input
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("notes.search")}
          value={search}
        />
        <span className="cw-notes-kbd">⌘⇧F</span>
      </div>
      <div style={{ overflow: "auto", flex: 1 }}>
        <div className="cw-notes-group">
          <p className="cw-notes-eyebrow">{locale === "es" ? "Personales" : "Personal"}</p>
          {personal.map((nb) => {
            const secs = sections.filter((s) => s.notebookId === nb.id);
            return (
              <div key={nb.id}>
                <button
                  className={`cw-notes-nav-row ${selectedNotebookId === nb.id && !selectedSectionId ? "is-active" : ""}`}
                  onClick={() => onSelectNotebook(nb.id, null)}
                  type="button"
                >
                  <Book size={12} />
                  <span>{nb.title || t("notes.personal")}</span>
                  <em>{countNotes(notes, nb.id)}</em>
                </button>
                {secs.map((sec) => (
                  <button
                    className={`cw-notes-nav-row ${selectedSectionId === sec.id ? "is-active" : ""}`}
                    key={sec.id}
                    onClick={() => onSelectNotebook(nb.id, sec.id)}
                    style={{ paddingLeft: 28 }}
                    type="button"
                  >
                    <span>{sec.title}</span>
                    <em>{countNotes(notes, nb.id, sec.id)}</em>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="cw-notes-group">
          <p className="cw-notes-eyebrow">{locale === "es" ? "Equipo" : "Team"}</p>
          {team.map((nb) => (
            <button
              className={`cw-notes-nav-row ${selectedNotebookId === nb.id ? "is-active" : ""}`}
              key={nb.id}
              onClick={() => onSelectNotebook(nb.id)}
              type="button"
            >
              <Users size={12} />
              <span>{nb.title}</span>
              <em>{countNotes(notes, nb.id)}</em>
            </button>
          ))}
        </div>
        <div className="cw-notes-group">
          <p className="cw-notes-eyebrow">{locale === "es" ? "Proyectos" : "Projects"}</p>
          {projects.map((nb) => (
            <button
              className={`cw-notes-nav-row ${selectedNotebookId === nb.id ? "is-active" : ""}`}
              key={nb.id}
              onClick={() => onSelectNotebook(nb.id)}
              type="button"
            >
              <Folder size={12} />
              <span>{nb.title}</span>
              <em>{countNotes(notes, nb.id)}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="cw-notes-sidebar-foot">
        <button
          className="cw-notes-muted-btn"
          onClick={() => {
            const title = window.prompt(locale === "es" ? "Nombre del cuaderno" : "Notebook name");
            if (!title?.trim()) return;
            const vis =
              window.prompt(
                locale === "es" ? "Visibilidad: personal | equipo | proyecto" : "Visibility: personal | team | project",
                "personal",
              ) || "personal";
            const visibility =
              vis.startsWith("e") || vis.startsWith("t") || vis === "workspace"
                ? "workspace"
                : vis.startsWith("pr")
                  ? "project"
                  : "private";
            onCreateNotebook(title.trim(), visibility);
          }}
          type="button"
        >
          + {locale === "es" ? "Cuaderno" : "Notebook"}
        </button>
      </div>
    </aside>
  );
}
