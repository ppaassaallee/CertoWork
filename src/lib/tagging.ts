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
  return ids.map((id) => tags.find((tag) => tag.id === id)?.name || id);
}

export function matchesTag(record: any, tagId: string) {
  return tagId === "all" || tagIds(record).includes(tagId);
}

export function toggleTagId(record: any, tagId: string) {
  const ids = tagIds(record);
  const next = ids.includes(tagId)
    ? ids.filter((candidate) => candidate !== tagId)
    : [...ids, tagId];
  return { tagIds: next, tags: next, labels: next };
}
