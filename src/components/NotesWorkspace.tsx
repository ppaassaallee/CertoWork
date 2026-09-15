import { useEffect, useMemo, useState } from "react";
import { Archive, Maximize2, MoreHorizontal, Sparkles } from "./ui/Icon";
import { emitDomainEvent } from "../lib/routines";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import {
  parseTags,
  type NotebookEntry,
} from "../lib/notebookContext";
import { NoteRichEditor } from "./NoteRichEditor";
import { EntityPeek } from "./EntityPeek";
import { getLocale, t } from "../lib/i18n";
import {
  createNote as createNoteDoc,
  ensurePersonalNotebook,
  ensureProjectNotebook,
  linkNote,
  noteTemplate,
  setNoteAiVisible,
  setNoteVisibility,
  withDefaults,
  type NoteType,
  type NoteVisibility,
} from "../lib/notes";
import { NotebookSidebar } from "../features/notes/NotebookSidebar";
import { NotesList } from "../features/notes/NotesList";
import { NoteMetaChips } from "../features/notes/NoteMetaChips";
import { NoteLinksPopover } from "../features/notes/NoteLinksPopover";
import "../features/notes/notes.css";

type NotesWorkspaceProps = {
  activeProject?: any | null;
  entries: NotebookEntry[];
  knowledgeItems: any[];
  onAsk: (prompt: string) => void;
  onOpenProject?: (project: any) => void;
  onQuickCaptureItem?: () => void;
  projects: any[];
  tasks: any[];
  workspaceMembers?: Array<{
    id: string;
    displayName?: string;
    name?: string;
    userId?: string;
  }>;
  initialNoteId?: string | null;
};

