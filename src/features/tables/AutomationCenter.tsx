import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X, Zap } from "../../components/ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import {
  activateRoutine,
  listRoutinesForScope,
  pauseRoutine,
  type RoutineSpec,
} from "../../lib/routines";
import type { StructuredRoutine } from "../../lib/routines/structured";
import { sentenceFromStructured } from "../../lib/routines/structured";
import {
  executeStructuredRoutine,
  saveStructuredRoutine,
} from "../../lib/routines/structuredExecutor";
import type { RecordDoc, TableDoc } from "../../lib/tables";
import { TABLE_AUTOMATION_RECIPES, type TableRecipe } from "./automationRecipes";

export type AutomationCenterProps = {
  open: boolean;
  table: TableDoc;
  selectedRecord?: RecordDoc | null;
  onClose(): void;
};

type Tab = "create" | "manage" | "history" | "recipes";

export function AutomationCenter({ open, table, selectedRecord, onClose }: AutomationCenterProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("create");
  const [routines, setRoutines] = useState<RoutineSpec[]>([]);
  const [describe, setDescribe] = useState("");
  const [triggerCol, setTriggerCol] = useState(table.keyColumns.status || table.columns[0]?.id || "");
  const [triggerTo, setTriggerTo] = useState("");
  const [actionType, setActionType] = useState<"set" | "notify" | "createRecord">("set");
  const [setCol, setSetCol] = useState("");
  const [busy, setBusy] = useState(false);
  const [testLog, setTestLog] = useState<string | null>(null);

  const reload = async () => {
    const next = await listRoutinesForScope(table.workspaceId, {
      entityType: "table",
      entityId: table.id,
    });
    setRoutines(next);
  };

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, table.id, table.workspaceId]);

  const colLabel = (id: string) => table.columns.find((c) => c.id === id)?.name || id;

  const structuredPreview: StructuredRoutine = useMemo(() => {
    const titleName = colLabel(table.keyColumns.title);
    const actions: StructuredRoutine["actions"] =
      actionType === "set"
        ? [
            {
              type: "set",
              columnId: setCol || table.keyColumns.date || table.columns[0]?.id || "",
              value: { fn: "today" },
            },
          ]
        : actionType === "notify"
          ? [{ type: "notify", to: [{ role: "editors" }], message: { template: "Update on {title}" } }]
          : [
              {
                type: "createRecord",
                tableId: table.id,
                values: {
                  [table.keyColumns.title]: { template: `Follow-up · {${titleName}}` },
                },
              },
            ];
    const actionLabel =
      actionType === "set"
        ? `set ${colLabel(setCol || table.keyColumns.date || "")} to today`
        : actionType === "notify"
          ? "notify"
          : "create a record";
    const sentence = `When ${colLabel(triggerCol)} changes${triggerTo ? ` to ${triggerTo}` : ""}, then ${actionLabel}`;
    return {
      kind: "structured",
      scope: { type: "table", tableId: table.id },
      trigger: {
        type: "record.changed",
        tableId: table.id,
        columnId: triggerCol,
        to: triggerTo || undefined,
      },
      conditions: [],
      actions,
      sentence: describe.trim() || sentence,
      enabled: true,
      owner: user?.uid || "",
      severity: "minor" as const,
    };
  }, [actionType, describe, setCol, table, triggerCol, triggerTo, user?.uid]);

  if (!open) return null;

  const applyRecipe = (recipe: TableRecipe) => {
    setTab("create");
    setTriggerCol(table.keyColumns.status || table.columns[0]?.id || "");
    setTriggerTo(recipe.defaultTo || "");
    setActionType(recipe.actionType);
    setSetCol(table.keyColumns.date || table.columns.find((c) => c.type === "date")?.id || "");
    setDescribe(recipe.sentence);
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const structured = {
        ...structuredPreview,
        sentence: sentenceFromStructured(structuredPreview, colLabel),
      };
      await saveStructuredRoutine({
        workspaceId: table.workspaceId,
        ownerUserId: user.uid,
        tableId: table.id,
        tableName: table.name,
        structured,
        activate: true,
      });
      await reload();
      setTab("manage");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!selectedRecord) {
      setTestLog("Select a record to dry-run");
      return;
    }
    const result = await executeStructuredRoutine({
      routine: { ...structuredPreview, id: "preview" },
      event: {
        tableId: table.id,
        recordId: selectedRecord.id,
        type: "record.changed",
        columnId: triggerCol,
        to: triggerTo || selectedRecord.values[triggerCol],
      },
      table,
      record: selectedRecord,
      userId: user?.uid || "",
      dryRun: true,
    });
    setTestLog(result.actions.map((a) => `${a.type}: ${a.detail || (a.ok ? "ok" : "fail")}`).join("\n"));
  };

  return (
    <aside
      className="cw-automation-center"
      data-testid="automation-center"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 420,
        maxWidth: "100vw",
        height: "100vh",
        background: "#fff",
        borderLeft: "1px solid #ECEEF3",
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-8px 0 24px rgba(31,36,48,.08)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, borderBottom: "1px solid #ECEEF3" }}>
        <Zap size={16} color="#2547C4" />
        <strong style={{ flex: 1 }}>Automations</strong>
        <button type="button" className="cw-tables-icon-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>
      <nav style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid #ECEEF3", flexWrap: "wrap" }}>
        {(
          [
            ["create", "Create"],
            ["manage", `Manage (${routines.length})`],
            ["history", "Run history"],
            ["recipes", "Recipes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              border: "none",
              background: tab === id ? "rgba(37,71,196,.1)" : "transparent",
              color: tab === id ? "#2547C4" : "#6B7280",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {tab === "create" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ fontSize: 12 }}>
              Describe it
              <textarea
                value={describe}
                onChange={(e) => setDescribe(e.target.value)}
                placeholder="when a lease ends in 60 days, create a renewal task and notify the manager"
                rows={3}
                style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid #ECEEF3", borderRadius: 8 }}
              />
            </label>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Sentence builder</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 13 }}>
              <span>When</span>
              <select value={triggerCol} onChange={(e) => setTriggerCol(e.target.value)}>
                {table.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span>changes to</span>
              <input
                value={triggerTo}
                onChange={(e) => setTriggerTo(e.target.value)}
                placeholder="value"
                style={{ width: 100, padding: 4 }}
              />
              <span>, then</span>
              <select value={actionType} onChange={(e) => setActionType(e.target.value as typeof actionType)}>
                <option value="set">set field</option>
                <option value="notify">notify</option>
                <option value="createRecord">create record</option>
              </select>
              {actionType === "set" ? (
                <select value={setCol} onChange={(e) => setSetCol(e.target.value)}>
                  {table.columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1F2430" }}>{structuredPreview.sentence}</p>
            {testLog ? (
              <pre style={{ fontSize: 11, background: "#F7F8FA", padding: 8, borderRadius: 8, whiteSpace: "pre-wrap" }}>
                {testLog}
              </pre>
            ) : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => void test()}
                style={{ border: "1px solid #ECEEF3", borderRadius: 8, padding: "8px 12px", background: "#fff" }}
              >
                Test
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                style={{
                  background: "#2547C4",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {busy ? <Loader2 size={14} /> : <Plus size={14} />} Save
              </button>
            </div>
          </div>
        ) : null}
        {tab === "manage" ? (
          <div style={{ display: "grid", gap: 10 }}>
            {routines.map((r) => (
              <article key={r.id} style={{ border: "1px solid #ECEEF3", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{r.sentence}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>
                  {r.status} · {r.structured ? "structured" : "NL"}
                </div>
                <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={r.status === "active"}
                    onChange={(e) => {
                      void (async () => {
                        if (e.target.checked) await activateRoutine(r);
                        else await pauseRoutine(r.id);
                        await reload();
                      })();
                    }}
                  />
                  Enabled
                </label>
              </article>
            ))}
            {!routines.length ? <p style={{ color: "#6B7280", fontSize: 13 }}>No automations yet</p> : null}
          </div>
        ) : null}
        {tab === "history" ? (
          <p style={{ fontSize: 13, color: "#6B7280" }}>
            Run history comes from the routines engine run log (per-action results).
          </p>
        ) : null}
        {tab === "recipes" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {TABLE_AUTOMATION_RECIPES.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => applyRecipe(recipe)}
                style={{
                  textAlign: "left",
                  border: "1px solid #ECEEF3",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{recipe.sentence}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>
                  {recipe.category} · Uses: {recipe.uses}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
