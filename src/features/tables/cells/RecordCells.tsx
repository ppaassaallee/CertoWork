import { useEffect, useRef, useState } from "react";
import type { Column, RecordValue, StatusOption } from "../../../lib/tables";
import { t } from "../../../lib/i18n";

export type TableMember = { id: string; name: string; email: string };

type CellProps = {
  column: Column;
  value: RecordValue;
  onChange: (next: RecordValue) => void;
  members?: TableMember[];
  readOnly?: boolean;
};

function asString(value: RecordValue): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function asStringArray(value: RecordValue): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function toneClass(tone?: StatusOption["tone"]) {
  return `cw-tables-tone-${tone || "neutral"}`;
}

function relativeDateLabel(iso: string): { label: string; past: boolean } {
  if (!iso) return { label: "", past: false };
  const day = iso.slice(0, 10);
  const target = new Date(`${day}T12:00:00`);
  if (Number.isNaN(target.getTime())) return { label: day, past: false };
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return { label: t("tables.date.today"), past: false };
  if (diffDays === 1) return { label: t("tables.date.tomorrow"), past: false };
  if (diffDays === -1) return { label: t("tables.date.yesterday"), past: true };
  if (diffDays > 1 && diffDays < 7) {
    return { label: t("tables.date.inDays").replace("{n}", String(diffDays)), past: false };
  }
  if (diffDays < -1 && diffDays > -7) {
    return { label: t("tables.date.daysAgo").replace("{n}", String(Math.abs(diffDays))), past: true };
  }
  return {
    label: target.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    past: diffDays < 0,
  };
}

