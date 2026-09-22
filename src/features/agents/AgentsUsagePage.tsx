import { useEffect, useMemo, useState } from "react";
import { listAgentDefinitions, listRunsForWorkspace } from "../../lib/agent-platform/agentStore";
import type { AgentDefinition } from "../../lib/agent-platform/types";
import { isAgentsJobsEnabled } from "./agentJobsFlag";
import "./agentBuilder.css";

type Period = "7d" | "30d" | "90d";

function withinPeriod(iso: unknown, period: Period) {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return true;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return Date.now() - t <= days * 86400000;
}

export function AgentsUsagePage({ workspaceId = "" }: { workspaceId?: string }) {
  const enabled = isAgentsJobsEnabled();
  const [period, setPeriod] = useState<Period>("30d");
  const [selectedAgentId, setSelectedAgentId] = useState<string | "all">("all");
  const [agentList, setAgentList] = useState<AgentDefinition[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!workspaceId) {
      setAgentList([]);
      return;
    }
    void listAgentDefinitions(workspaceId).then((rows) => {
      setAgentList(rows);
      setTick((n) => n + 1);
    });
  }, [workspaceId]);

  const runs = useMemo(() => {
    if (!workspaceId) return [];
    return listRunsForWorkspace(workspaceId).filter((run) => withinPeriod(run.createdAt, period));
  }, [workspaceId, period, tick]);

  const filtered = runs.filter(
    (run) => selectedAgentId === "all" || run.agentId === selectedAgentId,
  );

  const completed = filtered.filter((r) => r.status === "completed").length;
  const withResult = filtered.filter((r) => Boolean(r.resultSummary)).length;
  const byTrigger = filtered.reduce<Record<string, number>>((acc, run) => {
    acc[run.triggerType] = (acc[run.triggerType] || 0) + 1;
    return acc;
  }, {});

  if (!enabled) {
    return (
      <div className="ag-builder" data-testid="agents-usage-disabled">
        <p>Usage is hidden while Agents jobs are off.</p>
      </div>
    );
  }

  return (
    <div className="ag-builder" data-testid="agents-usage">
      <div className="ag-builder-hero">
        <div>
          <p className="ag-builder-kicker">Usage</p>
          <h1>Adoption and completion</h1>
          <p>Runs, response rate, and credits from agent_runs.</p>
        </div>
        <div className="ag-segmented" role="group" aria-label="Period">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              className={period === p ? "is-active" : ""}
              key={p}
              onClick={() => setPeriod(p)}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="ag-usage-stats">
        <article className="ag-card">
          <span>Active agents</span>
          <strong className="tabular-nums">
            {agentList.filter((a) => a.status === "published").length}
          </strong>
        </article>
        <article className="ag-card">
          <span>Runs</span>
          <strong className="tabular-nums">{filtered.length}</strong>
        </article>
        <article className="ag-card">
          <span>Response rate</span>
          <strong className="tabular-nums">
            {filtered.length ? Math.round((withResult / filtered.length) * 100) : 0}%
          </strong>
        </article>
        <article className="ag-card">
          <span>Completion rate</span>
          <strong className="tabular-nums">
            {filtered.length ? Math.round((completed / filtered.length) * 100) : 0}%
          </strong>
        </article>
      </div>

      <section className="ag-card">
        <h2>By trigger</h2>
        <ul>
          {Object.keys(byTrigger).length === 0 ? (
            <li className="ag-hint">No runs in this period.</li>
          ) : (
            Object.entries(byTrigger).map(([type, count]) => (
              <li key={type}>
                {type}: <strong className="tabular-nums">{count}</strong>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ag-card" data-testid="agents-usage-runs">
        <div className="ag-usage-runs-head">
          <h2>Runs</h2>
          <select
            aria-label="Filter by agent"
            onChange={(e) => setSelectedAgentId(e.target.value as string | "all")}
            value={selectedAgentId}
          >
            <option value="all">All agents</option>
            {agentList.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <table className="ag-usage-table">
          <thead>
            <tr>
              <th>Trigger</th>
              <th>Input</th>
              <th>Result</th>
              <th>Status</th>
              <th>Step</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>No runs yet.</td>
              </tr>
            ) : (
              filtered.slice(0, 40).map((run) => (
                <tr key={run.id}>
                  <td>{run.triggerType}</td>
                  <td>{run.inputSummary}</td>
                  <td>{run.resultSummary || "—"}</td>
                  <td>{run.status}</td>
                  <td>{run.currentStepLabel || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
