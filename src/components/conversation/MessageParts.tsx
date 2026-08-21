import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "../ui/Icon";
import { actionLabel } from "../../lib/delivereeRoutes";
import { proposalActionTitle, proposalActionType } from "../../lib/workspaceDisplay";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: any;
  citations?: Array<{ id: string; title: string; type?: string }>;
  suggestedChips?: string[];
  actionPlan?: any;
  offline?: boolean;
};

export function RichText({ text }: { text: string }) {
  return (
    <div className="do-rich-text">
      {text.split("\n").map((line, index) => {
        const plain = line.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "");
        if (!plain.trim()) return <div className="do-rich-space" key={index} />;
        if (/^#{1,4}\s/.test(line)) return <h3 key={index}>{plain}</h3>;
        if (/^\s*[-*]\s/.test(line)) {
          return (
            <div className="do-rich-bullet" key={index}>
              <span />
              <p>{plain.replace(/^\s*[-*]\s*/, "")}</p>
            </div>
          );
        }
        return <p key={index}>{plain}</p>;
      })}
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isDocument = text.length > 2_500;
  const visible =
    isDocument && !expanded ? `${text.slice(0, 1_400).trimEnd()}…` : text;
  return (
    <div className={`do-user-message ${isDocument ? "is-document" : ""}`}>
      {isDocument && (
        <div className="do-user-document-head">
          <span>
            Long project input · {text.length.toLocaleString()} characters
          </span>
          <button onClick={() => setExpanded((value) => !value)} type="button">
            {expanded ? "Collapse" : "Show full"}
          </button>
        </div>
      )}
      <div>{visible}</div>
    </div>
  );
}

export function ActionProposal({
  message,
  projects,
  activeProject,
  onStage,
}: {
  message: ConversationMessage;
  projects: any[];
  activeProject: any | null;
  onStage: (message: ConversationMessage) => Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const plan = message.actionPlan;
  if (!plan?.proposedActions?.length) return null;
  return (
    <section className="do-proposal" data-testid="action-proposal">
      <div className="do-proposal-head">
        <div>
          <span className="do-kicker">Pending</span>
          <h3>{plan.title || "Pending changes"}</h3>
          <p>{plan.summary}</p>
        </div>
        <ShieldCheck size={17} />
      </div>
      <div className="do-proposal-items">
        {plan.proposedActions.map((action: any, index: number) => (
          <div className="do-proposal-item" key={`${action.type}-${index}`}>
            <span className="do-proposal-number">{index + 1}</span>
            <div>
              <strong>
                {actionLabel(proposalActionType(action, projects, activeProject))}
              </strong>
              <p>{proposalActionTitle(action, projects, activeProject)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="do-proposal-foot">
        <span>Nothing changes until you approve.</span>
        <button
          className="do-button do-button-dark"
          disabled={status !== "idle"}
          onClick={async () => {
            setStatus("saving");
            await onStage(message);
            setStatus("done");
          }}
          type="button"
        >
          {status === "saving" ? (
            <Loader2 className="spin" size={14} />
          ) : status === "done" ? (
            <Check size={14} />
          ) : (
            <ShieldCheck size={14} />
          )}
          {status === "done" ? "Ready to apply" : "Review pending"}
        </button>
      </div>
    </section>
  );
}
