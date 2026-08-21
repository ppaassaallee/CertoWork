import { Check, Loader2 } from "../ui/Icon";
import { OdiseusBadge, OdiseusMark } from "./OdiseusMark";
import type { OdiseusRunStep } from "../../lib/odiseusJobs";

export type { OdiseusRunStep };

export function OdiseusWorkLog({
  steps,
  working = false,
}: {
  steps: OdiseusRunStep[];
  working?: boolean;
}) {
  if (!steps.length && !working) return null;
  return (
    <div className="odiseus-work-log" data-testid="odiseus-work-log">
      <div className="odiseus-work-log-head">
        <OdiseusMark size="sm" />
        <strong>{working ? "Odiseus is working" : "Work completed"}</strong>
      </div>
      <ul>
        {steps.map((step, index) => (
          <li key={step.id || `${step.label}-${index}`} className={`is-${step.status}`}>
            {step.status === "done" ? (
              <Check size={12} />
            ) : step.status === "working" ? (
              <Loader2 className="spin" size={12} />
            ) : (
              <span className="odiseus-work-dot" />
            )}
            <span>{step.label}</span>
          </li>
        ))}
        {working && !steps.some((step) => step.status === "working") && (
          <li className="is-working">
            <Loader2 className="spin" size={12} />
            <span>Continuing…</span>
          </li>
        )}
      </ul>
    </div>
  );
}

export function OdiseusArtifactCard({
  title,
  summary,
  meta,
  onOpen,
}: {
  title: string;
  summary?: string;
  meta?: string;
  onOpen?: () => void;
}) {
  return (
    <div className="odiseus-artifact-card">
      <div>
        <span className="odiseus-artifact-kicker">Artifact · Odiseus</span>
        <strong>{title}</strong>
        {summary ? <p>{summary}</p> : null}
        {meta ? <small>{meta}</small> : null}
      </div>
      {onOpen ? (
        <button onClick={onOpen} type="button">
          Open
        </button>
      ) : null}
    </div>
  );
}

/** Functional agent home chrome — queues render above via parent. */
export function OdiseusAgentHome({
  examples,
  onExample,
  pendingApprovals = 0,
}: {
  examples: string[];
  onExample: (prompt: string) => void;
  pendingApprovals?: number;
}) {
  return (
    <div className="odiseus-agent-home">
      <div className="odiseus-agent-head">
        <OdiseusMark size="md" />
        <div>
          <strong>Odiseus</strong>
          <p>
            Your AI employee · Ready
            {pendingApprovals > 0
              ? ` · ${pendingApprovals} waiting for approval`
              : ""}
          </p>
          <small>
            Proposes, then asks · Approval before irreversible work · Works
            across your workspace
          </small>
        </div>
      </div>
      <div className="odiseus-example-jobs">
        {examples.map((example) => (
          <button key={example} onClick={() => onExample(example)} type="button">
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

export { OdiseusBadge };

/** @deprecated Prefer OdiseusAgentHome */
export function OdiseusEmptyHero({
  examples,
  onExample,
}: {
  title?: string;
  subtitle?: string;
  examples: string[];
  onExample: (prompt: string) => void;
}) {
  return <OdiseusAgentHome examples={examples} onExample={onExample} />;
}
