import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { t } from "../i18n";
import type { NotebookEntry } from "../notebookContext";
import {
  DEFAULT_NOTE_VISIBILITY,
  NOTE_LINK_RELATION,
  NOTEBOOK_ENTRIES,
  type NoteLinkTarget,
  type NoteType,
  type NoteVisibility,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

export function withDefaults(entry: NotebookEntry): NotebookEntry {
  return {
    ...entry,
    visibility: entry.visibility ?? DEFAULT_NOTE_VISIBILITY,
    noteType: entry.noteType ?? "note",
    aiVisible: entry.aiVisible ?? false,
    linkCount: entry.linkCount ?? 0,
  };
}

export function canSee(
  entry: NotebookEntry,
  viewerUid: string,
  viewerProjectIds: string[],
): boolean {
  const visibility = entry.visibility ?? DEFAULT_NOTE_VISIBILITY;
  if (visibility === "private") return entry.userId === viewerUid;
  if (visibility === "project") {
    return Boolean(entry.projectId && viewerProjectIds.includes(String(entry.projectId)));
  }
  return true;
}

async function findSystemNotebook(
  workspaceId: string,
  userId: string | null,
  system: string,
  projectId?: string | null,
) {
  const constraints = [
    where("workspaceId", "==", workspaceId),
    where("kind", "==", "notebook"),
    where("system", "==", system),
    limit(5),
  ];
  if (userId) constraints.unshift(where("userId", "==", userId));
  if (projectId) constraints.push(where("projectId", "==", projectId));
  const snap = await getDocs(query(collection(db, NOTEBOOK_ENTRIES), ...constraints));
  return snap.docs[0] ? ({ id: snap.docs[0].id, ...(snap.docs[0].data() as object) } as NotebookEntry) : null;
}

async function findSystemSection(notebookId: string, system: string) {
  const snap = await getDocs(
    query(
      collection(db, NOTEBOOK_ENTRIES),
      where("notebookId", "==", notebookId),
      where("kind", "==", "section"),
      where("system", "==", system),
      limit(1),
    ),
  );
  return snap.docs[0]?.id || null;
}

async function ensureSection(
  workspaceId: string,
  userId: string,
  notebookId: string,
  title: string,
  system: "inbox" | "journal" | "reviews",
) {
  const existing = await findSystemSection(notebookId, system);
  if (existing) return existing;
  const ref = await addDoc(collection(db, NOTEBOOK_ENTRIES), {
    kind: "section",
    title,
    notebookId,
    workspaceId,
    userId,
    system,
    visibility: "private",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function ensurePersonalNotebook(
  userId: string,
  workspaceId: string,
): Promise<{ notebookId: string; inboxId: string; journalId: string; reviewsId: string }> {
  let notebook = await findSystemNotebook(workspaceId, userId, "personal");
  if (!notebook) {
    const ref = await addDoc(collection(db, NOTEBOOK_ENTRIES), {
      kind: "notebook",
      title: t("notes.personal"),
      workspaceId,
      userId,
      visibility: "private",
      system: "personal",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    notebook = { id: ref.id, kind: "notebook", userId, workspaceId, system: "personal" };
  }
  const inboxId = await ensureSection(workspaceId, userId, notebook.id, "Inbox", "inbox");
  const journalId = await ensureSection(
    workspaceId,
    userId,
    notebook.id,
    t("notes.journal") || "Diario",
    "journal",
  );
  const reviewsId = await ensureSection(
    workspaceId,
    userId,
    notebook.id,
    t("notes.reviews") || "Revisiones",
    "reviews",
  );
  return { notebookId: notebook.id, inboxId, journalId, reviewsId };
}

export async function ensureProjectNotebook(
  workspaceId: string,
  projectId: string,
  projectTitle: string,
  createdBy: string,
): Promise<string> {
  const existing = await findSystemNotebook(workspaceId, null, "project", projectId);
  if (existing) return existing.id;
  const ref = await addDoc(collection(db, NOTEBOOK_ENTRIES), {
    kind: "notebook",
    title: projectTitle,
    workspaceId,
    userId: createdBy,
    createdBy,
    projectId,
    visibility: "project",
    system: "project",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createNote(input: {
  userId: string;
  workspaceId: string;
  notebookId: string;
  sectionId?: string | null;
  title?: string;
  noteType?: NoteType;
  projectId?: string | null;
  visibility?: NoteVisibility;
  contentMarkdown?: string;
  attendeeIds?: string[];
  meetingDate?: string | null;
}): Promise<string> {
  let visibility = input.visibility;
  if (!visibility) {
    const notebookSnap = await getDoc(doc(db, NOTEBOOK_ENTRIES, input.notebookId));
    visibility =
      (notebookSnap.exists()
        ? (notebookSnap.data() as NotebookEntry).visibility
        : undefined) ?? DEFAULT_NOTE_VISIBILITY;
  }
  const ref = await addDoc(collection(db, NOTEBOOK_ENTRIES), {
    kind: "note",
    title: input.title || "",
    content: input.contentMarkdown ?? "",
    notebookId: input.notebookId,
    sectionId: input.sectionId ?? null,
    projectId: input.projectId ?? null,
    workspaceId: input.workspaceId,
    userId: input.userId,
    createdBy: input.userId,
    noteType: input.noteType || "note",
    visibility,
    aiVisible: false,
    linkCount: 0,
    attendeeIds: input.attendeeIds || [],
    meetingDate: input.meetingDate ?? null,
    lastEditedBy: input.userId,
    lastEditedAt: nowIso(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setNoteVisibility(
  noteId: string,
  visibility: NoteVisibility,
  projectId: string | null,
): Promise<void> {
  await updateDoc(doc(db, NOTEBOOK_ENTRIES, noteId), {
    visibility,
    projectId,
    lastEditedAt: nowIso(),
    updatedAt: serverTimestamp(),
  });
}

export async function setNoteAiVisible(noteId: string, aiVisible: boolean): Promise<void> {
  await updateDoc(doc(db, NOTEBOOK_ENTRIES, noteId), {
    aiVisible,
    lastEditedAt: nowIso(),
    updatedAt: serverTimestamp(),
  });
}

function linkDocId(noteId: string, target: NoteLinkTarget) {
  return `${noteId}__${target.type}__${target.id}`;
}

export async function linkNote(input: {
  workspaceId: string;
  userId: string;
  noteId: string;
  target: NoteLinkTarget;
}): Promise<void> {
  const id = linkDocId(input.noteId, input.target);
  const existing = await getDoc(doc(db, "entity_links", id));
  if (!existing.exists()) {
    await setDoc(
      doc(db, "entity_links", id),
      {
        workspaceId: input.workspaceId,
        userId: input.userId,
        fromEntityType: "note",
        fromEntityId: input.noteId,
        toEntityType: input.target.type,
        toEntityId: input.target.id,
        relationType: NOTE_LINK_RELATION,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    await updateDoc(doc(db, NOTEBOOK_ENTRIES, input.noteId), {
      linkCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }
  if (input.target.type === "task") {
    await updateDoc(doc(db, "tasks", input.target.id), {
      linkedDocumentIds: arrayUnion(input.noteId),
    });
  }
}

export async function unlinkNote(input: {
  noteId: string;
  target: NoteLinkTarget;
}): Promise<void> {
  const id = linkDocId(input.noteId, input.target);
  const existing = await getDoc(doc(db, "entity_links", id));
  if (existing.exists()) {
    await deleteDoc(doc(db, "entity_links", id));
    await updateDoc(doc(db, NOTEBOOK_ENTRIES, input.noteId), {
      linkCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }
  if (input.target.type === "task") {
    await updateDoc(doc(db, "tasks", input.target.id), {
      linkedDocumentIds: arrayRemove(input.noteId),
    });
  }
}

export async function listNoteLinks(noteId: string): Promise<NoteLinkTarget[]> {
  const snap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("fromEntityType", "==", "note"),
      where("fromEntityId", "==", noteId),
    ),
  );
  return snap.docs.map((row) => {
    const data = row.data() as { toEntityType: string; toEntityId: string };
    return {
      type: data.toEntityType as NoteLinkTarget["type"],
      id: data.toEntityId,
    };
  });
}

export async function listNotesLinkedTo(
  workspaceId: string,
  target: NoteLinkTarget,
): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("workspaceId", "==", workspaceId),
      where("toEntityType", "==", target.type),
      where("toEntityId", "==", target.id),
      where("relationType", "==", NOTE_LINK_RELATION),
    ),
  );
  return snap.docs.map((row) => String((row.data() as { fromEntityId: string }).fromEntityId));
}
