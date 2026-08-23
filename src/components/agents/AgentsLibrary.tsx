import { Bot, ChevronRight, Mail, Plus, WandSparkles } from "../ui/Icon";
import { OdysseusMark } from "../odiseus/OdysseusMark";
import { t } from "../../lib/i18n";
import { BUILT_IN_ODYSSEUS_SLUG } from "../../lib/agent-platform/types";

export type AgentListItem = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "testing" | "published" | "paused" | "archived";
  slug: string;
};

const STARTER_AGENTS: AgentListItem[] = [
  {
    id: "built-in-odysseus",
    slug: BUILT_IN_ODYSSEUS_SLUG,
    name: "Odysseus",
    description: "Chief of Staff — investigate, organize, propose, wait for approval.",
    status: "published",
  },
  {
    id: "portfolio-reporter",
    slug: "portfolio-reporter",
    name: "Portfolio Reporter",
    description: "Weekly executive portfolio summary with follow-up proposals.",
    status: "draft",
  },
  {
    id: "project-risk-monitor",
    slug: "project-risk-monitor",
    name: "Project Risk Monitor",
    description: "Runs when a project becomes at risk.",
    status: "draft",
  },
];

export function AgentsLibrary({
  onOpenOdysseus,
  onOpenAutomations,
  onOpenActivity,
  onCreateAgent,
  activityItems = [],
}: {
  onOpenOdysseus: () => void;
  onOpenAutomations: () => void;
  onOpenActivity: () => void;
  onCreateAgent?: () => void;
  activityItems?: Array<{ id?: string; summary?: string }>;
}) {
  return (
    <div className="do-agents-home" data-testid="agents-home">
      <div data-testid="agents-library">
      <header className="do-agents-head">
        <Bot size={22} />
        <div>
          <strong>{t("navAgents")}</strong>
          <p>
            Create Agents that own outcomes. Hermes executes; Certo governs data and
            approvals.
          </p>
        </div>
        <button
          className="cw-btn cw-btn-primary cw-btn-sm"
          data-testid="agents-new"
          onClick={onCreateAgent}
          type="button"
        >
          <Plus size={14} /> New Agent
        </button>
      </header>

      <section className="do-agents-section">
        <h3>Your Agents</h3>
        <div className="do-agents-grid">
          {STARTER_AGENTS.map((agent) => (
            <button
              className="do-agents-card"
              key={agent.id}
              onClick={() => {
                if (agent.slug === BUILT_IN_ODYSSEUS_SLUG) onOpenOdysseus();
                else if (agent.slug === "portfolio-reporter") onOpenAutomations();
                else onOpenActivity();
              }}
              type="button"
            >
              {agent.slug === BUILT_IN_ODYSSEUS_SLUG ? (
                <OdysseusMark size="md" />
              ) : agent.slug === "portfolio-reporter" ? (
                <WandSparkles size={18} />
              ) : (
                <Mail size={18} />
              )}
              <span>
                <strong>{agent.name}</strong>
                <small>
                  {agent.description} · {agent.status}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </section>

      <section className="do-agents-section">
        <h3>Platform</h3>
        <div className="do-agents-grid">
          <button className="do-agents-card" onClick={onOpenAutomations} type="button">
            <WandSparkles size={18} />
            <span>
              <strong>{t("agentsAutomations")}</strong>
              <small>Skills and scheduled runs</small>
            </span>
            <ChevronRight size={14} />
          </button>
          <button className="do-agents-card" onClick={onOpenActivity} type="button">
            <Mail size={18} />
            <span>
              <strong>{t("agentsActivity")}</strong>
              <small>Updates and recent agent work</small>
            </span>
            <ChevronRight size={14} />
          </button>
        </div>
      </section>

      {activityItems.length > 0 && (
        <section className="do-agents-recent">
          <h3>Recent activity</h3>
          <ul>
            {activityItems.slice(0, 8).map((item, index) => (
              <li key={item.id || index}>{item.summary}</li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}

export function AgentBuilderDraft({
  outcome,
  onChange,
  onContinue,
}: {
  outcome: string;
  onChange: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="do-agent-builder" data-testid="agent-builder">
      <h2>What outcome should this Agent own?</h2>
      <p>
        Example: Every Monday review active projects, prepare an executive summary, and
        propose follow-ups — ask before changing anything.
      </p>
      <textarea
        aria-label="Agent outcome"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Describe the outcome…"
        rows={5}
        value={outcome}
      />
      <button
        className="cw-btn cw-btn-primary"
        disabled={!outcome.trim()}
        onClick={onContinue}
        type="button"
      >
        Draft Agent
      </button>
    </div>
  );
}
