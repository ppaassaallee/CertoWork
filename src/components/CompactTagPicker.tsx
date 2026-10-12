import { useMemo, useState } from "react";
import { isProductFlagEnabled } from "../lib/featureFlags";
import {
  isTagCategory,
  tagIds,
  tagLabels,
  tagName,
  toggleTagWithCatalog,
  type TagLike,
} from "../lib/tagging";

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
  const catalog = useMemo(() => (tags || []).filter(isTagCategory), [tags]);
  const ids = tagIds(record);
  const labels = tagLabels(record, catalog);
  const summary = compactTagSummary(labels);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  if (!isProductFlagEnabled("tagDedupe")) {
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
                if (id) onChange(toggleTagWithCatalog(record, id, catalog));
              });
              return;
            }
            onChange(toggleTagWithCatalog(record, value, catalog));
          }}
          value=""
        >
          <option value="">{summary}</option>
          {catalog.map((tag) => (
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

  const needle = query.trim().toLowerCase();
  const visible = catalog.filter((tag) => tagName(tag).toLowerCase().includes(needle));
  const exact = catalog.some((tag) => tagName(tag).toLowerCase() === needle);

  const choose = (tagId: string) => {
    onChange(toggleTagWithCatalog(record, tagId, catalog));
    setQuery("");
  };

  const create = () => {
    const name = query.trim();
    if (!name || !onCreateTag) return;
    const existing = catalog.find((tag) => tagName(tag).toLowerCase() === name.toLowerCase());
    if (existing) {
      choose(existing.id);
      return;
    }
    Promise.resolve(onCreateTag(name)).then((createdId) => {
      const id = String(createdId || "").trim();
      if (id) onChange(toggleTagWithCatalog(record, id, catalog));
      setQuery("");
    });
  };

  return (
    <div className="do-tag-picker" title={labels.join(", ") || "No tags"}>
      <button
        aria-expanded={open}
        aria-label={label}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {summary}
      </button>
      {open ? (
        <div className="do-tag-picker-menu">
          <input
            aria-label={`${label} search`}
            autoFocus
            placeholder="Search tags"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                create();
              }
              if (event.key === "Escape") setOpen(false);
            }}
          />
          <ul>
            {visible.map((tag) => (
              <li key={tag.id}>
                <button type="button" onClick={() => choose(tag.id)}>
                  {ids.includes(tag.id) ? "Remove" : "Add"} {tagName(tag)}
                </button>
              </li>
            ))}
          </ul>
          {needle && !exact && onCreateTag ? (
            <button type="button" onClick={create}>
              Create “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
