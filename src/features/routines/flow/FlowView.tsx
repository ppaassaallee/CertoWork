import { useEffect, useMemo, useState } from "react";
import { NodePanel } from "./NodePanel";
import {
  ADD_STEP_MENU,
  type FlowModel,
  type FlowNode,
  type FlowRunOverlay,
} from "./flowModel";
import "./flow.css";

function iconFor(type: FlowNode["type"]) {
  switch (type) {
    case "trigger":
      return "⏱";
    case "prepare":
      return "✦";
    case "decision":
      return "⑂";
    case "action":
      return "⚡";
    case "deliver":
      return "▤";
    case "chain":
      return "→";
    default:
      return "·";
  }
}

export function FlowView({
  model,
  readOnly = false,
  overlays = [],
  selectedId: controlledSelected,
  onSelect,
  onNodeChange,
  onInsertStep,
}: {
  model: FlowModel;
  readOnly?: boolean;
  overlays?: FlowRunOverlay[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onNodeChange?: (nodeId: string, patch: Partial<FlowNode> & { meta?: Record<string, unknown> }) => void;
  onInsertStep?: (afterNodeId: string, menuId: string) => void;
}) {
  const [internalSelected, setInternalSelected] = useState<string | null>(
    model.nodes[0]?.id || null,
  );
  const [addAfter, setAddAfter] = useState<string | null>(null);
  const selectedId = controlledSelected !== undefined ? controlledSelected : internalSelected;

  useEffect(() => {
    if (!selectedId && model.nodes[0]) {
      setInternalSelected(model.nodes[0].id);
    }
  }, [model.nodes, selectedId]);

  const overlayById = useMemo(() => {
    const map = new Map<string, FlowRunOverlay>();
    for (const row of overlays) map.set(row.nodeId, row);
    return map;
  }, [overlays]);

  const selected = model.nodes.find((node) => node.id === selectedId) || null;

  const select = (id: string) => {
    setInternalSelected(id);
    onSelect?.(id);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!model.nodes.length) return;
      const index = model.nodes.findIndex((node) => node.id === selectedId);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = model.nodes[Math.min(model.nodes.length - 1, Math.max(0, index) + 1)];
        if (next) select(next.id);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = model.nodes[Math.max(0, index - 1)];
        if (prev) select(prev.id);
      } else if (event.key === "Escape") {
        onSelect?.(null);
        setInternalSelected(null);
        setAddAfter(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [model.nodes, selectedId]);

  return (
    <div className="cw-flow" data-testid="routine-flow-view">
      <div className="cw-flow-rail">
        {model.nodes.map((node, index) => {
          const overlay = overlayById.get(node.id);
          const outcomeClass = overlay ? `is-${overlay.outcome}` : "";
          return (
            <div key={node.id} style={{ width: "100%" }}>
              <button
                className={`cw-flow-node${selectedId === node.id ? " is-selected" : ""}${
                  node.type === "decision" ? " is-decision" : ""
                } ${outcomeClass}`}
                onClick={() => select(node.id)}
                type="button"
              >
                <span
                  className={`cw-flow-node-icon${
                    node.type === "prepare" ? " is-prepare" : ""
                  }`}
                >
                  {iconFor(node.type)}
                </span>
                <div className="cw-flow-node-body">
                  <div className="cw-flow-node-title">{node.title}</div>
                  <div className="cw-flow-node-detail">{node.detail}</div>
                  {overlay?.note ? (
                    <div className="cw-flow-node-note">{overlay.note}</div>
                  ) : null}
                </div>
                {node.badge ? (
                  <span className={`cw-flow-badge is-${node.badge.tone}`}>
                    {node.badge.text}
                  </span>
                ) : null}
              </button>
              {index < model.nodes.length - 1 ? <div className="cw-flow-connector" /> : null}
              {!readOnly && index < model.nodes.length - 1 ? (
                <>
                  <button
                    className="cw-flow-add"
                    onClick={() =>
                      setAddAfter((current) => (current === node.id ? null : node.id))
                    }
                    type="button"
                  >
                    + Agregar paso
                  </button>
                  {addAfter === node.id ? (
                    <div className="cw-flow-add-menu" role="menu">
                      {ADD_STEP_MENU.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            onInsertStep?.(node.id, item.id);
                            setAddAfter(null);
                          }}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="cw-flow-connector" />
                </>
              ) : null}
            </div>
          );
        })}
        {!readOnly ? (
          <button
            className="cw-flow-add"
            onClick={() =>
              setAddAfter(model.nodes[model.nodes.length - 1]?.id || null)
            }
            style={{ marginTop: 8 }}
            type="button"
          >
            + Agregar paso (enviar también por WhatsApp · pedir aprobación · esperar…)
          </button>
        ) : null}
      </div>
      <NodePanel
        node={selected}
        onChange={(patch) => {
          if (!selected || readOnly) return;
          onNodeChange?.(selected.id, patch);
        }}
        readOnly={readOnly}
      />
    </div>
  );
}