function timestamp(value: any) {
  if (value?.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  return typeof value === "number" ? value : 0;
}

function activeEntries(entries: NotebookEntry[]) {
  return entries.filter((entry) => entry.status !== "archived");
}

export function NotesWorkspace({
  activeProject,
  entries,
  onAsk,
  onOpenProject,
  onQuickCaptureItem,
  projects,
  tasks,
  workspaceMembers = [],
  initialNoteId,
}: NotesWorkspaceProps) {
  const { user, workspace } = useAuth();
  const locale = getLocale() === "es" ? "es" : "en";
  const [selectedNotebookId, setSelectedNotebookId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [editor, setEditor] = useState({ title: "", content: "", tagsText: "", projectId: "" });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1280 : false,
  );
  const [search, setSearch] = useState("");
  const [listTab, setListTab] = useState<"all" | "meetings" | "mine" | "linked">("all");
  const [focusMode, setFocusMode] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [peekEntity, setPeekEntity] = useState<{
    id: string;
    kind: "task" | "project" | "note" | "person" | "doc";
    title: string;
    status?: string | null;
    owner?: string | null;
    dueDate?: string | null;
    excerpt?: string | null;
  } | null>(null);

  const visibleEntries = useMemo(() => activeEntries(entries).map(withDefaults), [entries]);
  const notebooks = useMemo(
    () =>
      visibleEntries
        .filter((entry) => entry.kind === "notebook")
        .sort((a, b) => timestamp(b.updatedAt || b.createdAt) - timestamp(a.updatedAt || a.createdAt)),
    [visibleEntries],
  );
  const sections = useMemo(
    () =>
      visibleEntries
        .filter((entry) => entry.kind === "section" && entry.notebookId === selectedNotebookId)
        .sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt)),
    [selectedNotebookId, visibleEntries],
  );
  const notes = useMemo(
    () =>
      visibleEntries
        .filter(
          (entry) =>
            entry.kind === "note" &&
            entry.notebookId === selectedNotebookId &&
            (!selectedSectionId || entry.sectionId === selectedSectionId),
        )
        .sort(
          (a, b) =>
            timestamp(b.lastEditedAt || b.updatedAt || b.createdAt) -
            timestamp(a.lastEditedAt || a.updatedAt || a.createdAt),
        ),
    [selectedNotebookId, selectedSectionId, visibleEntries],
  );
  const allNotes = useMemo(
    () =>
      visibleEntries
        .filter((entry) => entry.kind === "note")
        .sort(
          (a, b) =>
            timestamp(b.lastEditedAt || b.updatedAt || b.createdAt) -
            timestamp(a.lastEditedAt || a.updatedAt || a.createdAt),
        ),
    [visibleEntries],
  );
  const selectedNote =
    visibleEntries.find((entry) => entry.id === selectedNoteId && entry.kind === "note") || null;
  const selectedNotebook = notebooks.find((entry) => entry.id === selectedNotebookId) || null;
  const selectedSection = visibleEntries.find((entry) => entry.id === selectedSectionId) || null;

  useEffect(() => {
    if (!user || !workspace) return;
    void ensurePersonalNotebook(user.uid, workspace.id);
  }, [user?.uid, workspace?.id]);

  useEffect(() => {
    if (!user || !workspace || !activeProject?.id) return;
    void ensureProjectNotebook(
      workspace.id,
      String(activeProject.id),
      String(activeProject.title || activeProject.name || "Project"),
      user.uid,
    ).then((notebookId) => {
      if (notebookId) setSelectedNotebookId(notebookId);
    });
  }, [activeProject?.id, user?.uid, workspace?.id]);

  useEffect(() => {
    if (initialNoteId) setSelectedNoteId(initialNoteId);
  }, [initialNoteId]);

  useEffect(() => {
    if (selectedNotebookId && notebooks.some((entry) => entry.id === selectedNotebookId)) return;
    setSelectedNotebookId(notebooks[0]?.id || "");
  }, [notebooks, selectedNotebookId]);

  useEffect(() => {
    if (selectedNoteId && (notes.some((entry) => entry.id === selectedNoteId) || allNotes.some((e) => e.id === selectedNoteId))) return;
    setSelectedNoteId(notes[0]?.id || "");
  }, [notes, selectedNoteId, allNotes]);

  useEffect(() => {
    setEditor({
      title: selectedNote?.title || "",
      content: selectedNote?.content || "",
      tagsText: (selectedNote?.tags || []).join(", "),
      projectId: selectedNote?.projectId || activeProject?.id || "",
    });
    setSaveState("idle");
  }, [activeProject?.id, selectedNote?.id]);

  useEffect(() => {
    if (!selectedNote || !user || !workspace) return;
    const tags = parseTags(editor.tagsText);
    const unchanged =
      editor.title === (selectedNote.title || "") &&
      editor.content === (selectedNote.content || "") &&
      editor.projectId === (selectedNote.projectId || "") &&
      tags.join(",") === (selectedNote.tags || []).join(",");
    if (unchanged) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      await updateDoc(doc(db, "notebook_entries", selectedNote.id), {
        title: editor.title.trim() || t("notes.untitled"),
        content: editor.content,
        tags,
        projectId: editor.projectId || "",
        lastEditedBy: user.uid,
        lastEditedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      setSaveState("saved");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [editor.content, editor.projectId, editor.tagsText, editor.title, selectedNote, user, workspace]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSidebarCollapsed(false);
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return allNotes.filter((note) =>
      `${note.title || ""} ${note.content || ""}`.toLowerCase().includes(q),
    );
  }, [allNotes, search]);

  const listNotes = searchResults || notes;
  const selectedNotebookVis = selectedNotebook
    ? withDefaults(selectedNotebook).visibility || "private"
    : "private";

  const createTypedNote = async (noteType: NoteType) => {
    if (!user || !workspace) return;
    let notebookId = selectedNotebookId;
    if (!notebookId) {
      const personal = await ensurePersonalNotebook(user.uid, workspace.id);
      notebookId = personal.notebookId;
      setSelectedNotebookId(personal.notebookId);
      setSelectedSectionId(personal.inboxId);
    }
    const tpl = noteTemplate(noteType, { date: new Date().toISOString().slice(0, 10) });
    const id = await createNoteDoc({
      userId: user.uid,
      workspaceId: workspace.id,
      notebookId,
      sectionId: selectedSectionId || sections[0]?.id || null,
      title: tpl.title,
      noteType,
      projectId: activeProject?.id || null,
      contentMarkdown: tpl.content,
    });
    void emitDomainEvent({
      workspaceId: workspace.id,
      userId: user.uid,
      eventType: "note.created",
      entityType: "note",
      entityId: id,
      projectId: activeProject?.id || null,
    });
    setSelectedNoteId(id);
  };

  const createNotebookWithVisibility = async (title: string, visibility: NoteVisibility) => {
    if (!user || !workspace) return;
    const notebookRef = await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "notebook",
      title: title.trim(),
      status: "active",
      tags: [],
      visibility,
      system: visibility === "private" ? "personal" : visibility === "project" ? "project" : null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSelectedNotebookId(notebookRef.id);
  };

  return (
    <section className="cw-notes-shell" data-testid="notes-workspace">
      {!focusMode ? (
        <NotebookSidebar
          collapsed={sidebarCollapsed}
          locale={locale}
          notebooks={notebooks}
          notes={allNotes}
          onCreateNotebook={(title, visibility) => void createNotebookWithVisibility(title, visibility)}
          onSearch={setSearch}
          onSelectNotebook={(id, sectionId) => {
            setSelectedNotebookId(id);
            setSelectedSectionId(sectionId || "");
            setSelectedNoteId("");
          }}
          search={search}
          sections={visibleEntries.filter((e) => e.kind === "section")}
          selectedNotebookId={selectedNotebookId}
          selectedSectionId={selectedSectionId}
        />
      ) : null}
      {!focusMode ? (
        <NotesList
          currentUserId={user?.uid}
          locale={locale}
          notebookTitle={selectedSection?.title || selectedNotebook?.title || ""}
          notes={listNotes}
          onCreate={(type) => void createTypedNote(type)}
          onSelect={setSelectedNoteId}
          onTab={setListTab}
          selectedNoteId={selectedNoteId}
          showLinkedTab={Boolean(searchResults)}
          showMineTab={selectedNotebookVis !== "private"}
          tab={listTab}
        />
      ) : null}
      <div className="cw-notes-editor">
        {selectedNote ? (
          <>
            <div className="cw-notes-editor-bar">
              <span>
                {(selectedNotebookVis === "private"
                  ? locale === "es"
                    ? "Personales"
                    : "Personal"
                  : selectedNotebookVis === "workspace"
                    ? locale === "es"
                      ? "Equipo"
                      : "Team"
                    : locale === "es"
                      ? "Proyectos"
                      : "Projects")}{" "}
                › {selectedNotebook?.title || t("notes.untitled")}
              </span>
              <div className="cw-notes-bar-actions">
                <span>
                  {saveState === "saving"
                    ? t("notes.saving")
                    : saveState === "saved"
                      ? t("notes.saved")
                      : ""}
                </span>
                <button
                  className="cw-notes-icon-btn"
                  onClick={() =>
                    onAsk(
                      locale === "es"
                        ? `Ayudame con esta nota: ${editor.title}`
                        : `Help with this note: ${editor.title}`,
                    )
                  }
                  type="button"
                >
                  <Sparkles size={13} />
                </button>
                <button
                  className="cw-notes-icon-btn"
                  onClick={() => {
                    setFocusMode((v) => !v);
                    setSidebarCollapsed(true);
                  }}
                  type="button"
                >
                  <Maximize2 size={13} />
                </button>
                <details style={{ position: "relative" }}>
                  <summary className="cw-notes-icon-btn" style={{ listStyle: "none" }}>
                    <MoreHorizontal size={13} />
                  </summary>
                  <div className="cw-notes-popover">
                    <button
                      onClick={() =>
                        void updateDoc(doc(db, "notebook_entries", selectedNote.id), {
                          status: "archived",
                          updatedAt: serverTimestamp(),
                        })
                      }
                      style={{ color: "var(--status-danger)" }}
                      type="button"
                    >
                      <Archive size={12} /> {locale === "es" ? "Archivar" : "Archive"}
                    </button>
                  </div>
                </details>
                <button
                  className="cw-notes-icon-btn"
                  onClick={() => setSidebarCollapsed((v) => !v)}
                  type="button"
                >
                  ☰
                </button>
              </div>
            </div>
            <input
              className="cw-notes-title"
              onChange={(e) => setEditor((cur) => ({ ...cur, title: e.target.value }))}
              placeholder={t("notes.untitled")}
              value={editor.title}
            />
            <NoteMetaChips
              locale={locale}
              note={withDefaults(selectedNote)}
              onAiVisible={(value) => void setNoteAiVisible(selectedNote.id, value)}
              onOpenLinks={() => setLinksOpen(true)}
              onTags={(tags) => setEditor((cur) => ({ ...cur, tagsText: tags.join(", ") }))}
              onType={(type) => {
                const empty = !String(selectedNote.content || "").trim();
                const tpl = noteTemplate(type, {
                  date: new Date().toISOString().slice(0, 10),
                });
                void updateDoc(doc(db, "notebook_entries", selectedNote.id), {
                  noteType: type,
                  ...(empty ? { title: tpl.title, content: tpl.content } : {}),
                  updatedAt: serverTimestamp(),
                });
              }}
              onVisibility={(visibility) =>
                void setNoteVisibility(
                  selectedNote.id,
                  visibility,
                  visibility === "project" ? activeProject?.id || null : null,
                )
              }
              projectTitle={
                projects.find((p) => p.id === selectedNote.projectId)?.title ||
                activeProject?.title
              }
            />
            {linksOpen ? (
              <div style={{ position: "relative", zIndex: 20 }}>
                <NoteLinksPopover
                  items={tasks.map((task) => ({
                    id: String(task.id),
                    title: String(task.title || task.name || ""),
                    key: String(task.key || task.projectKey || ""),
                    projectTitle: projects.find((p) => p.id === task.projectId)?.title,
                  }))}
                  locale={locale}
                  noteId={selectedNote.id}
                  notes={allNotes.map((n) => ({ id: n.id, title: n.title }))}
                  onClose={() => setLinksOpen(false)}
                  onCreateItem={() => onQuickCaptureItem?.()}
                  people={workspaceMembers.map((m) => ({
                    id: String(m.id),
                    displayName: m.displayName || m.name,
                    name: m.name,
                  }))}
                  projects={projects.map((p) => ({
                    id: String(p.id),
                    title: p.title || p.name,
                    name: p.name,
                  }))}
                  userId={user?.uid || ""}
                  workspaceId={workspace?.id || ""}
                />
              </div>
            ) : null}
            <div className="cw-notes-body">
              <NoteRichEditor
                items={tasks.map((task) => ({
                  id: String(task.id),
                  title: String(task.title || task.name || ""),
                  key: String(task.key || task.projectKey || ""),
                  projectTitle: projects.find((p) => p.id === task.projectId)?.title,
                  kind: String(task.workItemType || task.itemType || "task"),
                }))}
                noteId={selectedNote.id}
                onChange={(content) => setEditor((cur) => ({ ...cur, content }))}
                onLinkTask={(taskId) => {
                  if (!user || !workspace) return;
                  void linkNote({
                    workspaceId: workspace.id,
                    userId: user.uid,
                    noteId: selectedNote.id,
                    target: { type: "task", id: taskId },
                  });
                }}
                onMentionPerson={(person) => {
                  if (!user || !workspace) return;
                  const targetUid = person.userId || person.id;
                  if (!targetUid || targetUid === user.uid) return;
                  void addDoc(collection(db, "user_notifications"), {
                    type: "mention",
                    workspaceId: workspace.id,
                    userId: targetUid,
                    noteId: selectedNote.id,
                    noteTitle: editor.title || t("notes.untitled"),
                    mentionedByUserId: user.uid,
                    mentionedByName: user.displayName || user.email || "",
                    read: false,
                    createdAt: serverTimestamp(),
                  });
                }}
                people={workspaceMembers.map((m) => ({
                  id: String(m.id),
                  displayName: m.displayName || m.name,
                  name: m.name,
                  userId: m.userId,
                }))}
                value={editor.content}
              />
            </div>
            <div className="cw-notes-foot">
              <span>/ bloque · # ítem · @ persona</span>
              <button onClick={() => onAsk(editor.content.slice(0, 400))} type="button">
                ✦ {t("notes.createItems")}
              </button>
            </div>
          </>
        ) : (
          <div className="cw-notes-empty">
            <div className="cw-notes-empty-sketch">
              <i style={{ width: "70%" }} />
              <i style={{ width: "90%" }} />
              <i style={{ width: "55%" }} />
            </div>
            <p style={{ textAlign: "center" }}>{t("notes.pickOrCreate")}</p>
          </div>
        )}
      </div>
      {peekEntity ? (
        <EntityPeek
          entity={peekEntity}
          onClose={() => setPeekEntity(null)}
          onExpand={() => {
            if (peekEntity.kind === "project") {
              const project = projects.find((row) => row.id === peekEntity.id);
              if (project) onOpenProject?.(project);
            }
            setPeekEntity(null);
          }}
          onOpenSplit={() => setPeekEntity(null)}
        />
      ) : null}
    </section>
  );
}
