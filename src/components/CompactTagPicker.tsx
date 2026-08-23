import { tagIds, tagLabels, toggleTagId, type TagLike } from "../lib/tagging";

export function compactTagSummary(labels: string[]): string {
  if (labels.length === 0) return "No tags";
  if (labels.length === 1) return labels[0];
  return `${labels.length} tags`;
}

export function CompactTagPicker({
  record,
  tags,
  onChange,
  onCreateTag,
  label = "Tags",
}: {
  record: any;
  tags: TagLike[];
  onChange: (patch: Record<string, unknown>) => void;
  onCreateTag?: (name: string) => Promise<string | void> | string | void;
  label?: string;
}) {
  const ids = tagIds(record);
  const labels = tagLabels(record, tags);
  const summary = compactTagSummary(labels);

  return (
    <div className="do-tag-picker" title={labels.join(", ") || "No tags"}>
      <select
        aria-label={label}
        onChange={(event) => {
          const value = event.target.value;
          event.target.value = "";
          if (!value) return;
          if (value === "__create_tag__") {
            const name = window.prompt("Create tag");
            const cleaned = String(name || "").trim();
            if (!cleaned) return;
            Promise.resolve(onCreateTag?.(cleaned)).then((createdId) => {
              const id = String(createdId || cleaned).trim();
              if (id) onChange(toggleTagId(record, id));
            });
            return;
          }
          onChange(toggleTagId(record, value));
        }}
        value=""
      >
        <option value="">{summary}</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {ids.includes(tag.id) ? "Remove " : "Add "}
            {tag.name || tag.id}
          </option>
        ))}
        {onCreateTag && <option value="__create_tag__">Create tag…</option>}
      </select>
    </div>
  );
}
