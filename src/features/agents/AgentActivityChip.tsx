import type { AgentRunRecord } from "../../lib/agent-platform/types";
import "./agentActivityChips.css";

export function AgentActivityChip({
  run,
  variant = "accent",
}: {
  run: Pick<AgentRunRecord, "currentStepLabel" | "findingLabel" | "status">;
  variant?: "accent" | "signal" | "pink" | "yellow";
}) {
  const finding = Boolean(run.findingLabel);
  const label = finding
    ? run.findingLabel
    : run.currentStepLabel || (run.status === "running" ? "Working…" : null);
  if (!label) return null;
  const tone = finding ? "signal" : variant;
  return (
    <span className={`ag-activity-chip is-${tone}`} data-testid="agent-activity-chip">
      <span className="ag-activity-chip-glyph" aria-hidden="true" />
      {label}
    </span>
  );
}

export function AgentFindingChip({ label }: { label: string }) {
  return (
    <span className="ag-activity-chip is-signal" data-testid="agent-finding-chip">
      <span className="ag-activity-chip-glyph is-warn" aria-hidden="true" />
      {label}
    </span>
  );
}
