export const NOTEBOOK_ENTRIES = "notebook_entries";

export type NoteVisibility = "private" | "project" | "workspace";

export type NoteType = "note" | "meeting" | "idea" | "spec" | "journal" | "review" | "client";

/** Campos nuevos; los existentes siguen igual (ver NotebookEntry en src/lib/notebookContext.ts). */
export type NoteExtension = {
  visibility?: NoteVisibility; // heredado del cuaderno; editable por nota
  noteType?: NoteType; // plantilla usada
  aiVisible?: boolean; // reemplaza la copia a knowledge_items
  lastEditedBy?: string | null; // uid
  lastEditedAt?: string | null; // ISO
  attendeeIds?: string[]; // solo meeting
  meetingDate?: string | null; // YYYY-MM-DD, solo meeting
  linkCount?: number; // cache para la lista; fuente de verdad = entity_links
  /** Cuadernos/secciones de sistema. "personal" = cuaderno raíz personal. */
  system?: "personal" | "inbox" | "journal" | "reviews" | "project" | null;
  userId?: string;
  workspaceId?: string;
  createdBy?: string | null;
};

export type NoteLinkTarget =
  | { type: "task"; id: string }
  | { type: "project"; id: string }
  | { type: "person"; id: string }
  | { type: "note"; id: string }
  | { type: "record"; id: string };

export const NOTE_LINK_RELATION = "note_reference";

/** Legacy docs without visibility are private (Paso 1: users only see own notes). */
export const DEFAULT_NOTE_VISIBILITY: NoteVisibility = "private";
