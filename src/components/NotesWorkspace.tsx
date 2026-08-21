import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  Eraser,
  FileText,
  Folder,
  PenLine,
  Plus,
  Sparkles,
  Tags,
  Undo2,
} from "./ui/Icon";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import {
  collectWorkspaceTags,
  parseTags,
  type NotebookEntry,
} from "../lib/notebookContext";

type StrokePoint = { x: number; y: number; pressure?: number };
type Stroke = { color: string; width: number; points: StrokePoint[] };

type NotesWorkspaceProps = {
  activeProject?: any | null;
  entries: NotebookEntry[];
  knowledgeItems: any[];
  onAsk: (prompt: string) => void;
  projects: any[];
  tasks: any[];
};

function timestamp(value: any) {
  if (value?.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  return typeof value === "number" ? value : 0;
}

function entityTitle(entity: any) {
  return String(entity?.title || entity?.name || "Untitled");
}

function activeEntries(entries: NotebookEntry[]) {
  return entries.filter((entry) => entry.status !== "archived");
}

export function NotesWorkspace({
  activeProject,
  entries,
  knowledgeItems,
  onAsk,
  projects,
  tasks,
}: NotesWorkspaceProps) {
  const { user, workspace } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<StrokePoint[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [editor, setEditor] = useState({ title: "", content: "", tagsText: "", projectId: "" });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [inkOpen, setInkOpen] = useState(false);
  const [inkColor, setInkColor] = useState("#1f4838");
  const [inkWidth, setInkWidth] = useState(2.5);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const visibleEntries = useMemo(() => activeEntries(entries), [entries]);
  const notebooks = useMemo(
    () => visibleEntries.filter((entry) => entry.kind === "notebook").sort((a, b) => timestamp(b.updatedAt || b.createdAt) - timestamp(a.updatedAt || a.createdAt)),
    [visibleEntries],
  );
  const sections = useMemo(
    () => visibleEntries.filter((entry) => entry.kind === "section" && entry.notebookId === selectedNotebookId).sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt)),
    [selectedNotebookId, visibleEntries],
  );
  const notes = useMemo(
    () => visibleEntries
      .filter((entry) => entry.kind === "note" && entry.notebookId === selectedNotebookId && (!selectedSectionId || entry.sectionId === selectedSectionId))
      .sort((a, b) => timestamp(b.updatedAt || b.createdAt) - timestamp(a.updatedAt || a.createdAt)),
    [selectedNotebookId, selectedSectionId, visibleEntries],
  );
  const selectedNote = useMemo(
    () => visibleEntries.find((entry) => entry.id === selectedNoteId && entry.kind === "note") || null,
    [selectedNoteId, visibleEntries],
  );
  const selectedNotebook = notebooks.find((entry) => entry.id === selectedNotebookId) || null;
  const selectedSection = visibleEntries.find((entry) => entry.id === selectedSectionId) || null;
  const tagSuggestions = useMemo(
    () => collectWorkspaceTags([...entries, ...projects, ...tasks, ...knowledgeItems]),
    [entries, knowledgeItems, projects, tasks],
  );

  useEffect(() => {
    if (selectedNotebookId && notebooks.some((entry) => entry.id === selectedNotebookId)) return;
    setSelectedNotebookId(notebooks[0]?.id || "");
  }, [notebooks, selectedNotebookId]);

  useEffect(() => {
    if (selectedSectionId && sections.some((entry) => entry.id === selectedSectionId)) return;
    setSelectedSectionId(sections[0]?.id || "");
  }, [sections, selectedSectionId]);

  useEffect(() => {
    if (selectedNoteId && notes.some((entry) => entry.id === selectedNoteId)) return;
    setSelectedNoteId(notes[0]?.id || "");
  }, [notes, selectedNoteId]);

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
        title: editor.title.trim() || "Untitled note",
        content: editor.content,
        tags,
        projectId: editor.projectId || "",
        updatedAt: serverTimestamp(),
      });
      setSaveState("saved");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [editor.content, editor.projectId, editor.tagsText, editor.title, selectedNote, user, workspace]);

  useEffect(() => {
    if (!selectedNoteId || !user) {
      setStrokes([]);
      return;
    }
    const assetRef = doc(db, "notebook_handwriting_assets", `note_${selectedNoteId}`);
    return onSnapshot(assetRef, (snapshot) => {
      if (!snapshot.exists()) {
        setStrokes([]);
        return;
      }
      try {
        setStrokes(JSON.parse(String(snapshot.data().strokesJson || "[]")));
      } catch {
        setStrokes([]);
      }
    });
  }, [selectedNoteId, user]);

  const drawStrokes = (source: Stroke[] = strokes) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    source.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });
  };

  useEffect(() => {
    if (!inkOpen) return;
    const frame = window.requestAnimationFrame(() => drawStrokes(strokes));
    window.addEventListener("resize", () => drawStrokes(strokes), { once: true });
    return () => window.cancelAnimationFrame(frame);
  }, [inkOpen, strokes]);

  const createNotebook = async (title = newNotebookTitle || "New notebook") => {
    if (!user || !workspace) return;
    const notebookRef = await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "notebook",
      title: title.trim(),
      status: "active",
      tags: [],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const sectionRef = await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "section",
      title: "Inbox",
      notebookId: notebookRef.id,
      status: "active",
      tags: [],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const noteRef = await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "note",
      title: "Untitled note",
      content: "",
      notebookId: notebookRef.id,
      sectionId: sectionRef.id,
      projectId: activeProject?.id || "",
      tags: [],
      status: "active",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewNotebookTitle("");
    setSelectedNotebookId(notebookRef.id);
    setSelectedSectionId(sectionRef.id);
    setSelectedNoteId(noteRef.id);
  };

  const createSection = async () => {
    if (!user || !workspace || !selectedNotebookId || !newSectionTitle.trim()) return;
    const ref = await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "section",
      title: newSectionTitle.trim(),
      notebookId: selectedNotebookId,
      status: "active",
      tags: [],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewSectionTitle("");
    setSelectedSectionId(ref.id);
  };

  const createNote = async () => {
    if (!user || !workspace) return;
    if (!selectedNotebookId) {
      await createNotebook("General");
      return;
    }
    const sectionId = selectedSectionId || sections[0]?.id || "";
    const ref = await addDoc(collection(db, "notebook_entries"), {
      userId: user.uid,
      workspaceId: workspace.id,
      kind: "note",
      title: newNoteTitle.trim() || "Untitled note",
      content: "",
      notebookId: selectedNotebookId,
      sectionId,
      projectId: activeProject?.id || "",
      tags: activeProject ? [entityTitle(activeProject).toLowerCase().replace(/\s+/g, "-")] : [],
      status: "active",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewNoteTitle("");
    setSelectedNoteId(ref.id);
  };

  const saveKnowledgeCopy = async () => {
    if (!selectedNote || !user || !workspace) return;
    await addDoc(collection(db, "knowledge_items"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: editor.title.trim() || "Untitled note",
      type: "Notebook Note",
      docType: "note",
      status: "active",
      content: editor.content,
      body: editor.content,
      summary: `Notebook: ${selectedNotebook?.title || "Notebook"}${selectedSection ? ` / ${selectedSection.title}` : ""}`,
      tags: parseTags(editor.tagsText),
      projectId: editor.projectId || "",
      aiReadable: true,
      isAIReadable: true,
      aiUsageScope: "all",
      sourceType: "notebook_entry",
      sourceId: selectedNote.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSaveState("saved");
  };

  const archiveNote = async () => {
    if (!selectedNote) return;
    await updateDoc(doc(db, "notebook_entries", selectedNote.id), {
      status: "archived",
      updatedAt: serverTimestamp(),
    });
  };

  const saveStrokes = async (nextStrokes: Stroke[]) => {
    if (!user || !workspace || !selectedNoteId) return;
    await setDoc(doc(db, "notebook_handwriting_assets", `note_${selectedNoteId}`), {
      userId: user.uid,
      workspaceId: workspace.id,
      notebookEntryId: selectedNoteId,
      strokesJson: JSON.stringify(nextStrokes),
      format: "strokes_json",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const pointerPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure || 0.5,
    };
  };

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = [pointerPoint(event)];
    setIsDrawing(true);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    event.preventDefault();
    const point = pointerPoint(event);
    drawingRef.current = [...drawingRef.current, point];
    drawStrokes([...strokes, { color: inkColor, width: inkWidth, points: drawingRef.current }]);
  };

  const pointerUp = async (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    event.preventDefault();
    setIsDrawing(false);
    if (drawingRef.current.length < 2) return;
    const nextStrokes = [...strokes, { color: inkColor, width: inkWidth, points: drawingRef.current }];
    drawingRef.current = [];
    setStrokes(nextStrokes);
    await saveStrokes(nextStrokes);
  };

  const undoStroke = async () => {
    const next = strokes.slice(0, -1);
    setStrokes(next);
    await saveStrokes(next);
  };

  const clearInk = async () => {
    setStrokes([]);
    await saveStrokes([]);
  };

  return (
    <section className="do-notes-center">
      <aside className="do-notes-nav">
        <div className="do-notes-create">
          <input
            aria-label="New notebook title"
            onChange={(event) => setNewNotebookTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createNotebook();
            }}
            placeholder="New notebook..."
            value={newNotebookTitle}
          />
          <button onClick={() => createNotebook()} type="button"><Plus size={13} /></button>
        </div>

        <div className="do-notes-list">
          {notebooks.map((notebook) => (
            <button
              className={notebook.id === selectedNotebookId ? "is-active" : ""}
              key={notebook.id}
              onClick={() => {
                setSelectedNotebookId(notebook.id);
                setSelectedSectionId("");
                setSelectedNoteId("");
              }}
              type="button"
            >
              <BookOpen size={13} />
              <span>{notebook.title || "Notebook"}</span>
              <small>{visibleEntries.filter((entry) => entry.kind === "note" && entry.notebookId === notebook.id).length}</small>
            </button>
          ))}
          {notebooks.length === 0 && (
            <div className="do-notes-empty-mini">Create one notebook. Small, clean, useful.</div>
          )}
        </div>

        {selectedNotebookId && (
          <div className="do-notes-sections">
            <span className="do-notes-label">Sections</span>
            {sections.map((section) => (
              <button className={section.id === selectedSectionId ? "is-active" : ""} key={section.id} onClick={() => setSelectedSectionId(section.id)} type="button">
                <Folder size={12} /><span>{section.title || "Section"}</span>
              </button>
            ))}
            <div className="do-notes-create">
              <input
                aria-label="New section title"
                onChange={(event) => setNewSectionTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createSection();
                }}
                placeholder="New section..."
                value={newSectionTitle}
              />
              <button disabled={!newSectionTitle.trim()} onClick={createSection} type="button"><Plus size={13} /></button>
            </div>
          </div>
        )}
      </aside>

      <aside className="do-notes-note-list">
        <div className="do-notes-list-head">
          <div>
            <span className="do-kicker">Notes</span>
            <strong>{selectedSection?.title || selectedNotebook?.title || "Notebook"}</strong>
          </div>
          <small>{notes.length}</small>
        </div>
        <div className="do-notes-create">
          <input
            aria-label="New note title"
            onChange={(event) => setNewNoteTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createNote();
            }}
            placeholder="New note..."
            value={newNoteTitle}
          />
          <button onClick={createNote} type="button"><Plus size={13} /></button>
        </div>
        <div className="do-notes-cards">
          {notes.map((note) => (
            <button className={note.id === selectedNoteId ? "is-active" : ""} key={note.id} onClick={() => setSelectedNoteId(note.id)} type="button">
              <FileText size={13} />
              <span>
                <strong>{note.title || "Untitled note"}</strong>
                <small>{(note.content || "Empty note").slice(0, 86)}</small>
              </span>
            </button>
          ))}
          {notes.length === 0 && <div className="do-notes-empty-mini">No notes here yet.</div>}
        </div>
      </aside>

      <main className="do-notes-editor">
        {selectedNote ? (
          <>
            <header>
              <div>
                <span className="do-kicker">Notebook note</span>
                <input
                  aria-label="Note title"
                  onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Untitled note"
                  value={editor.title}
                />
              </div>
              <div className="do-notes-actions">
                <button aria-label={inkOpen ? "Close handwriting" : "Handwrite"} className="do-icon-button" onClick={() => setInkOpen((open) => !open)} title={inkOpen ? "Close handwriting" : "Handwrite"} type="button"><PenLine size={14} /></button>
                <button aria-label="Analyze note" className="do-icon-button" onClick={() => onAsk(`Analyze this notebook note and tell me the key ideas, decisions, risks, and next actions:\n\nTitle: ${editor.title}\n\n${editor.content}`)} title="Analyze note" type="button"><Sparkles size={14} /></button>
                <button onClick={() => onAsk(`Extract actionable tasks, decisions, and follow-ups from this notebook note. Keep changes pending for approval:\n\nTitle: ${editor.title}\n\n${editor.content}`)} type="button">Extract actions</button>
              </div>
            </header>

            <div className="do-notes-meta">
              <label>
                <Tags size={12} />
                <input
                  list="do-note-tag-suggestions"
                  onChange={(event) => setEditor((current) => ({ ...current, tagsText: event.target.value }))}
                  placeholder="tags: client, prd, idea..."
                  value={editor.tagsText}
                />
                <datalist id="do-note-tag-suggestions">
                  {tagSuggestions.map((tag) => <option key={tag} value={tag} />)}
                </datalist>
              </label>
              <select
                aria-label="Link note to project"
                onChange={(event) => setEditor((current) => ({ ...current, projectId: event.target.value }))}
                value={editor.projectId}
              >
                <option value="">No project link</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{entityTitle(project)}</option>)}
              </select>
              <span>{saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Ready"}</span>
            </div>

            <div className="do-notes-paper">
              {inkOpen && (
                <div className="do-notes-ink">
                  <div className="do-notes-ink-tools">
                    {["#1f4838", "#2563eb", "#d06d4a", "#111827"].map((color) => (
                      <button aria-label={`Ink color ${color}`} className={inkColor === color ? "is-active" : ""} key={color} onClick={() => setInkColor(color)} style={{ background: color }} type="button" />
                    ))}
                    <button className={inkWidth === 2.5 ? "is-active" : ""} onClick={() => setInkWidth(2.5)} type="button">Fine</button>
                    <button className={inkWidth === 5 ? "is-active" : ""} onClick={() => setInkWidth(5)} type="button">Bold</button>
                    <button aria-label="Undo stroke" className="do-icon-button" onClick={undoStroke} title="Undo stroke" type="button"><Undo2 size={13} /></button>
                    <button aria-label="Clear handwriting" className="do-icon-button" onClick={clearInk} title="Clear handwriting" type="button"><Eraser size={13} /></button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    onPointerCancel={pointerUp}
                    onPointerDown={pointerDown}
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                  />
                </div>
              )}
              <textarea
                aria-label="Note content"
                onChange={(event) => setEditor((current) => ({ ...current, content: event.target.value }))}
                placeholder="Write notes here. Use tags so Certo Work can find them later."
                value={editor.content}
              />
            </div>

            <footer className="do-notes-footer">
              <span>{selectedNotebook?.title || "Notebook"} {selectedSection ? <><ChevronRight size={12} /> {selectedSection.title}</> : null}</span>
              <div>
                <button onClick={saveKnowledgeCopy} type="button"><Check size={13} /> Make AI-readable</button>
                <button onClick={archiveNote} type="button"><Archive size={13} /> Archive note</button>
              </div>
            </footer>
          </>
        ) : (
          <div className="do-notes-empty">
            <BookOpen size={26} />
            <h2>Your notebooks live here.</h2>
            <p>Create a notebook, capture notes, tag them, and let Certo Work analyze or extract actions when you need it.</p>
            <button onClick={() => createNotebook("General")} type="button"><Plus size={14} /> Create General notebook</button>
          </div>
        )}
      </main>
    </section>
  );
}
