import { hierarchyKind } from "./itemHierarchy";

export type ContentItem = { workItemType?: unknown; type?: unknown; itemType?: unknown; status?: unknown };
export type ProjectContentFilter = { mode: "all" | "empty" | "nonempty" | "includes" | "only" | "excludes"; kinds: string[] };

/** Counts all non-deleted work, including completed items; never confuses empty with no open work. */
export function matchesProjectContents(items: ContentItem[], filter: ProjectContentFilter): boolean {
  const present = new Set(items.filter((item) => String(item.status || "").toLowerCase() !== "deleted").map(hierarchyKind));
  if (filter.mode === "all") return true;
  if (filter.mode === "empty") return present.size === 0;
  if (filter.mode === "nonempty") return present.size > 0;
  if (!filter.kinds.length) return true;
  if (filter.mode === "excludes") return filter.kinds.every((kind) => !present.has(kind as ReturnType<typeof hierarchyKind>));
  const includes = filter.kinds.every((kind) => present.has(kind as ReturnType<typeof hierarchyKind>));
  return includes && (filter.mode !== "only" || [...present].every((kind) => filter.kinds.includes(kind)));
}
