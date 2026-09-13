import { useMemo, useState } from "react";
import { Check, Sparkles, X } from "../../components/ui/Icon";
import type { RoutineSpec } from "../../lib/routines";
import {
  buildAgentsMapModel,
  filterMapModel,
  type MapNode,
} from "./buildAgentsMapModel";
import { healthLabel, type RunLike } from "./mapHealth";
import type { AgentActivityItem } from "../../lib/agentActivity";
import "./agentsMap.css";

type FilterId = "all" | "failing" | "slow" | "costly" | "loops" | "awaiting";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "failing", label: "Fallando" },
  { id: "slow", label: "Lentas" },
  { id: "costly", label: "Costosas" },
  { id: "loops", label: "Bucles" },
  { id: "awaiting", label: "Esperando aprobación" },
];

const COL_X = { trigger: 8, routine: 122, agent: 250, output: 370 } as const;
const COL_W = { trigger: 88, routine: 104, agent: 96, output: 64 } as const;

function healthFill(health: string) {
  if (health === "sana") return "var(--status-success-soft)";
  if (health === "degradada") return "var(--status-warning-soft)";
  return "var(--status-danger-soft)";
}

function healthStroke(health: string) {
  if (health === "sana") return "var(--status-success)";
  if (health === "degradada") return "var(--status-warning)";
  return "var(--status-danger)";
}

