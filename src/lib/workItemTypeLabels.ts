import { getLocale, type Locale } from "./i18n";

/** Canonical display names for work-item types across Certo Work. */
export const WORK_ITEM_TYPE_LABELS: Record<string, { en: string; es: string }> = {
  epic: { en: "Epic", es: "Épica" },
  feature: { en: "Feature", es: "Feature" },
  pbi: { en: "PBI/Task", es: "PBI/Task" },
  story: { en: "PBI/Task", es: "PBI/Task" },
  task: { en: "PBI/Task", es: "PBI/Task" },
  subtask: { en: "Sub Task", es: "Sub Task" },
  bug: { en: "bug", es: "bug" },
  issue: { en: "issue", es: "issue" },
  ticket: { en: "issue", es: "issue" },
  idea: { en: "idea", es: "idea" },
  note: { en: "note", es: "note" },
};

/** Types offered when creating / converting in the main pickers (unique labels). */
export const WORK_ITEM_CREATE_TYPES = [
  "epic",
  "feature",
  "pbi",
  "subtask",
  "bug",
  "issue",
] as const;

export type WorkItemCreateType = (typeof WORK_ITEM_CREATE_TYPES)[number];

export function workItemTypeLabel(
  kind: string,
  locale: Locale = getLocale(),
): string {
  const key = String(kind || "pbi").toLowerCase();
  const entry = WORK_ITEM_TYPE_LABELS[key] || WORK_ITEM_TYPE_LABELS.pbi;
  return entry[locale] || entry.en;
}

/** Deduplicate kinds that share a display label (e.g. pbi/story/task → one PBI/Task). */
export function uniqueWorkItemTypes<T extends string>(
  kinds: readonly T[],
  locale: Locale = getLocale(),
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const kind of kinds) {
    const label = workItemTypeLabel(kind, locale).toLowerCase();
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(kind);
  }
  return out;
}

/** Join parent-kind labels without repeating the same display name. */
export function joinWorkItemTypeLabels(
  kinds: readonly string[],
  locale: Locale = getLocale(),
  separator = " or ",
): string {
  return uniqueWorkItemTypes(kinds, locale)
    .map((kind) => workItemTypeLabel(kind, locale))
    .join(separator);
}
