import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Sparkles,
  UserPlus,
  Zap,
} from "../../components/ui/Icon";
import type { AgentDomainEvent, AgentStatus, AgentTemplate } from "../../lib/agent-platform/types";
import {
  buildTestRunPlan,
  getAgentDefinition,
  getAgentVersion,
  listRunsForWorkspace,
  listTemplates,
  provisionFromTemplate,
  saveAgentFromBuilder,
} from "../../lib/agent-platform/agentStore";
import { ensureSystemTemplatesSeeded } from "../../lib/agent-platform/agentTemplates";
import { isAgentsJobsEnabled } from "./agentJobsFlag";
import "./agentBuilder.css";

const SKILL_CATALOG = [
  "Progress tracking",
  "Team summarization",
  "Risk detection",
  "Requirements structuring",
  "Duplicate detection",
  "Collections follow-up",
  "Portfolio reporting",
];

const POLICY_KEYS = [
  "read",
  "post_update",
  "add_label",
  "change_state",
  "reassign",
  "create_item",
  "send_email",
  "external_side_effect",
] as const;

const DOMAIN_EVENTS: AgentDomainEvent[] = [
  "created",
  "updated",
  "state_changed",
  "reassigned",
  "removed",
  "assigned_to_agent",
  "mentioned",
];

export type BuilderState = {
  name: string;
  owns: string;
  outcome: string;
  instructions: string;
  skills: string[];
  modelTier: "fast" | "balanced" | "deep";
  triggers: {
    assignment: boolean;
    mention: boolean;
    workItemChanges: boolean;
    schedule: boolean;
    events: AgentDomainEvent[];
    cron: string;
    timezone: string;
  };
  canDo: string[];
  mustAsk: string[];
  status: AgentStatus;
};

const DEFAULT_STATE: BuilderState = {
  name: "",
  owns: "",
  outcome: "",
  instructions: "",
  skills: ["Progress tracking"],
  modelTier: "balanced",
  triggers: {
    assignment: true,
    mention: true,
    workItemChanges: false,
    schedule: false,
    events: ["state_changed", "assigned_to_agent"],
    cron: "0 8 * * 1-5",
    timezone: "America/Tegucigalpa",
  },
  canDo: ["read", "post_update"],
  mustAsk: ["change_state", "reassign", "create_item", "send_email", "external_side_effect"],
  status: "draft",
};

function draftFromTemplate(template: AgentTemplate): BuilderState {
  return {
    ...DEFAULT_STATE,
    name: template.name,
    owns: template.owns,
    outcome: template.outcome,
    instructions: String(template.versionSeed.instructions || template.description),
    skills: template.skillNames.length ? template.skillNames : DEFAULT_STATE.skills,
    modelTier: template.versionSeed.model?.tier || "balanced",
    triggers: {
      assignment: template.triggerSeeds.some((t) => t.type === "manual"),
      mention: template.triggerSeeds.some((t) => t.events?.includes("mentioned")),
      workItemChanges: template.triggerSeeds.some((t) => t.type === "domain_event"),
      schedule: template.triggerSeeds.some((t) => t.type === "schedule"),
      events: (template.triggerSeeds.find((t) => t.events)?.events ||
        DEFAULT_STATE.triggers.events) as AgentDomainEvent[],
      cron: String(template.triggerSeeds.find((t) => t.schedule)?.schedule || DEFAULT_STATE.triggers.cron),
      timezone: String(
        template.triggerSeeds.find((t) => t.timezone)?.timezone || DEFAULT_STATE.triggers.timezone,
      ),
    },
  };
}

function agentIdFromPath(pathname: string): string | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/agents/new") return "new";
  const setup = path.match(/^\/agents\/([^/]+)\/setup$/);
  if (setup) return decodeURIComponent(setup[1]);
  return undefined;
}