function layoutColumn(nodes: MapNode[], kind: MapNode["kind"]) {
  const list = nodes.filter((node) => node.kind === kind);
  const startY = 28;
  const gap = kind === "agent" ? 52 : 50;
  return list.map((node, index) => ({
    node,
    x: COL_X[kind],
    y: startY + index * gap,
    w: COL_W[kind],
    h: kind === "routine" ? 36 : kind === "agent" ? 46 : 28,
  }));
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

export function AgentsMapView({
  routines,
  runsByRoutineId,
  activityItems = [],
  pendingApprovals = 0,
  workspaceName,
  onOpenRoutine,
  onOpenApprovals,
  onAllowWriteOthers,
}: {
  routines: RoutineSpec[];
  runsByRoutineId: Record<string, RunLike[]>;
  activityItems?: AgentActivityItem[];
  pendingApprovals?: number;
  workspaceName?: string;
  onOpenRoutine: (routine: RoutineSpec) => void;
  onOpenApprovals?: () => void;
  onAllowWriteOthers?: (routine: RoutineSpec) => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [windowHours] = useState(24);

  const model = useMemo(
    () =>
      filterMapModel(
        buildAgentsMapModel({
          routines,
          runsByRoutineId,
          activityItems,
          pendingApprovals,
          workspaceName,
          windowHours,
        }),
        filter,
      ),
    [routines, runsByRoutineId, activityItems, pendingApprovals, workspaceName, windowHours, filter],
  );

  const laid = useMemo(() => {
    const triggers = layoutColumn(model.nodes, "trigger");
    const routineNodes = layoutColumn(model.nodes, "routine");
    const agents = layoutColumn(model.nodes, "agent");
    const outputs = layoutColumn(model.nodes, "output");
    const all = [...triggers, ...routineNodes, ...agents, ...outputs];
    const byId = Object.fromEntries(all.map((entry) => [entry.node.id, entry]));
    return { all, byId, height: Math.max(236, all.reduce((max, entry) => Math.max(max, entry.y + entry.h), 0) + 40) };
  }, [model.nodes]);

  const selected = selectedId ? model.byId[selectedId] : null;
  const selectedRoutine =
    selected?.kind === "routine"
      ? (selected.meta.routine as RoutineSpec | undefined)
      : null;

  const permissionMissing =
    Boolean(selected?.meta.permissionMissing) ||
    (selectedRoutine?.permissions?.writeOthers === "ask" &&
      selectedRoutine?.deliverable?.channel === "whatsapp");

  return (
    <div className="cw-agents-map" data-testid="agents-map">
      <div className="cw-agents-map-filters" role="toolbar" aria-label="Filtros del mapa">
        {FILTERS.map((item) => (
          <button
            className={filter === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => setFilter(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="cw-agents-map-grid">
        <div className="cw-agents-map-main">
          <div className="cw-agents-map-canvas">
            <div className="cw-agents-map-canvas-head">
              <strong>{model.workspaceLabel} · producción</strong>
              <span>tamaño = corridas · grosor = handoffs</span>
            </div>
            {model.nodes.filter((node) => node.kind === "routine").length === 0 ? (
              <p className="cw-agents-map-empty">
                Todavía no hay corridas que observar. Activá una rutina y el mapa se
                llena solo.
              </p>
            ) : (
              <svg
                aria-label="Grafo de disparadores, rutinas, agentes y salidas"
                role="img"
                viewBox={`0 0 440 ${laid.height}`}
                width="100%"
              >
                <g fill="var(--text-muted)" fontSize="8">
                  <text x="8" y="12">
                    DISPARADORES
                  </text>
                  <text x="120" y="12">
                    RUTINAS
                  </text>
                  <text x="248" y="12">
                    AGENTES
                  </text>
                  <text x="356" y="12">
                    SALIDAS
                  </text>
                </g>
                <g fill="none" strokeLinecap="round">
                  {model.edges.map((edge) => {
                    const from = laid.byId[edge.from];
                    const to = laid.byId[edge.to];
                    if (!from || !to) return null;
                    const x1 = from.x + from.w;
                    const y1 = from.y + from.h / 2;
                    const x2 = to.x;
                    const y2 = to.y + to.h / 2;
                    const stroke =
                      edge.tone === "danger"
                        ? "var(--status-danger)"
                        : edge.tone === "warn"
                          ? "var(--status-warning)"
                          : "var(--border-strong)";
                    return (
                      <path
                        d={curve(x1, y1, x2, y2)}
                        key={edge.id}
                        stroke={stroke}
                        strokeWidth={Math.min(3.2, 1 + edge.weight * 0.25)}
                      />
                    );
                  })}
                </g>
                {laid.all.map(({ node, x, y, w, h }) => {
                  const selectedNode = selectedId === node.id;
                  return (
                    <g
                      key={node.id}
                      onClick={() => setSelectedId(node.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        fill={
                          node.kind === "trigger"
                            ? "var(--surface-0)"
                            : healthFill(node.health)
                        }
                        height={h}
                        rx={8}
                        stroke={
                          selectedNode
                            ? "var(--text-primary)"
                            : node.kind === "trigger"
                              ? "var(--border)"
                              : healthStroke(node.health)
                        }
                        strokeDasharray={
                          node.health === "degradada" || node.meta.permissionMissing
                            ? "3 2"
                            : undefined
                        }
                        strokeWidth={selectedNode ? 1.5 : 1}
                        width={w}
                        x={x}
                        y={y}
                      />
                      <text
                        fill="var(--text-primary)"
                        fontSize={node.kind === "agent" ? 10 : 9}
                        fontWeight={500}
                        x={x + 8}
                        y={y + (node.kind === "agent" ? 16 : 13)}
                      >
                        {node.label.slice(0, 18)}
                      </text>
                      <text
                        fill="var(--text-secondary)"
                        fontSize={7.5}
                        x={x + 8}
                        y={y + (node.kind === "agent" ? 28 : 24)}
                      >
                        {String(node.sublabel || "").slice(0, 26)}
                      </text>
                      {node.kind === "agent" && node.meta.loop ? (
                        <text fill="var(--status-warning)" fontSize={7.5} x={x + 8} y={y + 40}>
                          ↻ bucle
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                <g fontSize="7.5" fill="var(--text-secondary)">
                  <circle cx="322" cy={laid.height - 10} fill="var(--status-success)" r="3" />
                  <text x="328" y={laid.height - 7}>
                    Sana
                  </text>
                  <circle cx="356" cy={laid.height - 10} fill="var(--status-warning)" r="3" />
                  <text x="362" y={laid.height - 7}>
                    Degradada
                  </text>
                  <circle cx="406" cy={laid.height - 10} fill="var(--status-danger)" r="3" />
                  <text x="412" y={laid.height - 7}>
                    Fallando
                  </text>
                </g>
              </svg>
            )}
          </div>

          <div className="cw-agents-map-handoffs">
            <div className="cw-agents-map-handoffs-head">
              <strong>Handoffs en vivo</strong>
              <span>últimas corridas</span>
            </div>
            {model.handoffs.length === 0 ? (
              <p className="cw-agents-map-empty">Sin handoffs recientes.</p>
            ) : (
              model.handoffs.slice(0, 6).map((item) => (
                <div className="cw-agents-map-handoff" key={item.id}>
                  <b>{item.path}</b>
                  {item.contextKb ? <i>{item.contextKb}</i> : null}
                  {item.durationLabel ? <i>{item.durationLabel}</i> : <i>—</i>}
                  <span
                    className={`cw-agents-map-chip is-${
                      item.status === "Completado"
                        ? "success"
                        : item.status === "Rechazado" || item.status === "Falló"
                          ? "danger"
                          : "warning"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="cw-agents-map-side">
          <p className="cw-agents-map-eyebrow">Nodo seleccionado</p>
          {!selected ? (
            <p className="cw-agents-map-empty">Elegí una rutina, agente o salida.</p>
          ) : (
            <>
              <div className="cw-agents-map-selected-head">
                <span className="cw-agents-map-selected-icon">
                  <Sparkles size={14} />
                </span>
                <div>
                  <strong>{selected.label}</strong>
                  <small>
                    {selected.kind === "routine"
                      ? `Rutina · ${selectedRoutine?.scope?.entityTitle || selectedRoutine?.scope?.entityType || "—"}`
                      : selected.kind}
                  </small>
                </div>
              </div>
              <span
                className={`cw-agents-map-chip is-${
                  selected.health === "sana"
                    ? "success"
                    : selected.health === "degradada"
                      ? "warning"
                      : "danger"
                }`}
              >
                ● {healthLabel(selected.health)}
              </span>

              {selected.kind === "routine" ? (
                <div className="cw-agents-map-kpis">
                  <div>
                    <span>Corridas {windowHours} h</span>
                    <b className="tabular-nums">{Number(selected.meta.runCount || 0)}</b>
                  </div>
                  <div>
                    <span>Éxito</span>
                    <b className="tabular-nums">
                      {selected.meta.successPct != null ? `${selected.meta.successPct}%` : "—"}
                    </b>
                  </div>
                  <div>
                    <span>Duración media</span>
                    <b className="tabular-nums">
                      {selected.meta.durationMs
                        ? `${Math.round(Number(selected.meta.durationMs) / 1000)} s`
                        : "—"}
                    </b>
                  </div>
                  <div>
                    <span>Costo</span>
                    <b className="tabular-nums">
                      ${Number(selected.meta.costUsd || 0).toFixed(2)}
                    </b>
                  </div>
                  <div>
                    <span>Acciones</span>
                    <b className="tabular-nums">
                      {Number(selected.meta.actions || 0)}
                      {Number(selected.meta.pending || 0) > 0 ? (
                        <small> · {Number(selected.meta.pending)} pendientes</small>
                      ) : null}
                    </b>
                  </div>
                  <div>
                    <span>Contexto medio</span>
                    <b className="tabular-nums">—</b>
                  </div>
                </div>
              ) : null}

              {selectedRoutine ? (
                <>
                  <p className="cw-agents-map-eyebrow">Permisos</p>
                  <div className="cw-agents-map-perm">
                    <span>ítem + hijos</span>
                    <Check size={14} color="var(--status-success)" />
                  </div>
                  <div className="cw-agents-map-perm">
                    <span>escribirme a mí</span>
                    <Check size={14} color="var(--status-success)" />
                  </div>
                  <div
                    className={`cw-agents-map-perm${
                      selectedRoutine.permissions?.writeOthers !== "always" ? " is-bad" : ""
                    }`}
                  >
                    <span>escribir a otros</span>
                    {selectedRoutine.permissions?.writeOthers === "always" ? (
                      <Check size={14} color="var(--status-success)" />
                    ) : (
                      <X size={14} />
                    )}
                  </div>
                  <p className="cw-agents-map-eyebrow">Anomalías</p>
                  <div className="cw-agents-map-anomalies">
                    {permissionMissing ? (
                      <span className="cw-agents-map-chip is-danger">Permiso faltante</span>
                    ) : null}
                    {Number(selected.meta.durationMs || 0) >= 40_000 ? (
                      <span className="cw-agents-map-chip is-warning">
                        Lenta · {Math.round(Number(selected.meta.durationMs) / 1000)} s
                      </span>
                    ) : null}
                    {selected.meta.loop ? (
                      <span className="cw-agents-map-chip is-warning">Bucle</span>
                    ) : null}
                    {!permissionMissing &&
                    !selected.meta.loop &&
                    Number(selected.meta.durationMs || 0) < 40_000 ? (
                      <span className="cw-agents-map-chip is-success">Sin anomalías</span>
                    ) : null}
                  </div>
                  <div className="cw-agents-map-actions">
                    <button
                      className="is-primary"
                      onClick={() => onOpenRoutine(selectedRoutine)}
                      type="button"
                    >
                      Abrir rutina
                    </button>
                    {selectedRoutine.permissions?.writeOthers !== "always" && onAllowWriteOthers ? (
                      <button
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void Promise.resolve(onAllowWriteOthers(selectedRoutine)).finally(() =>
                            setBusy(false),
                          );
                        }}
                        type="button"
                      >
                        Permitir
                      </button>
                    ) : null}
                    {Number(selected.meta.pending || 0) > 0 && onOpenApprovals ? (
                      <button onClick={onOpenApprovals} type="button">
                        Approvals
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
