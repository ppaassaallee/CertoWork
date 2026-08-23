import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Plus,
  WandSparkles,
} from "../ui/Icon";
import { OdysseusMark } from "../odiseus/OdysseusMark";
import { StatusLight } from "../ui/StatusLight";
import { t } from "../../lib/i18n";
import { ODISEUS_NAME, ODISEUS_SUBLINE } from "../../lib/odiseus";
import { BUILT_IN_ODYSSEUS_SLUG } from "../../lib/agent-platform/types";
import {
  type AgentActivityItem,
  activityResultTone,
  countAgentRunsToday,
  formatAgentActivityLine,
  formatRelativeTime,
} from "../../lib/agentActivity";

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
    name: ODISEUS_NAME,
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

function agentStatusTone(
  status: AgentListItem["status"],
): "green" | "amber" | "gray" | "blue" {
  if (status === "published") return "green";
  if (status === "testing" || status === "paused") return "amber";
  if (status === "draft") return "blue";
  return "gray";
}

function agentStatusLabel(status: AgentListItem["status"]) {
  if (status === "published") return "Active";
  if (status === "testing") return "Testing";
  if (status === "paused") return "Paused";
  if (status === "archived") return "Archived";
  return "Draft";
}

function AgentGlyph({ slug }: { slug: string }) {
  if (slug === BUILT_IN_ODYSSEUS_SLUG) return <OdysseusMark size="md" />;
  if (slug === "portfolio-reporter") return <WandSparkles size={18} />;
  return <AlertTriangle size={18} />;
}

function agentRowMetric(input: {
  agent: AgentListItem;
  pendingApprovals: number;
  runsToday: number;
}): { label: string; tone?: "amber" | "green" | "gray" } {
  const { agent, pendingApprovals, runsToday } = input;
  if (agent.slug === BUILT_IN_ODYSSEUS_SLUG) {
    if (pendingApprovals > 0) {
      return {
        label: `${pendingApprovals} pending approval${pendingApprovals === 1 ? "" : "s"}`,
        tone: "amber",
      };
    }
    if (runsToday > 0) {
      return {
        label: `${runsToday} run${runsToday === 1 ? "" : "s"} today`,
        tone: "green",
      };
    }
    return { label: "Ready", tone: "gray" };
  }
  if (agent.status === "draft") return { label: "Not live yet", tone: "gray" };
  return { label: agentStatusLabel(agent.status), tone: "gray" };
}

export function AgentsLibrary({
  onOpenOdysseus,
  onOpenAutomations,
  onOpenActivity,
  onCreateAgent,
  onOpenApprovals,
  activityItems = [],
  pendingApprovals = 0,
  viewerUserId,
}: {
  onOpenOdysseus: () => void;
  onOpenAutomations: () => void;
  onOpenActivity: () => void;
  onCreateAgent?: () => void;
  onOpenApprovals?: () => void;
  activityItems?: AgentActivityItem[];
  pendingApprovals?: number;
  viewerUserId?: string | null;
}) {
  const runsToday = countAgentRunsToday(activityItems, "odysseus");

  return (
    <div className="do-agents-home" data-testid="agents-home">
      <div data-testid="agents-library">
        <header className="do-agents-head">
          <div>
            <strong>{t("navAgents")}</strong>
            <p>
              Agents own outcomes. Hermes executes; Certo governs data and approvals.
            </p>
          </div>
          <button
            className="cw-btn cw-btn-primary cw-btn-sm"
            data-testid="agents-new"
            onClick={onCreateAgent}
            type="button"
          >
            <Plus size={14} /> New agent
          </button>
        </header>

        <section className="do-agents-section">
          <h3>Your agents</h3>
          <div className="do-agents-list" role="list">
            {STARTER_AGENTS.map((agent) => {
              const metric = agentRowMetric({
                agent,
                pendingApprovals,
                runsToday,
              });
              const openAgent = () => {
                if (agent.slug === BUILT_IN_ODYSSEUS_SLUG) onOpenOdysseus();
                else if (agent.slug === "portfolio-reporter") onOpenAutomations();
                else onOpenActivity();
              };
              return (
                <div
                  className="do-agents-row"
                  data-testid={`agent-row-${agent.slug}`}
                  key={agent.id}
                  role="listitem"
                >
                  <button
                    className="do-agents-row-hit"
                    onClick={openAgent}
                    type="button"
                  >
                    <span className="do-agents-row-icon" aria-hidden>
                      <AgentGlyph slug={agent.slug} />
                    </span>
                    <span className="do-agents-row-main">
                      <span className="do-agents-row-title">
                        <strong>{agent.name}</strong>
                        <StatusLight
                          status={agentStatusTone(agent.status)}
                          label={agentStatusLabel(agent.status)}
                          size="sm"
                        />
                      </span>
                      <small>{agent.description}</small>
                    </span>
                  </button>
                  {metric.tone === "amber" && onOpenApprovals ? (
                    <button
                      className="do-agents-row-metric is-amber"
                      onClick={onOpenApprovals}
                      type="button"
                    >
                      {metric.label}
                    </button>
                  ) : (
                    <span
                      className={`do-agents-row-metric${
                        metric.tone === "green" ? " is-green" : ""
                      }`}
                    >
                      {metric.label}
                    </span>
                  )}
                  <button
                    aria-label={`Open ${agent.name}`}
                    className="do-agents-row-chev"
                    onClick={openAgent}
                    type="button"
                  >
                    <ChevronRight size={14} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {activityItems.length > 0 && (
          <section className="do-agents-recent" data-testid="agents-activity">
            <h3>Recent activity</h3>
            <ul className="do-agents-activity-list">
              {activityItems.slice(0, 8).map((item, index) => {
                const tone = activityResultTone(item.result || item.action);
                const line = formatAgentActivityLine(item, { viewerUserId });
                const when = formatRelativeTime(item.createdAt);
                return (
                  <li
                    className={`do-agents-activity-item is-${tone}`}
                    key={item.id || index}
                  >
                    <span className="do-agents-activity-dot" aria-hidden />
                    <div>
                      <p>
                        {line}
                        {when ? ` · ${when}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <nav className="do-agents-foot" aria-label="Agent platform">
          <button onClick={onOpenAutomations} type="button">
            <WandSparkles size={13} /> {t("agentsAutomations")}
          </button>
          <button onClick={onOpenActivity} type="button">
            <Activity size={13} /> {t("agentsActivity")}
          </button>
        </nav>
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
      <h2>What outcome should this agent own?</h2>
      <p>
        Example: Every Monday review active projects, prepare an executive summary, and
        propose follow-ups — ask before changing anything. {ODISEUS_SUBLINE}
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
        Draft agent
      </button>
    </div>
  );
}
