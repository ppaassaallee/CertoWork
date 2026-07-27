export interface RetrievalCandidate {
  id: string;
  workspaceId?: string;
  source: "knowledge" | "task" | "project" | "goal" | "conversation";
  title: string;
  body?: string;
  tags?: string[];
  updatedAt?: Date | string | number | null;
}

export interface RankedRetrievalResult extends RetrievalCandidate {
  score: number;
  matchedTerms: string[];
}

const SEMANTIC_EXPANSIONS: Record<string, string[]> = {
  plan: ["schedule", "calendar", "priority", "week", "today"],
  schedule: ["plan", "calendar", "time", "meeting"],
  project: ["initiative", "outcome", "milestone", "deliverable"],
  task: ["action", "todo", "commitment", "followup"],
  report: ["summary", "snapshot", "review", "metrics"],
  risk: ["blocker", "conflict", "dependency", "warning"],
  goal: ["objective", "outcome", "strategy", "target"],
  meeting: ["notes", "agenda", "decision", "followup"],
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "but",
  "for",
  "from",
  "have",
  "into",
  "just",
  "more",
  "that",
  "the",
  "their",
  "this",
  "with",
  "what",
  "when",
  "where",
  "your",
]);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map((token) => (token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token));
}

function expandedQueryTerms(query: string) {
  const direct = tokenize(query);
  const expanded = new Set(direct);
  for (const term of direct) {
    for (const synonym of SEMANTIC_EXPANSIONS[term] || []) expanded.add(synonym);
  }
  return { direct: new Set(direct), expanded };
}

function recencyBoost(value: RetrievalCandidate["updatedAt"]) {
  if (!value) return 0;
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  const days = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  if (days <= 7) return 0.5;
  if (days <= 30) return 0.25;
  return 0;
}

export function rankRetrievalCandidates(
  query: string,
  candidates: RetrievalCandidate[],
  limit = 8,
): RankedRetrievalResult[] {
  const { direct, expanded } = expandedQueryTerms(query);
  const normalizedQuery = query.toLowerCase().trim();

  return candidates
    .map((candidate) => {
      const titleTerms = tokenize(candidate.title);
      const bodyTerms = tokenize(candidate.body || "");
      const tagTerms = tokenize((candidate.tags || []).join(" "));
      const allTerms = new Set([...titleTerms, ...bodyTerms, ...tagTerms]);
      const matchedTerms = [...expanded].filter((term) => allTerms.has(term));
      let score = recencyBoost(candidate.updatedAt);

      for (const term of matchedTerms) {
        const directWeight = direct.has(term) ? 1 : 0.35;
        if (titleTerms.includes(term)) score += 2.2 * directWeight;
        if (tagTerms.includes(term)) score += 1.5 * directWeight;
        if (bodyTerms.includes(term)) score += 0.8 * directWeight;
      }
      if (
        normalizedQuery.length > 5 &&
        `${candidate.title} ${candidate.body || ""}`.toLowerCase().includes(normalizedQuery)
      ) {
        score += 4;
      }

      return { ...candidate, score, matchedTerms };
    })
    .filter((candidate) => candidate.score >= 0.25)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
