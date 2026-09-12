import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Plus,
  Sparkles,
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
import {
  relativeNextRunLabel,
  routineStatusTone,
  type RoutineSpec,
} from "../../lib/routines";
import { useRoutineHost } from "../routines/RoutineHost";

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

function routineAsAgentStatus(status: string): AgentListItem["status"] {
  if (status === "active") return "published";
  if (status === "paused") return "paused";
  if (status === "failing") return "testing";
  return "draft";
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
  routines = [],
}: {
  onOpenOdysseus: () => void;
  onOpenAutomations: () => void;
  onOpenActivity: () => void;
  onCreateAgent?: () => void;
  onOpenApprovals?: () => void;
  activityItems?: AgentActivityItem[];
  pendingApprovals?: number;
  viewerUserId?: string | null;
  routines?: RoutineSpec[];
}) {
  const runsToday = countAgentRunsToday(activityItems, "odysseus");
  const { openRoutine } = useRoutineHost();
  const activeRoutines = routines.filter((routine) => routine.status === "active").length;

  return (
    <div className="do-agents-home" data-testid="agents-home">
      <div data-testid="agents-library">
        <header className="do-agents-head">
          <div>
            <strong>{t("navAgents")}</strong>
            <p>
              Agents and Rutinas own outcomes. Odysseus investigates; Rutinas run on a
              schedule or event — both wait for approval when they write.
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

        <section className="do-agents-section do-agents-routines-section" data-testid="agents-routines">
          <h3>
            <span>Rutinas</span>
            <button
              className="cw-btn cw-btn-ghost cw-btn-sm"
              onClick={() =>
                openRoutine({
                  entityType: "portfolio",
                  entityId: null,
                  entityTitle: "Portafolio",
                })
              }
              type="button"
            >
              <Sparkles size={13} /> Nueva
            </button>
          </h3>
          <p className="do-agents-routines-lead">
            Una frase → una tarjeta. Corren solas; los pasos se ven en cada corrida.
            {activeRoutines ? ` ${activeRoutines} activas.` : ""}
          </p>
          <div className="do-agents-list" role="list">
            {routines.length === 0 ? (
              <div className="do-agents-row" role="listitem">
                <button
                  className="do-agents-row-hit"
                  onClick={onOpenAutomations}
                  type="button"
                >
                  <span className="do-agents-row-icon" aria-hidden>
                    <Sparkles size={18} />
                  </span>
                  <span className="do-agents-row-main">
                    <span className="do-agents-row-title">
                      <strong>Abrir Rutinas</strong>
                      <StatusLight status="blue" label="Recetas" size="sm" />
                    </span>
                    <small>Brief matutino, vigía de fechas, cazador de bloqueos…</small>
                  </span>
                </button>
                <button
                  aria-label="Open Rutinas"
                  className="do-agents-row-chev"
                  onClick={onOpenAutomations}
                  type="button"
                >
                  <ChevronRight size={14} aria-hidden />
                </button>
              </div>
            ) : (
              routines.slice(0, 8).map((routine) => {
                const status = routineAsAgentStatus(routine.status);
                const tone = routineStatusTone(routine.status);
                return (
                  <div
                    className="do-agents-row"
                    data-testid={`routine-row-${routine.id}`}
                    key={routine.id}
                    role="listitem"
                  >
                    <button
                      className="do-agents-row-hit"
                      onClick={onOpenAutomations}
                      type="button"
                    >
                      <span className="do-agents-row-icon" aria-hidden>
                        <Sparkles size={18} />
                      </span>
                      <span className="do-agents-row-main">
                        <span className="do-agents-row-title">
                          <strong>{routine.title}</strong>
                          <StatusLight
                            status={
                              tone === "green"
                                ? "green"
                                : tone === "red"
                                  ? "amber"
                                  : agentStatusTone(status)
                            }
                            label={routine.status}
                            size="sm"
                          />
                        </span>
                        <small>
                          {routine.scope?.entityTitle || routine.scope?.entityType || "—"}
                          {routine.status === "active"
                            ? ` · ${relativeNextRunLabel(routine.nextRunAt)}`
                            : ""}
                        </small>
                      </span>
                    </button>
                    <button
                      aria-label={`Open ${routine.title}`}
                      className="do-agents-row-chev"
                      onClick={onOpenAutomations}
                      type="button"
                    >
                      <ChevronRight size={14} aria-hidden />
                    </button>
                  </div>
                );
              })
            )}
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
            <Sparkles size={13} /> Rutinas
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
  const { openRoutine } = useRoutineHost();
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
      <div className="do-agent-builder-actions">
        <button
          className="cw-btn cw-btn-primary"
          disabled={!outcome.trim()}
          onClick={onContinue}
          type="button"
        >
          Draft agent
        </button>
        <button
          className="cw-btn cw-btn-ghost"
          onClick={() =>
            openRoutine({
              entityType: "portfolio",
              entityId: null,
              entityTitle: "Portafolio",
              contextStats: undefined,
            })
          }
          type="button"
        >
          <Sparkles size={13} /> Mejor como Rutina
        </button>
      </div>
    </div>
  );
}