export function TextCell({ value, onChange, readOnly }: CellProps) {
  const [draft, setDraft] = useState(asString(value));
  useEffect(() => setDraft(asString(value)), [value]);
  if (readOnly) return <span className="cw-tables-cell-text">{asString(value) || "—"}</span>;
  return (
    <input
      className="cw-tables-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== asString(value)) onChange(draft || null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function NumberCell({ value, onChange, readOnly, column }: CellProps) {
  const display =
    typeof value === "number"
      ? value
      : value == null || value === ""
        ? ""
        : Number(value);
  const [draft, setDraft] = useState(display === "" || Number.isNaN(display as number) ? "" : String(display));
  useEffect(() => {
    setDraft(
      value == null || value === ""
        ? ""
        : String(typeof value === "number" ? value : Number(value)),
    );
  }, [value]);
  if (readOnly) {
    return (
      <span className="cw-tables-cell-num">
        {value == null || value === "" ? "—" : asString(value)}
        {column.currency ? ` ${column.currency}` : ""}
      </span>
    );
  }
  return (
    <input
      className="cw-tables-input cw-tables-input-num"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (!trimmed) {
          if (value != null && value !== "") onChange(null);
          return;
        }
        const n = Number(trimmed.replace(/,/g, ""));
        if (Number.isFinite(n) && n !== value) onChange(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function DateCell({ value, onChange, readOnly }: CellProps) {
  const iso = asString(value).slice(0, 10);
  const rel = relativeDateLabel(iso);
  if (readOnly) {
    return (
      <span className={`cw-tables-date ${rel.past ? "is-past" : ""}`}>
        <span className="cw-tables-date-abs">{iso || "—"}</span>
        {rel.label ? <span className="cw-tables-date-rel">{rel.label}</span> : null}
      </span>
    );
  }
  return (
    <label className={`cw-tables-date-edit ${rel.past ? "is-past" : ""}`}>
      <input
        className="cw-tables-input cw-tables-input-date"
        type="date"
        value={iso}
        onChange={(e) => onChange(e.target.value || null)}
      />
      {rel.label ? <span className="cw-tables-date-rel">{rel.label}</span> : null}
    </label>
  );
}

export function StatusCell({ column, value, onChange, readOnly }: CellProps) {
  const options = column.options || [];
  const current = options.find((o) => o.id === value) || null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (readOnly) {
    return (
      <span className={`cw-tables-status-chip ${toneClass(current?.tone)}`}>
        {current?.label || asString(value) || "—"}
      </span>
    );
  }

  return (
    <div className="cw-tables-status" ref={ref}>
      <button
        type="button"
        className={`cw-tables-status-chip ${toneClass(current?.tone)}`}
        onClick={() => setOpen((v) => !v)}
      >
        {current?.label || t("tables.status.empty")}
      </button>
      {open ? (
        <div className="cw-tables-popover" role="listbox">
          <button
            type="button"
            className="cw-tables-popover-item"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            {t("tables.status.clear")}
          </button>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`cw-tables-popover-item ${toneClass(opt.tone)}`}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
            >
              <span className={`cw-tables-status-chip ${toneClass(opt.tone)}`}>{opt.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PersonCell({ value, onChange, members = [], readOnly }: CellProps) {
  const id = asString(value);
  const member = members.find((m) => m.id === id);
  const label = member?.name || member?.email || id;
  if (readOnly) {
    return <span className="cw-tables-person">{label || "—"}</span>;
  }
  return (
    <select
      className="cw-tables-select"
      value={id}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{t("tables.person.unassigned")}</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name || m.email}
        </option>
      ))}
    </select>
  );
}

export function TagsCell({ value, onChange, column, readOnly }: CellProps) {
  const tags = asStringArray(value);
  const [draft, setDraft] = useState(tags.join(", "));
  useEffect(() => setDraft(asStringArray(value).join(", ")), [value]);

  if (readOnly) {
    return (
      <div className="cw-tables-tags">
        {tags.length
          ? tags.map((tag) => (
              <span key={tag} className="cw-tables-tag">
                {tag}
              </span>
            ))
          : "—"}
      </div>
    );
  }

  const known = column.tagOptions || [];
  return (
    <div className="cw-tables-tags-edit">
      <input
        className="cw-tables-input"
        list={known.length ? `cw-tables-tags-${column.id}` : undefined}
        placeholder={t("tables.tags.placeholder")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (JSON.stringify(next) !== JSON.stringify(tags)) onChange(next.length ? next : null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {known.length ? (
        <datalist id={`cw-tables-tags-${column.id}`}>
          {known.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

export function CheckboxCell({ value, onChange, readOnly }: CellProps) {
  const checked = value === true;
  return (
    <label className="cw-tables-check">
      <input
        type="checkbox"
        checked={checked}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function UrlCell({ value, onChange, readOnly }: CellProps) {
  const href = asString(value);
  if (readOnly) {
    return href ? (
      <a className="cw-tables-url" href={href} target="_blank" rel="noreferrer">
        {href.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      <span className="cw-tables-muted">—</span>
    );
  }
  return (
    <input
      className="cw-tables-input"
      type="url"
      placeholder="https://"
      value={href}
      onChange={(e) => onChange(e.target.value || null)}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next !== href) onChange(next || null);
      }}
    />
  );
}

export function RelationCell({ value, onChange, readOnly }: CellProps) {
  const display = Array.isArray(value) ? value.join(", ") : asString(value);
  if (readOnly) return <span className="cw-tables-relation">{display || "—"}</span>;
  return (
    <input
      className="cw-tables-input"
      placeholder={t("tables.relation.placeholder")}
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(
          raw.includes(",")
            ? raw.split(",").map((s) => s.trim()).filter(Boolean)
            : raw || null,
        );
      }}
    />
  );
}

export function FileCell({ value, onChange, readOnly }: CellProps) {
  const url = asString(value);
  if (readOnly) {
    return url ? (
      <a className="cw-tables-file" href={url} target="_blank" rel="noreferrer">
        {url.split("/").pop() || url}
      </a>
    ) : (
      <span className="cw-tables-muted">—</span>
    );
  }
  return (
    <div className="cw-tables-file-edit">
      <input
        className="cw-tables-input"
        type="text"
        placeholder={t("tables.file.urlPlaceholder")}
        value={url}
        onChange={(e) => onChange(e.target.value || null)}
      />
      <input
        className="cw-tables-file-input"
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          // Local preview path until upload wiring exists
          onChange(file.name);
        }}
      />
    </div>
  );
}

export function CellRenderer({
  column,
  value,
  onChange,
  members,
  readOnly,
}: CellProps) {
  const props: CellProps = { column, value, onChange, members, readOnly };
  switch (column.type) {
    case "number":
    case "currency":
      return <NumberCell {...props} />;
    case "date":
    case "created_at":
    case "updated_at":
      return <DateCell {...props} />;
    case "status":
      return <StatusCell {...props} />;
    case "person":
    case "created_by":
      return <PersonCell {...props} />;
    case "tags":
      return <TagsCell {...props} />;
    case "checkbox":
      return <CheckboxCell {...props} />;
    case "url":
    case "email":
    case "phone":
      return column.type === "url" ? <UrlCell {...props} /> : <TextCell {...props} />;
    case "relation":
      return <RelationCell {...props} />;
    case "file":
      return <FileCell {...props} />;
    case "longtext":
    case "text":
    default:
      return <TextCell {...props} />;
  }
}
