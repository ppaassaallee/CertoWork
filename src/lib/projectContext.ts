function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: unknown) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2));
}

function contentOf(document: any) {
  return String(document?.content || document?.body || document?.description || "");
}

function chunks(value: string, size = 2_800, overlap = 240) {
  if (!value) return [];
  const output: string[] = [];
  for (let start = 0; start < value.length; start += size - overlap) {
    output.push(value.slice(start, start + size));
    if (start + size >= value.length) break;
  }
  return output;
}

function relevance(value: string, queryTokens: Set<string>) {
  const valueTokens = tokens(value);
  let score = 0;
  for (const token of queryTokens) if (valueTokens.has(token)) score += 1;
  return score;
}

export function buildProjectDocumentContext(documents: any[], query: string) {
  const queryTokens = tokens(query);
  return documents
    .map((document) => {
      const content = contentOf(document);
      const rankedChunks = chunks(content)
        .map((excerpt, index) => ({ excerpt, index, score: relevance(excerpt, queryTokens) }))
        .sort((left, right) => right.score - left.score || left.index - right.index);
      const selected = rankedChunks
        .filter((chunk, index) => index === 0 || chunk.score > 0)
        .slice(0, 2)
        .sort((left, right) => left.index - right.index)
        .map(({ excerpt, index }) => ({ index, excerpt }));
      return {
        id: document.id,
        title: document.title || document.name || "Untitled project document",
        type: document.docType || document.type || "Project document",
        projectId: document.projectId,
        summary: document.summary || document.description || "",
        characterCount: content.length,
        excerpts: selected,
        score: relevance(`${document.title || ""} ${document.summary || ""}`, queryTokens) +
          rankedChunks.reduce((best, chunk) => Math.max(best, chunk.score), 0),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ score: _score, ...document }) => document);
}
