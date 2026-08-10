export type NotebookEntryKind = "notebook" | "section" | "note";

export type NotebookEntry = {
  id: string;
  kind?: NotebookEntryKind;
  title?: string;
  content?: string;
  notebookId?: string | null;
  sectionId?: string | null;
  projectId?: string | null;
  tags?: string[];
  status?: string;
  updatedAt?: any;
  createdAt?: any;
};

function timestamp(value: any) {
  if (value?.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (value?.toMillis) return value.toMillis();
  return typeof value === "number" ? value : 0;
}

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: unknown) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2));
}

function scoreText(value: string, queryTokens: Set<string>) {
  const valueTokens = tokens(value);
  let score = 0;
  for (const token of queryTokens) if (valueTokens.has(token)) score += 1;
  return score;
}

function excerpt(value: string, queryTokens: Set<string>, size = 1_000) {
  const clean = String(value || "").trim();
  if (clean.length <= size) return clean;
  const lower = normalize(clean);
  const firstMatch = [...queryTokens].map((token) => lower.indexOf(token)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, firstMatch - Math.floor(size / 3));
  return clean.slice(start, start + size).trim();
}

export function parseTags(value: string): string[] {
  return [...new Set(
    String(value || "")
      .split(/,|\n|#/)
      .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(Boolean),
  )].slice(0, 12);
}

export function collectWorkspaceTags(records: Array<{ tags?: string[]; labels?: string[] }>) {
  return [...new Set(
    records
      .flatMap((record) => [...(record.tags || []), ...(record.labels || [])])
      .map((tag) => String(tag || "").trim().toLowerCase())
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right));
}

export function buildNotebookContext(
  entries: NotebookEntry[],
  query: string,
  options: { activeProjectId?: string | null; limit?: number } = {},
) {
  const queryTokens = tokens(query);
  const notebooks = new Map(entries.filter((entry) => entry.kind === "notebook").map((entry) => [entry.id, entry]));
  const sections = new Map(entries.filter((entry) => entry.kind === "section").map((entry) => [entry.id, entry]));
  const notes = entries.filter((entry) => entry.kind === "note" && entry.status !== "archived");
  const limit = options.limit || 5;

  return notes
    .map((note) => {
      const notebook = note.notebookId ? notebooks.get(note.notebookId) : null;
      const section = note.sectionId ? sections.get(note.sectionId) : null;
      const searchable = [
        note.title,
        note.content,
        ...(note.tags || []),
        notebook?.title,
        section?.title,
      ].join(" ");
      const exactProjectBoost = options.activeProjectId && note.projectId === options.activeProjectId ? 3 : 0;
      const queryScore = queryTokens.size === 0 ? 0 : scoreText(searchable, queryTokens);
      return {
        id: note.id,
        title: note.title || "Untitled note",
        type: "Notebook note",
        notebook: notebook?.title || "Notebook",
        section: section?.title || "Notes",
        projectId: note.projectId || "",
        summary: (note.tags || []).map((tag) => `#${tag}`).join(" "),
        excerpts: [{ index: 0, excerpt: excerpt(note.content || "", queryTokens) }],
        score: exactProjectBoost + queryScore + Math.min(timestamp(note.updatedAt || note.createdAt) / 1_000_000_000_000, 2),
      };
    })
    .filter((note) => queryTokens.size === 0 || note.score > 0 || note.projectId === options.activeProjectId)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ score: _score, ...note }) => note);
}
