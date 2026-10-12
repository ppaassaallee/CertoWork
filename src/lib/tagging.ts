export type TagLike = {
  id: string;
  name?: string;
  color?: string;
  group?: string;
};

export function tagName(tag: TagLike): string {
  return String(tag.name || tag.id || "Tag").trim();
}

export function tagIds(record: any): string[] {
  const raw = Array.isArray(record?.tagIds)
    ? record.tagIds
    : Array.isArray(record?.tags)
      ? record.tags
      : Array.isArray(record?.labels)
        ? record.labels
        : [];
  return [
    ...new Set(
      raw.map((value: any) => String(value || "").trim()).filter(Boolean),
    ),
  ] as string[];
}

export function tagLabels(record: any, tags: TagLike[]): string[] {
  const ids = tagIds(record);
  return ids.map((id) => {
    const exact = tags.find((tag) => tag.id === id);
    if (exact) return tagName(exact);
    const byName = tags.find(
      (tag) => tagName(tag).toLowerCase() === id.toLowerCase(),
    );
    if (byName) return tagName(byName);
    return id.length >= 16 && /^[A-Za-z0-9_-]+$/.test(id)
      ? "Unresolved tag"
      : id;
  });
}

export function matchesTag(record: any, tagId: string, catalog: TagLike[] = []) {
  if (tagId === "all") return true;
  const ids = tagIds(record);
  if (!catalog.length) return ids.includes(tagId);
  const equivalents = equivalentTagIds(catalog, tagId);
  return ids.some((id) => equivalents.has(id));
}

const NON_TAG_GROUPS = new Set([
  "delivery_entity",
  "client_entity",
  "bpo",
  "client",
  "project_stage",
  "project_phase",
  "project_status",
  "project_health",
  "gtd_action",
]);

/** Client Entity and Delivery Entity never count as tags. */
export function isTagCategory(tag: TagLike) {
  const group = String(tag.group || "tag").toLowerCase();
  return !NON_TAG_GROUPS.has(group);
}

/** Case, accents, and extra spaces collapse to one catalog key. */
export function normalizeTagKey(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalTagIds(record: any, catalog: TagLike[] = []) {
  const tags = catalog.filter(isTagCategory);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of tagIds(record)) {
    const match = tags.find(
      (tag) => tag.id === id || normalizeTagKey(tagName(tag)) === normalizeTagKey(id),
    );
    const canonical = match?.id || id;
    const key = normalizeTagKey(match ? tagName(match) : canonical);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(canonical);
  }
  return next;
}

export type TagCleanupPlan = { id: string; before: string[]; after: string[] };

/**
 * Dry-run. A second pass on `after` is empty.
 * Rollback: write each `before` array back to tagIds, tags, and labels.
 */
export function planTagCleanup(records: any[], catalog: TagLike[] = []): TagCleanupPlan[] {
  const plans: TagCleanupPlan[] = [];
  for (const record of records || []) {
    const raw = Array.isArray(record?.tagIds)
      ? record.tagIds
      : Array.isArray(record?.tags)
        ? record.tags
        : Array.isArray(record?.labels)
          ? record.labels
          : [];
    const before = raw.map((value: unknown) => String(value || "").trim()).filter(Boolean);
    const after = canonicalTagIds(record, catalog);
    const changed = before.length !== after.length || before.some((id: string, index: number) => id !== after[index]);
    if (!changed || !record?.id) continue;
    plans.push({ id: String(record.id), before, after });
  }
  return plans;
}

export function toggleTagId(record: any, tagId: string) {
  const ids = tagIds(record);
  const next = ids.includes(tagId)
    ? ids.filter((candidate) => candidate !== tagId)
    : [...ids, tagId];
  return { tagIds: next, tags: next, labels: next };
}

/** Options for a tag filter: real tags only, one row per normalized name. */
export function tagFilterOptions(tags: TagLike[]): TagLike[] {
  return dedupeTagsByName((tags || []).filter(isTagCategory));
}

/** One chip per name. Keeps the first id so duplicate category docs are not offered again. */
export function dedupeTagsByName(tags: TagLike[]): TagLike[] {
  const seen = new Set<string>();
  const out: TagLike[] = [];
  for (const tag of tags || []) {
    const key = normalizeTagKey(tagName(tag));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

function equivalentTagIds(catalog: TagLike[], tagId: string): Set<string> {
  const match = catalog.find((tag) => tag.id === tagId);
  const name = normalizeTagKey(match ? tagName(match) : tagId);
  const ids = catalog
    .filter((tag) => tag.id === tagId || normalizeTagKey(tagName(tag)) === name)
    .map((tag) => tag.id)
    .filter(Boolean);
  return new Set(ids.length ? ids : [tagId]);
}

/**
 * Toggle a tag and also clear duplicate catalog ids that share its name.
 * Does not delete category documents.
 */
export function toggleTagWithCatalog(record: any, tagId: string, catalog: TagLike[]) {
  const equivalents = equivalentTagIds(catalog, tagId);
  const ids = tagIds(record);
  const has = ids.some((id) => equivalents.has(id));
  const next = has
    ? ids.filter((id) => !equivalents.has(id))
    : [...ids, tagId];
  return { tagIds: next, tags: next, labels: next };
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Review file for the dry-run. One row per item that would change. */
export function tagCleanupCsv(plan: TagCleanupPlan[]) {
  const lines = ["id,before,after"];
  for (const row of plan) {
    lines.push([row.id, row.before.join("|"), row.after.join("|")].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}
