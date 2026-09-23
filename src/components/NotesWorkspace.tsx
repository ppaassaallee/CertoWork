import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, BookOpen, Maximize2, MoreHorizontal, Sparkles } from "./ui/Icon";
import { emitDomainEvent } from "../lib/routines";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type UpdateData,
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
import { NOTES_AUTOSAVE_DEBOUNCE_MS } from "../lib/firestoreListenDiet";
import {
  createNote as createNoteDoc,
  ensurePersonalNotebook,
  ensureProjectNotebook,
  linkNote,
  noteTemplate,
  proposeItemsFromNote,
  setNoteAiVisible,
  setNoteVisibility,
  upsertProximosPasosBlock,
  withDefaults,
  type NoteType,
  type NoteVisibility,
  type ProposedNoteItem,
} from "../lib/notes";
import { NotebookSidebar } from "../features/notes/NotebookSidebar";
import { NotesList } from "../features/notes/NotesList";
import { NoteMetaChips } from "../features/notes/NoteMetaChips";
import { NoteLinksPopover } from "../features/notes/NoteLinksPopover";
import { CreateItemsFromNoteModal } from "../features/notes/CreateItemsFromNoteModal";
import "../features/notes/notes.css";

type NotesWorkspaceProps = {
  activeProject?: any | null;
  entries: NotebookEntry[];
  knowledgeItems: any[];
  onAsk: (prompt: string) => void;
  onOpenOdysseus?: (scope: { kind: "note"; entityId: string; label: string }) => void;
  onCreateTask?: (input: {
    title: string;
    workItemType: string;
    projectId?: string | null;
  }) => Promise<string | void> | string | void;
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
  records?: Array<{
    id: string;
    title?: string;
    tableId: string;
    tableName: string;
    tableIcon?: string;
  }>;
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
  onOpenOdysseus,
  onCreateTask,
  onOpenProject,
  onQuickCaptureItem,
  projects,
  tasks,
  workspaceMembers = [],
  initialNoteId,
  records = [],
}: NotesWorkspaceProps) {
  const { user, workspace } = useAuth();
  const locale = getLocale() === "es" ? "es" : "en";
  const [selectedNotebookId, setSelectedNotebookId] = useState("");
  const [notebookChosenByUser, setNotebookChosenByUser] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [editor, setEditor] = useState({ title: "", content: "", tagsText: "", projectId: "" });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pendingSaveRef = useRef<{ noteId: string; patch: UpdateData<DocumentData>; revision: number } | null>(null);
  const saveRevisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const activeNoteIdRef = useRef<string | null>(null);
  const flushPendingSave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    try {
      const write = saveQueueRef.current.then(() =>
        updateDoc(doc(db, "notebook_entries", pending.noteId), pending.patch));
      saveQueueRef.current = write.catch(() => undefined);
      await write;
      if (!pendingSaveRef.current && pending.revision === saveRevisionRef.current && activeNoteIdRef.current === pending.noteId) setSaveState("saved");
    } catch (error) {
      if (!pendingSaveRef.current) pendingSaveRef.current = pending;
      setSaveState("error");
      console.error("Could not save note", error);
    }
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [search, setSearch] = useState("");
  const [listTab, setListTab] = useState<"all" | "meetings" | "mine" | "linked">("all");
  const [focusMode, setFocusMode] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [createItemsOpen, setCreateItemsOpen] = useState(false);
  const [proposedItems, setProposedItems] = useState<ProposedNoteItem[]>([]);
  const [peekEntity, setPeekEntity] = useState<{
    id: string;
    kind: "task" | "project" | "note" | "person" | "doc" | "record";
    title: string;
    status?: string | null;
    owner?: string | null;
    dueDate?: string | null;
    excerpt?: string | null;
    tableName?: string | null;
    tableIcon?: string | null;
    previewFields?: Array<{ label: string; value: string }>;
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
  activeNoteIdRef.current = selectedNote?.id || null;
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
      if (notebookId) {
        setNotebookChosenByUser(true);
        setSelectedNotebookId(notebookId);
      }
    });
  }, [activeProject?.id, user?.uid, workspace?.id]);

  useEffect(() => {
    if (!initialNoteId) return;
    setSelectedNoteId(initialNoteId);
    const initialNote = allNotes.find((entry) => entry.id === initialNoteId);
    if (initialNote?.notebookId) {
      setNotebookChosenByUser(true);
      setSelectedNotebookId(initialNote.notebookId);
    }
  }, [allNotes, initialNoteId]);

  useEffect(() => {
    const withNotes = notebooks.find((entry) => allNotes.some((note) => note.notebookId === entry.id));
    const selectionIsValid = notebooks.some((entry) => entry.id === selectedNotebookId);
    if (selectionIsValid && notebookChosenByUser) return;
    const preferredId = withNotes?.id || (selectionIsValid ? selectedNotebookId : notebooks[0]?.id) || "";
    if (preferredId !== selectedNotebookId) setSelectedNotebookId(preferredId);
  }, [allNotes, notebookChosenByUser, notebooks, selectedNotebookId]);

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
    if (unchanged) {
      if (pendingSaveRef.current?.noteId === selectedNote.id) pendingSaveRef.current = null;
      return;
    }
    setSaveState("saving");
    pendingSaveRef.current = {
      noteId: selectedNote.id,
      revision: ++saveRevisionRef.current,
      patch: {
        title: editor.title.trim() || t("notes.untitled"),
        content: editor.content,
        tags,
        projectId: editor.projectId || "",
        lastEditedBy: user.uid,
        lastEditedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      },
    };
    const timer = window.setTimeout(() => { void flushPendingSave(); }, NOTES_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [editor.content, editor.projectId, editor.tagsText, editor.title, selectedNote, user, workspace, flushPendingSave]);

  // Navigating away or selecting another note must not discard the draft left
  // inside the longer debounce window.
  useEffect(() => () => { void flushPendingSave(); }, [selectedNote?.id, flushPendingSave]);

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
    setNotebookChosenByUser(true);
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
            setNotebookChosenByUser(true);
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
          onToggleNotebooks={() => setSidebarCollapsed((collapsed) => !collapsed)}
          onSelect={setSelectedNoteId}
          onTab={setListTab}
          selectedNoteId={selectedNoteId}
          showLinkedTab={Boolean(searchResults)}
          showMineTab={selectedNotebookVis !== "private"}
          tab={listTab}
          notebooksOpen={!sidebarCollapsed}
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
                      : saveState === "error"
                        ? t("notes.saveError")
                      : ""}
                </span>
                <button
                  className="cw-notes-icon-btn"
                  onClick={() =>
                    onOpenOdysseus
                      ? onOpenOdysseus({
                          kind: "note",
                          entityId: selectedNote.id,
                          label: editor.title || t("notes.untitled"),
                        })
                      : onAsk(
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
                records={records}
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
                onLinkRecord={(recordId) => {
                  if (!user || !workspace) return;
                  void linkNote({
                    workspaceId: workspace.id,
                    userId: user.uid,
                    noteId: selectedNote.id,
                    target: { type: "record", id: recordId },
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
              <button
                onClick={() => {
                  setProposedItems(proposeItemsFromNote(editor.content));
                  setCreateItemsOpen(true);
                }}
                type="button"
              >
                ✦ {t("notes.createItems")}
              </button>
            </div>
          </>
        ) : (
          <div className="cw-notes-empty cw-notes-empty-editor">
            <BookOpen size={28} aria-hidden="true" />
            <strong>{locale === "es" ? "Tu espacio para pensar" : "A place for your thinking"}</strong>
            <p>{locale === "es" ? "Captura una idea, una reunión o una decisión. Empieza con una nota." : "Capture an idea, meeting, or decision. Start with a note."}</p>
            <button onClick={() => void createTypedNote("note")} type="button">{locale === "es" ? "Crear nota" : "Create note"}</button>
          </div>
        )}
      </div>
      <CreateItemsFromNoteModal
        items={proposedItems}
        locale={locale}
        onClose={() => setCreateItemsOpen(false)}
        onConfirm={async (items) => {
          if (!user || !workspace || !selectedNote) return;
          const chipLines: string[] = [];
          for (const row of items) {
            const createdId = await onCreateTask?.({
              title: row.title,
              workItemType: row.type,
              projectId: selectedNote.projectId || activeProject?.id || null,
            });
            if (createdId) {
              await linkNote({
                workspaceId: workspace.id,
                userId: user.uid,
                noteId: selectedNote.id,
                target: { type: "task", id: String(createdId) },
              });
              const task = tasks.find((t) => t.id === createdId);
              const key = String(task?.key || task?.projectKey || row.title.slice(0, 12));
              chipLines.push(`[#${key}](item:${createdId})`);
            } else {
              chipLines.push(`- ${row.title}`);
            }
          }
          const nextContent = upsertProximosPasosBlock(editor.content, chipLines);
          setEditor((cur) => ({ ...cur, content: nextContent }));
          await updateDoc(doc(db, "notebook_entries", selectedNote.id), {
            content: nextContent,
            lastEditedBy: user.uid,
            lastEditedAt: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        }}
        open={createItemsOpen}
      />
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
