import { useMemo, useState } from "react";
import type { Column, ColumnConfig, ColumnSummary, ColumnType, SoftTint } from "../../lib/tables";
import { softTintToCss } from "../../lib/tables/extendedTypes";

const TINTS: SoftTint[] = ["gray", "blue", "green", "yellow", "orange", "red", "purple", "teal"];

const TYPE_LABELS: Partial<Record<ColumnType, string>> = {
  text: "Text",
  longText: "Long text",
  longtext: "Long text",
  number: "Number",
  currency: "Currency",
  status: "Status",
  dropdown: "Dropdown",
  people: "People",
  person: "Person",
  date: "Date",
  timeline: "Timeline",
  checkbox: "Checkbox",
  email: "Email",
  phone: "Phone",
  url: "URL",
  files: "Files",
  file: "File",
  link: "Link",
  lookup: "Lookup",
  rollup: "Rollup",
  formula: "Formula",
  ai: "AI",
  autoNumber: "Auto number",
  createdAt: "Created at",
  updatedAt: "Updated at",
  button: "Button",
};

export type ColumnSettingsProps = {
  column: Column;
  allColumns: Column[];
  tables?: Array<{ id: string; name: string }>;
  onSave(next: Column): void;
  onChangeType?(nextType: ColumnType): void;
  onClose(): void;
};

export function migrateColumnType(column: Column, nextType: ColumnType): Column {
  const next: Column = { ...column, type: nextType, config: { ...(column.config || {}) } };
  if ((nextType === "status" || nextType === "dropdown") && !next.config?.options?.length) {
    next.config = {
      ...next.config,
      options: [
        { id: "opt1", label: "Option 1", color: "blue" },
        { id: "opt2", label: "Option 2", color: "green" },
      ],
    };
    next.options = (next.config?.options || []).map((o) => ({
      id: o.id,
      label: o.label,
      tone: "neutral",
      color: o.color,
    }));
  }
  if (nextType === "number" || nextType === "currency") {
    next.summary = next.summary || "sum";
    next.config = { ...next.config, format: nextType === "currency" ? "currency" : "plain", currency: "USD" };
  }
  if (nextType === "formula") {
    next.config = { ...next.config, expression: "1", resultType: "number" };
  }
  return next;
}

export function ColumnSettings({
  column,
  allColumns,
  tables = [],
  onSave,
  onChangeType,
  onClose,
}: ColumnSettingsProps) {
  const [draft, setDraft] = useState<Column>(() => ({ ...column, config: { ...(column.config || {}) } }));
  const config = draft.config || {};

  const patchConfig = (p: Partial<ColumnConfig>) =>
    setDraft((d) => ({ ...d, config: { ...(d.config || {}), ...p } }));

  const formulaPreview = useMemo(() => {
    if (draft.type !== "formula") return null;
    return draft.config?.expression || "";
  }, [draft]);

  return (
    <div className="cw-column-settings" data-testid="column-settings" style={{ padding: 16, maxWidth: 420 }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Column settings</h3>
        <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
          ×
        </button>
      </header>

      <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
        Name
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid #ECEEF3", borderRadius: 8 }}
        />
      </label>

      <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
        Type
        <select
          value={draft.type}
          onChange={(e) => {
            const nextType = e.target.value as ColumnType;
            const migrated = migrateColumnType(draft, nextType);
            setDraft(migrated);
            onChangeType?.(nextType);
          }}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid #ECEEF3", borderRadius: 8 }}
        >
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      {(draft.type === "status" || draft.type === "dropdown") && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Options</div>
          {(config.options || []).map((opt, i) => {
            const tint = softTintToCss(opt.color);
            return (
              <div key={opt.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <span style={{ background: tint.bg, color: tint.fg, padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                  {opt.label}
                </span>
                <input
                  value={opt.label}
                  onChange={(e) => {
                    const options = [...(config.options || [])];
                    options[i] = { ...opt, label: e.target.value };
                    patchConfig({ options });
                  }}
                  style={{ flex: 1, padding: 6, border: "1px solid #ECEEF3", borderRadius: 6 }}
                />
                <select
                  value={opt.color}
                  onChange={(e) => {
                    const options = [...(config.options || [])];
                    options[i] = { ...opt, color: e.target.value as SoftTint };
                    patchConfig({ options });
                  }}
                >
                  {TINTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label style={{ fontSize: 11 }}>
                  <input
                    type="checkbox"
                    checked={!!opt.done}
                    onChange={(e) => {
                      const options = [...(config.options || [])];
                      options[i] = { ...opt, done: e.target.checked };
                      patchConfig({ options });
                    }}
                  />{" "}
                  done
                </label>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              patchConfig({
                options: [
                  ...(config.options || []),
                  { id: `opt_${Date.now()}`, label: "New", color: "gray" },
                ],
              })
            }
            style={{ border: "none", background: "transparent", color: "#2547C4", cursor: "pointer" }}
          >
            + Add option
          </button>
        </div>
      )}

      {(draft.type === "number" || draft.type === "currency") && (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>
            Format
            <select
              value={config.format || "plain"}
              onChange={(e) => patchConfig({ format: e.target.value as ColumnConfig["format"] })}
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
            >
              <option value="plain">Plain</option>
              <option value="currency">Currency</option>
              <option value="percent">Percent</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            Currency
            <input
              value={config.currency || "USD"}
              onChange={(e) => patchConfig({ currency: e.target.value })}
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            Summary
            <select
              value={draft.summary || "sum"}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value as ColumnSummary })}
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
            >
              {["none", "sum", "avg", "min", "max", "count", "countEmpty"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {draft.type === "link" && (
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
          Target table
          <select
            value={config.targetTableId || ""}
            onChange={(e) => patchConfig({ targetTableId: e.target.value, twoWay: true })}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
          >
            <option value="">Select…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {(draft.type === "lookup" || draft.type === "rollup") && (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>
            Via link column
            <select
              value={config.viaColumnId || ""}
              onChange={(e) => patchConfig({ viaColumnId: e.target.value })}
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
            >
              <option value="">Select…</option>
              {allColumns
                .filter((c) => c.type === "link" || c.type === "relation")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          {draft.type === "rollup" && (
            <label style={{ fontSize: 12 }}>
              Function
              <select
                value={config.fn || "count"}
                onChange={(e) => patchConfig({ fn: e.target.value as ColumnConfig["fn"] })}
                style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
              >
                {["sum", "count", "avg", "min", "max", "countIf"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {draft.type === "formula" && (
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
          Expression
          <textarea
            value={config.expression || ""}
            onChange={(e) => patchConfig({ expression: e.target.value })}
            rows={3}
            placeholder="DAYS(TODAY(), {Lease end})"
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8, fontFamily: "ui-monospace, monospace" }}
          />
          <span style={{ color: "#6B7280" }}>Preview: {formulaPreview}</span>
        </label>
      )}

      {draft.type === "ai" && (
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
          Prompt
          <textarea
            value={config.prompt || ""}
            onChange={(e) => patchConfig({ prompt: e.target.value, refresh: "manual" })}
            rows={3}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => onSave(draft)}
          style={{ background: "#2547C4", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}
        >
          Save
        </button>
        <button type="button" onClick={onClose} style={{ border: "1px solid #ECEEF3", borderRadius: 8, padding: "8px 14px", background: "#fff", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
