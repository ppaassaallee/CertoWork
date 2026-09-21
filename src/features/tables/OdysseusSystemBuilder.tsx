import { useState } from "react";
import type { SystemTemplate } from "../../lib/tables/templates/systemTemplates";
import { BUILTIN_SYSTEM_TEMPLATES } from "../../lib/tables/templates/systemTemplates";
import { provisionTemplateLocal } from "../../lib/tables/templates/provision";

/**
 * Odysseus system builder — describe a process → template draft → edit → Build.
 * Uses schema-constrained draft locally; wires to <llmCall> when available.
 */
export function OdysseusSystemBuilder(props: {
  workspaceId: string;
  userId: string;
  onBuilt?(tableIds: Record<string, string>): void;
  onClose?(): void;
}) {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<SystemTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextActions, setNextActions] = useState<string[]>([]);

  const describeToDraft = (text: string): SystemTemplate => {
    const lower = text.toLowerCase();
    if (lower.includes("rental") || lower.includes("property") || lower.includes("lease") || lower.includes("rent")) {
      return BUILTIN_SYSTEM_TEMPLATES.find((t) => t.id === "property-management")!;
    }
    if (lower.includes("recruit") || lower.includes("candidate")) {
      return BUILTIN_SYSTEM_TEMPLATES.find((t) => t.id === "recruiting")!;
    }
    if (lower.includes("crm") || lower.includes("lead")) {
      return BUILTIN_SYSTEM_TEMPLATES.find((t) => t.id === "simple-crm")!;
    }
    // Generic single-table draft from description
    return {
      id: `draft_${Date.now()}`,
      name: text.slice(0, 48) || "New system",
      description: text,
      category: "custom",
      cover: "#2547C4",
      tables: [
        {
          key: "main",
          name: "Main",
          columns: [
            { id: "name", name: "Name", type: "text", required: true },
            { id: "status", name: "Status", type: "status", options: [
              { id: "new", label: "New", tone: "info", color: "blue" },
              { id: "done", label: "Done", tone: "success", color: "green" },
            ]},
            { id: "owner", name: "Owner", type: "people" },
            { id: "due", name: "Due", type: "date" },
          ],
          groups: [{ id: "g-default", name: "Main", color: "#2547C4", order: 0 }],
        },
      ],
      automations: [
        {
          sentence: "When Status changes to Done, set Due to today",
          trigger: { type: "record.changed", tableId: "main", columnId: "status", to: "done" },
          conditions: [],
          actions: [{ type: "set", columnId: "due", value: { fn: "today" } }],
        },
      ],
    };
  };

  return (
    <div className="cw-odysseus-builder" data-testid="odysseus-system-builder" style={{ padding: 20, maxWidth: 720 }}>
      <h2 style={{ marginTop: 0, color: "#1F2430" }}>Describe your process</h2>
      <p style={{ fontSize: 13, color: "#6B7280" }}>
        Odysseus drafts tables, views, links, automations, and a dashboard — then you edit and Build.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="I manage 5 rental properties. I need to track tenants, leases, rent collection every month…"
        style={{ width: "100%", padding: 12, border: "1px solid #ECEEF3", borderRadius: 10 }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          style={{ background: "#2547C4", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px" }}
          onClick={() => setDraft(describeToDraft(prompt))}
        >
          Generate plan
        </button>
        {props.onClose ? (
          <button type="button" onClick={props.onClose}>
            Cancel
          </button>
        ) : null}
      </div>

      {draft ? (
        <div style={{ marginTop: 20, borderTop: "1px solid #ECEEF3", paddingTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>{draft.name}</h3>
          <p style={{ fontSize: 13, color: "#6B7280" }}>{draft.description}</p>
          <h4>Tables</h4>
          <ul>
            {draft.tables.map((t) => (
              <li key={t.key}>
                <strong>{t.name}</strong>{" "}
                <span style={{ fontSize: 12, color: "#6B7280" }}>
                  {t.columns.map((c) => c.type).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          {(draft.automations || []).length ? (
            <>
              <h4>Automations</h4>
              <ul>
                {draft.automations!.map((a, i) => (
                  <li key={i}>{a.sentence}</li>
                ))}
              </ul>
            </>
          ) : null}
          <button
            type="button"
            disabled={busy}
            style={{ background: "#2547C4", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px" }}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const res = await provisionTemplateLocal(draft, {
                    workspaceId: props.workspaceId,
                    userId: props.userId,
                    withSampleData: false,
                  });
                  props.onBuilt?.(res.tableIds);
                  setNextActions([
                    "Import your properties from Excel",
                    "Turn on the monthly rent routine",
                    "Share the maintenance form",
                  ]);
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Building…" : "Build"}
          </button>
          {nextActions.length ? (
            <div style={{ marginTop: 16 }}>
              <h4>Next</h4>
              <ol>
                {nextActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
