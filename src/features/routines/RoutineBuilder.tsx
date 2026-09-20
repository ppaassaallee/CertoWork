import { useEffect, useState } from "react";
import { DButton, DSheet } from "../../desktop/ui";
import "../../desktop/ui/desktop-ui.css";

export type BuilderNodeType =
  | "trigger"
  | "odysseus"
  | "condition"
  | "notify"
  | "create-item"
  | "create-signal"
  | "send-email"
  | "http"
  | "output";

export type BuilderNode = {
  id: string;
  type: BuilderNodeType;
  label: string;
  config?: Record<string, unknown>;
  comingSoon?: boolean;
};

const PICKER: Array<{ type: BuilderNodeType; label: string; category: string; comingSoon?: boolean }> = [
  { type: "odysseus", label: "Odysseus prompt", category: "Odysseus" },
  { type: "condition", label: "Condition", category: "Data", comingSoon: true },
  { type: "notify", label: "Notify", category: "Notify", comingSoon: true },
  { type: "create-item", label: "Create item", category: "Data", comingSoon: true },
  { type: "create-signal", label: "Create signal", category: "Notify", comingSoon: true },
  { type: "send-email", label: "Send email", category: "Integrations", comingSoon: true },
  { type: "http", label: "HTTP", category: "Integrations", comingSoon: true },
];

export function RoutineBuilder({
  routineId,
  initialPrompt = "",
  onSave,
}: {
  routineId: string;
  initialPrompt?: string;
  onSave?: (nodes: BuilderNode[], prompt: string) => void;
}) {
  const [nodes, setNodes] = useState<BuilderNode[]>([
    { id: "t1", type: "trigger", label: "Trigger · Schedule 07:00" },
    { id: "s1", type: "odysseus", label: "Odysseus prompt", config: { prompt: initialPrompt } },
    { id: "o1", type: "output", label: "Output" },
  ]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertAt, setInsertAt] = useState(1);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dryRun, setDryRun] = useState<string[]>([]);

  const prompt = String(nodes.find((n) => n.type === "odysseus")?.config?.prompt || "");

  useEffect(() => {
    const t = window.setTimeout(() => {
      onSave?.(nodes, prompt);
      setSavedAt(new Date());
    }, 800);
    return () => window.clearTimeout(t);
  }, [nodes, prompt, onSave]);

  return (
    <div className="d-root" data-testid="routine-builder" style={{ padding: 24, maxWidth: 720 }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Routine builder</h1>
          <p style={{ margin: "4px 0 0", color: "var(--c-ink-2)", fontSize: 13 }}>
            {routineId} · Autosave
            {savedAt ? ` · ${Math.round((Date.now() - savedAt.getTime()) / 1000)}s ago` : ""}
          </p>
        </div>
        <DButton
          onClick={() => {
            setDryRun(
              nodes.map((n) =>
                n.comingSoon
                  ? `${n.label}: Coming soon`
                  : n.type === "odysseus"
                    ? `Prompt length ${prompt.length}`
                    : `${n.label}: ok`,
              ),
            );
          }}
        >
          Run
        </DButton>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {nodes.map((n, i) => (
          <div key={n.id}>
            <div
              style={{
                border: "1px solid var(--c-line)",
                borderRadius: 14,
                padding: 14,
                background: "#fff",
              }}
            >
              <strong>{n.label}</strong>
              {n.comingSoon ? (
                <span style={{ marginLeft: 8, color: "var(--c-ink-3)", fontSize: 12 }}>Coming soon</span>
              ) : null}
              {n.type === "odysseus" ? (
                <textarea
                  aria-label="Odysseus prompt"
                  onChange={(e) =>
                    setNodes((list) =>
                      list.map((x) =>
                        x.id === n.id ? { ...x, config: { ...x.config, prompt: e.target.value } } : x,
                      ),
                    )
                  }
                  rows={4}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    borderRadius: 10,
                    border: "1px solid var(--c-line)",
                    padding: 10,
                  }}
                  value={prompt}
                />
              ) : null}
              {dryRun[i] ? (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--c-ink-2)" }}>{dryRun[i]}</p>
              ) : null}
            </div>
            {i < nodes.length - 1 ? (
              <div style={{ textAlign: "center", margin: "6px 0" }}>
                <button
                  aria-label="Insert step"
                  onClick={() => {
                    setInsertAt(i + 1);
                    setPickerOpen(true);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 99,
                    border: "1px solid var(--c-line)",
                    background: "#fff",
                    color: "var(--c-blue)",
                    fontWeight: 700,
                  }}
                  type="button"
                >
                  +
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <DSheet onClose={() => setPickerOpen(false)} open={pickerOpen} title="Add step">
        {PICKER.map((p) => (
          <button
            key={p.type}
            onClick={() => {
              setNodes((list) => {
                const next = [...list];
                next.splice(insertAt, 0, {
                  id: `n-${Date.now()}`,
                  type: p.type,
                  label: p.label,
                  comingSoon: p.comingSoon,
                });
                return next;
              });
              setPickerOpen(false);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 8px",
              border: 0,
              borderBottom: "1px solid var(--c-line)",
              background: "transparent",
            }}
            type="button"
          >
            <strong>{p.label}</strong>
            <span style={{ color: "var(--c-ink-3)", marginLeft: 8 }}>{p.category}</span>
            {p.comingSoon ? " · Coming soon" : ""}
          </button>
        ))}
      </DSheet>
    </div>
  );
}