export function AgentBuilderPage({
  workspaceId = "",
  ownerUserId = "",
  onPublish,
}: {
  workspaceId?: string;
  ownerUserId?: string;
  onPublish?: (draft: BuilderState) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const agentId = agentIdFromPath(location.pathname);
  const enabled = isAgentsJobsEnabled();
  const [draft, setDraft] = useState<BuilderState>(DEFAULT_STATE);
  const [savedAgentId, setSavedAgentId] = useState<string | null>(
    agentId && agentId !== "new" ? agentId : null,
  );
  const [testItemId, setTestItemId] = useState("");
  const [testPlan, setTestPlan] = useState<string[] | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureSystemTemplatesSeeded();
    const templateId = search.get("template");
    if (templateId) {
      const template = listTemplates().find((t) => t.id === templateId);
      if (template) {
        setDraft(draftFromTemplate(template));
        return;
      }
    }
    if (agentId && agentId !== "new") {
      void (async () => {
        const def = await getAgentDefinition(agentId);
        if (!def?.currentVersionId) return;
        const ver = await getAgentVersion(def.currentVersionId);
        if (!ver) return;
        setDraft({
          name: def.name,
          owns: ver.owns || "",
          outcome: ver.outcome || "",
          instructions: ver.instructions || "",
          skills: ver.skills.map((s) => s.name),
          modelTier: ver.model?.tier || "balanced",
          triggers: { ...DEFAULT_STATE.triggers },
          canDo: Object.entries(ver.actionPolicy)
            .filter(([, v]) => v === "allow")
            .map(([k]) => k),
          mustAsk: Object.entries(ver.actionPolicy)
            .filter(([, v]) => v === "ask")
            .map(([k]) => k),
          status: def.status,
        });
        setSavedAgentId(def.id);
      })();
    }
  }, [agentId, search]);

  const title = useMemo(
    () => (savedAgentId || (agentId && agentId !== "new") ? "Edit agent" : "New agent"),
    [agentId, savedAgentId],
  );

  const recentRuns = useMemo(
    () =>
      workspaceId
        ? listRunsForWorkspace(workspaceId)
            .filter((r) => !savedAgentId || r.agentId === savedAgentId)
            .slice(0, 5)
        : [],
    [workspaceId, savedAgentId, notice],
  );

  if (!enabled) {
    return (
      <div className="ag-builder" data-testid="agent-builder-disabled">
        <p>Agents that own a job are turned off for this workspace.</p>
        <button className="cw-btn cw-btn-secondary" onClick={() => navigate("/agents")} type="button">
          Back to agents
        </button>
      </div>
    );
  }

  const toggleSkill = (skill: string) => {
    setDraft((current) => ({
      ...current,
      skills: current.skills.includes(skill)
        ? current.skills.filter((s) => s !== skill)
        : [...current.skills, skill],
    }));
  };

  const movePolicy = (key: string, to: "canDo" | "mustAsk") => {
    setDraft((current) => {
      const canDo = current.canDo.filter((k) => k !== key);
      const mustAsk = current.mustAsk.filter((k) => k !== key);
      if (to === "canDo") canDo.push(key);
      else mustAsk.push(key);
      return { ...current, canDo, mustAsk };
    });
  };

  const persist = async (status: AgentStatus) => {
    if (!workspaceId || !ownerUserId) {
      setNotice("Missing workspace — draft kept locally.");
      setDraft((d) => ({ ...d, status }));
      return null;
    }
    setBusy(true);
    try {
      const saved = await saveAgentFromBuilder({
        workspaceId,
        ownerUserId,
        agentId: savedAgentId || undefined,
        name: draft.name,
        owns: draft.owns,
        outcome: draft.outcome,
        instructions: draft.instructions,
        skills: draft.skills,
        modelTier: draft.modelTier,
        status,
        canDo: draft.canDo,
        mustAsk: draft.mustAsk,
        triggers: draft.triggers,
      });
      setSavedAgentId(saved.definition.id);
      setDraft((d) => ({ ...d, status: saved.definition.status }));
      return saved;
    } finally {
      setBusy(false);
    }
  };

  const runTest = () => {
    setTestPlan(
      buildTestRunPlan({
        agentName: draft.name,
        itemId: testItemId,
        mustAsk: draft.mustAsk,
        instructions: draft.instructions,
      }),
    );
    setNotice("Test plan ready — nothing was written.");
  };

  const publish = async () => {
    const saved = await persist("published");
    onPublish?.({ ...draft, status: "published" });
    setNotice(
      saved
        ? `Published ${saved.definition.name} · v${saved.version.version}`
        : "Published (local draft).",
    );
    if (saved) navigate(`/agents/${saved.definition.id}/setup`);
  };

  return (
    <div className="ag-builder" data-testid="agent-builder">
      <div className="ag-builder-hero">
        <span className="ag-builder-icon" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <p className="ag-builder-kicker">{title}</p>
          <h1>{draft.name || "Name your agent"}</h1>
          <p>Give it a job — owns, outcome, playbook, triggers, and boundaries.</p>
        </div>
        <button className="cw-btn cw-btn-ghost" onClick={() => navigate("/agents")} type="button">
          Close
        </button>
      </div>

      <div className="ag-builder-grid">
        <div className="ag-builder-main">
          <section className="ag-card">
            <h2>Name your agent</h2>
            <label>
              Name
              <input
                data-testid="agent-builder-name"
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                value={draft.name}
              />
            </label>
            <div className="ag-two">
              <label>
                What it owns
                <input
                  data-testid="agent-builder-owns"
                  onChange={(e) => setDraft((d) => ({ ...d, owns: e.target.value }))}
                  placeholder="Delivery risk on active projects"
                  value={draft.owns}
                />
              </label>
              <label>
                Outcome it works toward
                <input
                  data-testid="agent-builder-outcome"
                  onChange={(e) => setDraft((d) => ({ ...d, outcome: e.target.value }))}
                  placeholder="No slipped dates go unnoticed"
                  value={draft.outcome}
                />
              </label>
            </div>
          </section>

          <section className="ag-card">
            <h2>Instructions</h2>
            <textarea
              data-testid="agent-builder-instructions"
              onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
              placeholder="Playbook: how it investigates, what it proposes, when it stops."
              rows={6}
              value={draft.instructions}
            />
          </section>

          <section className="ag-card">
            <h2>Skills</h2>
            <div className="ag-chips">
              {SKILL_CATALOG.map((skill) => (
                <button
                  className={draft.skills.includes(skill) ? "is-on" : ""}
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  type="button"
                >
                  {skill}
                </button>
              ))}
              <button className="is-add" type="button">
                <Plus size={12} /> Add skill
              </button>
            </div>
          </section>

          <section className="ag-card">
            <h2>Model</h2>
            <div className="ag-segmented" role="group" aria-label="Model tier">
              {(["fast", "balanced", "deep"] as const).map((tier) => (
                <button
                  className={draft.modelTier === tier ? "is-active" : ""}
                  key={tier}
                  onClick={() => setDraft((d) => ({ ...d, modelTier: tier }))}
                  type="button"
                >
                  {tier}
                </button>
              ))}
            </div>
            <p className="ag-hint">Runtime: Hermes when enabled, otherwise Odysseus fallback.</p>
          </section>

          <section className="ag-card">
            <h2>When it starts</h2>
            <div className="ag-trigger-grid">
              <label className="ag-trigger">
                <UserPlus size={16} />
                <span>
                  <strong>Assignment</strong>
                  <small>When the agent is assigned a work item</small>
                </span>
                <input
                  checked={draft.triggers.assignment}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      triggers: { ...d.triggers, assignment: e.target.checked },
                    }))
                  }
                  type="checkbox"
                />
              </label>
              <label className="ag-trigger">
                <MessageSquare size={16} />
                <span>
                  <strong>Mention</strong>
                  <small>When someone @mentions the agent</small>
                </span>
                <input
                  checked={draft.triggers.mention}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      triggers: { ...d.triggers, mention: e.target.checked },
                    }))
                  }
                  type="checkbox"
                />
              </label>
              <label className="ag-trigger">
                <Zap size={16} />
                <span>
                  <strong>Work item changes</strong>
                  <small>Domain events with filters</small>
                </span>
                <input
                  checked={draft.triggers.workItemChanges}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      triggers: { ...d.triggers, workItemChanges: e.target.checked },
                    }))
                  }
                  type="checkbox"
                />
              </label>
              <label className="ag-trigger">
                <CalendarClock size={16} />
                <span>
                  <strong>Schedule</strong>
                  <small>Cron + timezone</small>
                </span>
                <input
                  checked={draft.triggers.schedule}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      triggers: { ...d.triggers, schedule: e.target.checked },
                    }))
                  }
                  type="checkbox"
                />
              </label>
            </div>
            {draft.triggers.workItemChanges && (
              <div className="ag-chips">
                {DOMAIN_EVENTS.map((event) => {
                  const on = draft.triggers.events.includes(event);
                  return (
                    <button
                      className={on ? "is-on" : ""}
                      key={event}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          triggers: {
                            ...d.triggers,
                            events: on
                              ? d.triggers.events.filter((x) => x !== event)
                              : [...d.triggers.events, event],
                          },
                        }))
                      }
                      type="button"
                    >
                      {event}
                    </button>
                  );
                })}
              </div>
            )}
            {draft.triggers.schedule && (
              <div className="ag-two">
                <label>
                  Cron
                  <input
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        triggers: { ...d.triggers, cron: e.target.value },
                      }))
                    }
                    value={draft.triggers.cron}
                  />
                </label>
                <label>
                  Timezone
                  <input
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        triggers: { ...d.triggers, timezone: e.target.value },
                      }))
                    }
                    value={draft.triggers.timezone}
                  />
                </label>
              </div>
            )}
          </section>

          <section className="ag-card">
            <h2>Working context</h2>
            <div className="ag-context-grid">
              <article>
                <strong>Projects</strong>
                <p>Reach limited by dataAccess after publish.</p>
              </article>
              <article>
                <strong>Trusted sources</strong>
                <p>Notes, tables, and URLs the agent may read.</p>
              </article>
              <article>
                <strong>Connected tools</strong>
                <p>From integration_configs — allow per tool.</p>
              </article>
              <article>
                <strong>Works through</strong>
                <p>Service account or a member&apos;s connection.</p>
              </article>
            </div>
          </section>

          <section className="ag-card">
            <h2>Boundaries</h2>
            <div className="ag-two">
              <div>
                <h3>Can do without asking</h3>
                <div className="ag-chips">
                  {POLICY_KEYS.map((key) => (
                    <button
                      className={draft.canDo.includes(key) ? "is-on" : ""}
                      key={`can-${key}`}
                      onClick={() => movePolicy(key, "canDo")}
                      type="button"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3>Asks for approval</h3>
                <div className="ag-chips">
                  {POLICY_KEYS.map((key) => (
                    <button
                      className={draft.mustAsk.includes(key) ? "is-on" : ""}
                      key={`ask-${key}`}
                      onClick={() => movePolicy(key, "mustAsk")}
                      type="button"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="ag-builder-side">
          <section className="ag-card">
            <h2>Preview</h2>
            <strong>{draft.name || "Untitled agent"}</strong>
            <p>{draft.owns || "What it owns"}</p>
            <p className="ag-hint">{draft.outcome || "Outcome"}</p>
            <ul>
              <li>Status: {draft.status}</li>
              <li>Skills: {draft.skills.length}</li>
              <li>Tier: {draft.modelTier}</li>
            </ul>
          </section>
          <section className="ag-card">
            <h2>Recent runs</h2>
            {recentRuns.length === 0 ? (
              <p className="ag-hint">No runs yet.</p>
            ) : (
              <ul>
                {recentRuns.map((run) => (
                  <li key={run.id}>
                    {run.triggerType} · {run.status}
                    {run.currentStepLabel ? ` — ${run.currentStepLabel}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="ag-card">
            <h2>Waiting for you</h2>
            <p className="ag-hint">Approvals appear here when the agent asks.</p>
          </section>
          <section className="ag-card">
            <h2>Test run</h2>
            <label>
              Work item id
              <input
                data-testid="agent-builder-test-item"
                onChange={(e) => setTestItemId(e.target.value)}
                placeholder="item id"
                value={testItemId}
              />
            </label>
            <button className="cw-btn cw-btn-secondary" onClick={runTest} type="button">
              <Play size={14} /> Test run
            </button>
            {testPlan && (
              <ol className="ag-test-plan" data-testid="agent-builder-test-plan">
                {testPlan.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      <footer className="ag-builder-foot">
        {notice ? <span className="ag-notice">{notice}</span> : <span />}
        <div className="ag-builder-foot-actions">
          <button
            className="cw-btn cw-btn-ghost"
            disabled={busy}
            onClick={() => void persist("paused")}
            type="button"
          >
            <Pause size={14} /> Pause
          </button>
          <button
            className="cw-btn cw-btn-secondary"
            disabled={busy}
            onClick={() => void persist("draft")}
            type="button"
          >
            Save draft
          </button>
          <button
            className="cw-btn cw-btn-primary"
            data-testid="agent-builder-publish"
            disabled={busy || !draft.name.trim()}
            onClick={() => void publish()}
            type="button"
          >
            <CheckCircle2 size={14} /> Publish
          </button>
        </div>
      </footer>
    </div>
  );
}

export function AgentTemplatesGallery({
  workspaceId = "",
  ownerUserId = "",
}: {
  workspaceId?: string;
  ownerUserId?: string;
}) {
  const navigate = useNavigate();
  const enabled = isAgentsJobsEnabled();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);

  useEffect(() => {
    ensureSystemTemplatesSeeded();
    setTemplates(listTemplates());
  }, []);

  if (!enabled) {
    return (
      <div className="ag-builder" data-testid="agent-templates-disabled">
        <p>Templates are hidden while Agents jobs are off.</p>
      </div>
    );
  }

  return (
    <div className="ag-builder" data-testid="agent-templates">
      <div className="ag-builder-hero">
        <span className="ag-builder-icon" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <p className="ag-builder-kicker">Templates</p>
          <h1>Start from a job</h1>
          <p>Pick a template, then tune owns, triggers, and boundaries.</p>
        </div>
        <button
          className="cw-btn cw-btn-secondary"
          onClick={() => navigate("/agents/new")}
          type="button"
        >
          Blank agent
        </button>
      </div>
      <div className="ag-template-grid">
        {templates.map((template) => (
          <article className="ag-card ag-template-card" key={template.id}>
            <strong>{template.name}</strong>
            <p>{template.description}</p>
            <div className="ag-chips">
              {template.worksOn.map((chip) => (
                <span className="ag-chip-static" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
            <div className="ag-chips">
              {template.skillNames.map((skill) => (
                <span className="ag-chip-static is-skill" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            <button
              className="cw-btn cw-btn-primary cw-btn-sm"
              data-testid={`use-template-${template.id}`}
              onClick={() => {
                void (async () => {
                  if (workspaceId && ownerUserId) {
                    const provisioned = await provisionFromTemplate({
                      template,
                      workspaceId,
                      ownerUserId,
                    });
                    navigate(`/agents/${provisioned.definition.id}/setup`);
                    return;
                  }
                  navigate(`/agents/new?template=${encodeURIComponent(template.id)}`);
                })();
              }}
              type="button"
            >
              Use template
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
