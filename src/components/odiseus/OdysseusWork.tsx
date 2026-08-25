import { Check, Loader2 } from "../ui/Icon";
import { OdysseusBadge, OdysseusMark } from "./OdysseusMark";
import type { OdysseusRunStep } from "../../lib/odiseusJobs";

export type { OdysseusRunStep };

export function OdysseusWorkLog({
  steps,
  working = false,
}: {
  steps: OdysseusRunStep[];
  working?: boolean;
}) {
  if (!steps.length && !working) return null;
  return (
    <div className="odiseus-work-log" data-testid="odiseus-work-log">
      <div className="odiseus-work-log-head">
        <OdysseusMark size="sm" />
        <strong>{working ? "Odysseus is working" : "Work completed"}</strong>
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

export function OdysseusArtifactCard({
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
        <span className="odiseus-artifact-kicker">Artifact · Odysseus</span>
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
export function OdysseusAgentHome({
  examples,
  onExample,
  pendingApprovals = 0,
  onTalk,
}: {
  examples: string[];
  onExample: (prompt: string) => void;
  pendingApprovals?: number;
  onTalk?: () => void;
}) {
  return (
    <div className="odiseus-agent-home">
      <div className="odiseus-agent-head">
        <OdysseusMark size="md" />
        <div>
          <strong>Odysseus</strong>
          <p>
            Your AI employee · Ready
            {pendingApprovals > 0
              ? ` · ${pendingApprovals} waiting for approval`
              : ""}
          </p>
          <small>
            Talk, then apply · Approval before irreversible work · Personal
            to you in this workspace
          </small>
        </div>
      </div>
      {onTalk ? (
        <button className="odiseus-talk-launch" onClick={onTalk} type="button">
          Talk with Odysseus
        </button>
      ) : null}
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

export { OdysseusBadge };

/** @deprecated Prefer OdysseusAgentHome */
export function OdysseusEmptyHero({
  examples,
  onExample,
}: {
  title?: string;
  subtitle?: string;
  examples: string[];
  onExample: (prompt: string) => void;
}) {
  return <OdysseusAgentHome examples={examples} onExample={onExample} />;
}
