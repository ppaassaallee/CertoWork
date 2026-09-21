import { useMemo, useState } from "react";
import {
  BUILTIN_SYSTEM_TEMPLATES,
  type SystemTemplate,
} from "../../lib/tables/templates/systemTemplates";
import { provisionTemplateLocal } from "../../lib/tables/templates/provision";
import { OdysseusSystemBuilder } from "./OdysseusSystemBuilder";

export function SystemTemplateGallery(props: {
  workspaceId: string;
  userId: string;
  onProvisioned?(tableIds: Record<string, string>, dashboardId?: string): void;
  onClose?(): void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [preview, setPreview] = useState<SystemTemplate | null>(null);
  const [withSample, setWithSample] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"gallery" | "describe">("gallery");

  const categories = useMemo(() => {
    const set = new Set(BUILTIN_SYSTEM_TEMPLATES.map((t) => t.category));
    return ["all", ...[...set].sort()];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILTIN_SYSTEM_TEMPLATES.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  if (mode === "describe") {
    return (
      <div data-testid="system-template-gallery">
        <button type="button" onClick={() => setMode("gallery")} style={{ marginBottom: 12, border: "none", background: "transparent", color: "#2547C4", cursor: "pointer" }}>
          ← Templates
        </button>
        <OdysseusSystemBuilder
          workspaceId={props.workspaceId}
          userId={props.userId}
          onBuilt={(ids) => props.onProvisioned?.(ids)}
          onClose={props.onClose}
        />
      </div>
    );
  }

  return (
    <div className="cw-system-templates" data-testid="system-template-gallery" style={{ padding: 16 }}>
      <header style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: 18 }}>From template</h2>
        <button
          type="button"
          onClick={() => setMode("describe")}
          style={{ border: "1px solid #ECEEF3", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer", color: "#2547C4" }}
        >
          Describe your process
        </button>
        {props.onClose ? (
          <button type="button" onClick={props.onClose}>
            Close
          </button>
        ) : null}
      </header>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search templates"
        style={{ width: "100%", padding: 8, border: "1px solid #ECEEF3", borderRadius: 8, marginBottom: 8 }}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "4px 10px",
              background: category === c ? "rgba(37,71,196,.12)" : "#F7F8FA",
              color: category === c ? "#2547C4" : "#6B7280",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`system-template-${t.id}`}
            onClick={() => setPreview(t)}
            style={{
              textAlign: "left",
              border: preview?.id === t.id ? "2px solid #2547C4" : "1px solid #ECEEF3",
              borderRadius: 12,
              padding: 14,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1F2430" }}>{t.name}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{t.description}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
              {t.tables.length} tables · {(t.automations || []).length} automations
            </div>
          </button>
        ))}
      </div>

      {preview ? (
        <div style={{ marginTop: 16, borderTop: "1px solid #ECEEF3", paddingTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>{preview.name}</h3>
          <ul style={{ fontSize: 13 }}>
            {preview.tables.map((t) => (
              <li key={t.key}>
                {t.name} — {t.columns.length} columns
              </li>
            ))}
          </ul>
          {(preview.automations || []).length ? (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>
                Automations ({preview.automations!.length})
              </summary>
              <ul style={{ fontSize: 12 }}>
                {preview.automations!.map((a, i) => (
                  <li key={i}>{a.sentence}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "12px 0" }}>
            <input type="checkbox" checked={withSample} onChange={(e) => setWithSample(e.target.checked)} />
            Include sample data
          </label>
          <button
            type="button"
            disabled={busy}
            data-testid="use-system-template"
            style={{ background: "#2547C4", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px" }}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const res = await provisionTemplateLocal(preview, {
                    workspaceId: props.workspaceId,
                    userId: props.userId,
                    withSampleData: withSample,
                  });
                  props.onProvisioned?.(res.tableIds, res.dashboardId);
                  props.onClose?.();
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Building…" : "Use template"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
