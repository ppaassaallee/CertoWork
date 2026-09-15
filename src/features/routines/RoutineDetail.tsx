import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "../../components/ui/Icon";
import {
  activateRoutine,
  buildDryRunPreview,
  getManifest,
  listRoutineRuns,
  pauseRoutine,
  recordManualRoutineRun,
  relativeNextRunLabel,
  saveRoutinePlan,
  saveRoutineStepOverrides,
  type RoutineSpec,
} from "../../lib/routines";
import {
  FlowView,
  resolveRoutineFlow,
  type FlowNode,
  type FlowRunOverlay,
} from "./flow";
import "./flow/flow.css";

function scopeLabel(routine: RoutineSpec) {
  if (routine.scope?.entityType === "portfolio") return "Mi trabajo";
  return routine.scope?.entityTitle || routine.scope?.entityType || "—";
}

function whenLabel(routine: RoutineSpec) {
  return String((routine.trigger as { human?: string })?.human || "—");
}

function overlaysFromRun(run: any): FlowRunOverlay[] {
  const steps = Array.isArray(run?.steps) ? run.steps : [];
  return steps
    .map((step: any) => {
      const nodeId = String(step.nodeId || "");
      if (!nodeId || nodeId === "unplanned") return null;
      const status = String(run.status || step.status || "completed");
      const outcome =
        status === "failed" || status === "rejected"
          ? "failed"
          : status === "awaiting_approval"
            ? "approval"
            : "done";
      return {
        nodeId,
        outcome: outcome as FlowRunOverlay["outcome"],
        note: String(step.label || ""),
      };
    })
    .filter(Boolean) as FlowRunOverlay[];
}

