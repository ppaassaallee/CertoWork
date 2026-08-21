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

export function OdiseusEmptyHero({
  title,
  subtitle,
  examples,
  onExample,
}: {
  title: string;
  subtitle: string;
  examples: string[];
  onExample: (prompt: string) => void;
}) {
  return (
    <div className="odiseus-empty-hero">
      <OdiseusMark size="lg" />
      <span className="do-context-eyebrow">Your AI employee</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div className="odiseus-trust-row">
        <span>Investigates</span>
        <span>Uses Certo tools</span>
        <span>Asks before irreversible work</span>
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
