import { useEffect, useState } from "react";
import type { FlowNode } from "./flowModel";
import "./flow.css";

export function NodePanel({
  node,
  readOnly = false,
  onChange,
}: {
  node: FlowNode | null;
  readOnly?: boolean;
  onChange?: (patch: Partial<FlowNode> & { meta?: Record<string, unknown> }) => void;
}) {
  const [question, setQuestion] = useState("");
  const [hint, setHint] = useState("");
  const [skippable, setSkippable] = useState(false);
  const [includeInSummary, setIncludeInSummary] = useState(true);

  useEffect(() => {
    if (!node) return;
    setQuestion(String(node.meta?.question || node.title));
    setHint(String(node.meta?.hint || node.detail || ""));
    setSkippable(Boolean(node.meta?.skippable));
    setIncludeInSummary(!Boolean(node.meta?.skipInSummary));
  }, [node?.id]);

  if (!node) {
    return (
      <aside className="cw-flow-panel" data-testid="flow-node-panel">
        <p className="cw-flow-panel-kicker">Nodo</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Elegí un paso del flujo para verlo o editarlo.
        </p>
      </aside>
    );
  }

  const kicker =
    node.type === "step" && node.sourceStepId
      ? `Paso · ${String(node.meta?.label || node.sourceStepId)}`
      : node.type;

  return (
    <aside className="cw-flow-panel" data-testid="flow-node-panel">
      <div className="cw-flow-panel-kicker">{kicker}</div>
      {node.editable.includes("question") || node.type === "step" ? (
        <>
          <div className="cw-flow-field">Pregunta</div>
          <input
            className="cw-flow-input"
            disabled={readOnly}
            onBlur={() =>
              onChange?.({
                title: question,
                meta: { ...(node.meta || {}), question },
              })
            }
            onChange={(event) => setQuestion(event.target.value)}
            value={question}
          />
          <div className="cw-flow-field">Qué hace Odysseus / detalle</div>
          <textarea
            className="cw-flow-textarea"
            disabled={readOnly}
            onBlur={() =>
              onChange?.({
                detail: hint,
                meta: { ...(node.meta || {}), hint },
              })
            }
            onChange={(event) => setHint(event.target.value)}
            value={hint}
          />
          <div className="cw-flow-field">Opciones</div>
          <label className="cw-flow-toggle">
            <input
              checked={skippable}
              disabled={readOnly}
              onChange={(event) => {
                const next = event.target.checked;
                setSkippable(next);
                onChange?.({ meta: { ...(node.meta || {}), skippable: next } });
              }}
              type="checkbox"
            />
            Se puede omitir
          </label>
          <label className="cw-flow-toggle">
            <input
              checked={includeInSummary}
              disabled={readOnly}
              onChange={(event) => {
                const next = event.target.checked;
                setIncludeInSummary(next);
                onChange?.({
                  meta: { ...(node.meta || {}), skipInSummary: !next },
                });
              }}
              type="checkbox"
            />
            Incluir en versión resumida
          </label>
        </>
      ) : (
        <>
          <div className="cw-flow-field">Título</div>
          <div className="cw-flow-input">{node.title}</div>
          <div className="cw-flow-field">Detalle</div>
          <div style={{ fontSize: 11, color: "var(--text-primary)" }}>{node.detail}</div>
        </>
      )}
      {node.badge ? (
        <>
          <div className="cw-flow-field">Badge</div>
          <span className={`cw-flow-badge is-${node.badge.tone}`}>{node.badge.text}</span>
        </>
      ) : null}
    </aside>
  );
}