export function RoutineDetail({
  routine,
  onChanged,
}: {
  routine: RoutineSpec;
  onChanged?: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"flow" | "runs" | "settings">("flow");
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [local, setLocal] = useState(routine);

  useEffect(() => {
    setLocal(routine);
  }, [routine.id, routine.updatedAt, routine.status, routine.plan, routine.stepOverrides]);

  const manifest = useMemo(
    () => (local.recipeId ? getManifest(local.recipeId) : null),
    [local.recipeId],
  );

  const model = useMemo(() => {
    const built = resolveRoutineFlow(local, manifest);
    if (!local.stepOverrides) return built;
    return {
      ...built,
      nodes: built.nodes.map((node) => {
        const override = node.sourceStepId
          ? local.stepOverrides?.[node.sourceStepId]
          : undefined;
        if (!override) return node;
        const question = override.question;
        return {
          ...node,
          title: question
            ? node.title.includes("·")
              ? `${node.title.split("·")[0]}· ${question}`
              : question
            : node.title,
          detail: override.hint || node.detail,
          meta: {
            ...(node.meta || {}),
            question: override.question ?? node.meta?.question,
            hint: override.hint ?? node.meta?.hint,
            skippable: override.skippable ?? node.meta?.skippable,
            skipInSummary: override.skipInSummary ?? node.meta?.skipInSummary,
          },
        };
      }),
    };
  }, [local, manifest]);

  useEffect(() => {
    void listRoutineRuns(local.id)
      .then((rows) => {
        setRuns(rows);
        if (!selectedRunId && rows[0]?.id) setSelectedRunId(rows[0].id);
      })
      .catch(() => setRuns([]));
  }, [local.id, local.lastRunAt]);

  useEffect(() => {
    if (local.class === "guided") return;
    if (Array.isArray(local.plan) && local.plan.length > 0) return;
    const plan = model.nodes;
    void saveRoutinePlan(local.id, plan as RoutineSpec["plan"])
      .then(() => {
        setLocal((current) => ({ ...current, plan: plan as RoutineSpec["plan"] }));
        onChanged?.();
      })
      .catch(() => undefined);
  }, [local.id, local.class, local.plan, model.nodes]);

  const selectedRun = runs.find((run) => run.id === selectedRunId) || null;
  const overlays =
    tab === "runs" && selectedRun ? overlaysFromRun(selectedRun) : [];

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (local.status === "active") await pauseRoutine(local.id);
      else await activateRoutine(local);
      onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude actualizar.");
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    setError("");
    try {
      const preview = buildDryRunPreview({
        goal: local.goal,
        scopeTitle: scopeLabel(local),
        entityType: local.scope.entityType,
        language: local.deliverable?.language || "es",
      });
      await recordManualRoutineRun({
        routine: local,
        workspaceId: local.workspaceId,
        userId: local.ownerUserId,
        outputText: preview.text,
        steps: preview.steps,
      });
      setTab("runs");
      onChanged?.();
      const next = await listRoutineRuns(local.id);
      setRuns(next);
      if (next[0]?.id) setSelectedRunId(next[0].id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pude probar la rutina.");
    } finally {
      setBusy(false);
    }
  };

  const onNodeChange = async (
    nodeId: string,
    patch: Partial<FlowNode> & { meta?: Record<string, unknown> },
  ) => {
    const node = model.nodes.find((row) => row.id === nodeId);
    if (!node?.sourceStepId) {
      if (local.class !== "guided") {
        const nextNodes = model.nodes.map((row) =>
          row.id === nodeId
            ? {
                ...row,
                ...patch,
                meta: { ...(row.meta || {}), ...(patch.meta || {}) },
              }
            : row,
        );
        await saveRoutinePlan(local.id, nextNodes as RoutineSpec["plan"]);
        setLocal((current) => ({
          ...current,
          plan: nextNodes as RoutineSpec["plan"],
        }));
        onChanged?.();
      }
      return;
    }
    const nextOverrides = {
      ...(local.stepOverrides || {}),
      [node.sourceStepId]: {
        ...(local.stepOverrides?.[node.sourceStepId] || {}),
        question: String(patch.meta?.question ?? node.meta?.question ?? ""),
        hint: String(patch.meta?.hint ?? node.meta?.hint ?? ""),
        skippable: Boolean(patch.meta?.skippable ?? node.meta?.skippable),
        skipInSummary: Boolean(patch.meta?.skipInSummary ?? node.meta?.skipInSummary),
      },
    };
    await saveRoutineStepOverrides(local.id, nextOverrides);
    setLocal((current) => ({ ...current, stepOverrides: nextOverrides }));
    onChanged?.();
  };

  const insertStep = async (afterNodeId: string, menuId: string) => {
    const index = model.nodes.findIndex((node) => node.id === afterNodeId);
    if (index < 0) return;
    const id = `extra:${menuId}:${Date.now()}`;
    let node: FlowNode;
    if (menuId === "deliver_whatsapp") {
      node = {
        id,
        type: "deliver",
        title: "También por WhatsApp",
        detail: "Canal adicional",
        badge: { text: "entrega", tone: "neutral" },
        editable: ["channel", "recipients"],
      };
    } else if (menuId === "deliver_email") {
      node = {
        id,
        type: "deliver",
        title: "También por correo",
        detail: "Canal adicional",
        badge: { text: "entrega", tone: "neutral" },
        editable: ["channel", "recipients"],
      };
    } else if (menuId === "ask_approval") {
      node = {
        id,
        type: "decision",
        title: "¿Pedir aprobación?",
        detail: "Espera aprobación antes de continuar",
        branches: { yes: "Continúa", no: "Pausa" },
        editable: [],
      };
    } else if (menuId === "wait_until") {
      node = {
        id,
        type: "action",
        title: "Esperar hasta…",
        detail: "Pausa temporal",
        editable: ["schedule"],
      };
    } else if (menuId === "add_reflection") {
      node = {
        id,
        type: "step",
        title: "Reflexión",
        detail: "Pregunta corta al usuario",
        editable: ["question", "hint", "skippable"],
        meta: { question: "¿Qué notás?", hint: "" },
      };
    } else {
      node = {
        id,
        type: "prepare",
        title: "Chequeo de Odysseus",
        detail: "Relee el alcance antes de continuar",
        badge: { text: "solo lectura", tone: "neutral" },
        editable: [],
      };
    }
    const nextNodes = [
      ...model.nodes.slice(0, index + 1),
      node,
      ...model.nodes.slice(index + 1),
    ];
    await saveRoutinePlan(local.id, nextNodes as RoutineSpec["plan"]);
    setLocal((current) => ({ ...current, plan: nextNodes as RoutineSpec["plan"] }));
    onChanged?.();
  };

  return (
    <div className="cw-routine-detail" data-testid="routine-detail">
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
        <button
          onClick={() => navigate("/rutinas")}
          style={{
            border: 0,
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 0,
            font: "inherit",
          }}
          type="button"
        >
          Rutinas
        </button>
        {" › "}Mis rutinas
      </div>
      <div className="cw-routine-detail-head">
        <Sparkles size={16} />
        <strong style={{ fontSize: 16, fontWeight: 500 }}>{local.title}</strong>
        <span className="cw-routine-chip">
          {local.class === "guided" ? "Guiada" : "Automática"}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {scopeLabel(local)} · {whenLabel(local)}
          {manifest?.estimatedMinutes ? ` · ~${manifest.estimatedMinutes} min` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          Próxima: {relativeNextRunLabel(local.nextRunAt)}
        </span>
        <button
          disabled={busy}
          onClick={() => void toggle()}
          style={{
            fontSize: 11,
            border: "0.5px solid var(--border-strong)",
            borderRadius: 14,
            padding: "4px 10px",
            background: "transparent",
            cursor: "pointer",
          }}
          type="button"
        >
          {local.status === "active" ? "Activa" : "Pausada"}
        </button>
        <button
          disabled={busy}
          onClick={() => void runNow()}
          style={{
            fontSize: 11,
            border: "0.5px solid var(--border-strong)",
            borderRadius: 14,
            padding: "4px 10px",
            background: "transparent",
            cursor: "pointer",
          }}
          type="button"
        >
          {busy ? <Loader2 className="do-spin" size={12} /> : null} Probar ahora
        </button>
      </div>
      <div className="cw-routine-detail-tabs" role="tablist">
        {(
          [
            ["flow", "Flujo"],
            ["runs", `Corridas${runs.length ? ` ${runs.length}` : ""}`],
            ["settings", "Ajustes"],
          ] as const
        ).map(([id, label]) => (
          <button
            className={tab === id ? "is-active" : ""}
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="do-routine-error">{error}</p> : null}
      {tab === "flow" || tab === "runs" ? (
        <div>
          {tab === "runs" ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {runs.length === 0 ? (
                <span className="do-routine-muted">Sin corridas todavía.</span>
              ) : (
                runs.slice(0, 12).map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    style={{
                      fontSize: 11,
                      border:
                        selectedRunId === run.id
                          ? "1px solid var(--text-primary)"
                          : "0.5px solid var(--border)",
                      borderRadius: 10,
                      padding: "4px 8px",
                      background: "var(--surface-2)",
                      cursor: "pointer",
                    }}
                    type="button"
                  >
                    {String(run.startedAt || "").slice(0, 16).replace("T", " ")} ·{" "}
                    {run.status}
                  </button>
                ))
              )}
            </div>
          ) : null}
          <FlowView
            model={model}
            onInsertStep={(after, menuId) => void insertStep(after, menuId)}
            onNodeChange={(id, patch) => void onNodeChange(id, patch)}
            overlays={overlays}
            readOnly={tab === "runs"}
          />
        </div>
      ) : (
        <div className="do-routine-card" data-testid="routine-settings-card">
          <div className="do-routine-card-row">
            <span>Cuándo</span>
            <b>{whenLabel(local)}</b>
          </div>
          <div className="do-routine-card-row">
            <span>Qué</span>
            <b>{local.goal || local.sentence}</b>
          </div>
          <div className="do-routine-card-row">
            <span>Entrega</span>
            <b>{local.deliverable?.channel}</b>
          </div>
          <div className="do-routine-card-row">
            <span>Permisos</span>
            <b>
              ítems {local.permissions?.editItems || "ask"} · otros{" "}
              {local.permissions?.writeOthers || "ask"}
            </b>
          </div>
        </div>
      )}
    </div>
  );
}
