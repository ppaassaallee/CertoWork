export type OdysseusPanelScope =
  | { kind: "item"; entityId: string; label: string }
  | { kind: "project"; entityId: string; label: string }
  | { kind: "day"; entityId: null; label: string }
  | { kind: "workspace"; entityId: null; label: string };

export type OdysseusNativeItem = {
  id: string;
  title: string;
  status?: string | null;
  dueDate?: string | null;
  workItemType?: string | null;
  projectTitle?: string | null;
};

export type OdysseusPanelBlock =
  | { type: "items"; items: OdysseusNativeItem[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "actions"; actions: Array<{ id: string; title: string; summary?: string }> };

export type OdysseusPanelMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: OdysseusPanelBlock[];
  suggestions?: string[];
  createdAt: number;
};

export type OdysseusThread = {
  id: string;
  title: string;
  tag: "Resumen" | "Borrador" | "Análisis" | "Editó" | "Rutina" | "Chat";
  updatedAt: number;
  messages: OdysseusPanelMessage[];
};
