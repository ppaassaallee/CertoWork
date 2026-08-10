import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, FolderPlus, Sparkles, WandSparkles, X } from "lucide-react";
import {
  DELIVEREE_SKILLS,
  EMPTY_PROJECT_WIZARD_DRAFT,
  projectWizardDraftFromProject,
  projectWizardMissingFields,
  splitProjectWizardLines,
  type ProjectMethodology,
  type ProjectWizardDraft,
  type ProjectWizardMode,
} from "../lib/delivereeSkills";

type ProjectWizardSkillProps = {
  activeProject?: any | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (draft: ProjectWizardDraft) => Promise<void>;
  onUpdateProject: (projectId: string, draft: ProjectWizardDraft) => Promise<void>;
  projects: any[];
};

const methodHelp: Record<ProjectMethodology, string> = {
  Scrum: "Best when the team will work through epics, PBIs, sprints, reviews, and changing requirements.",
  PMI: "Best when scope, governance, risks, dates, owners, and formal delivery gates matter most.",
  Hybrid: "Best default: enough structure for control, flexible enough for product discovery.",
};

function projectTitle(project: any) {
  return String(project?.title || project?.name || "Untitled project");
}

export function ProjectWizardSkill({
  activeProject,
  isOpen,
  onClose,
  onCreateProject,
  onUpdateProject,
  projects,
}: ProjectWizardSkillProps) {
  const [mode, setMode] = useState<ProjectWizardMode>("create");
  const [projectId, setProjectId] = useState("");
  const [draft, setDraft] = useState<ProjectWizardDraft>(EMPTY_PROJECT_WIZARD_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const skill = DELIVEREE_SKILLS[0];

  useEffect(() => {
    if (!isOpen) return;
    const nextMode = activeProject ? "update" : "create";
    setMode(nextMode);
    setProjectId(activeProject?.id || "");
    setDraft(activeProject ? projectWizardDraftFromProject(activeProject) : EMPTY_PROJECT_WIZARD_DRAFT);
    setError("");
  }, [activeProject, isOpen]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) || null,
    [projectId, projects],
  );

  const missing = projectWizardMissingFields(draft);
  const criteriaCount = splitProjectWizardLines(draft.successCriteriaText).length;

  if (!isOpen) return null;

  const update = (patch: Partial<ProjectWizardDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const selectProject = (id: string) => {
    const project = projects.find((item) => item.id === id);
    setProjectId(id);
    setDraft(project ? projectWizardDraftFromProject(project) : EMPTY_PROJECT_WIZARD_DRAFT);
  };

  const save = async () => {
    if (missing.length > 0 || saving) return;
    setSaving(true);
    setError("");
    try {
      if (mode === "update") {
        if (!selectedProject) throw new Error("Choose the project you want to update.");
        await onUpdateProject(selectedProject.id, draft);
      } else {
        await onCreateProject(draft);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Project Wizard could not save this project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div aria-label="Project Wizard Skill" aria-modal="true" className="do-skill-layer" role="dialog">
      <section className="do-skill-modal">
        <header className="do-skill-head">
          <div className="do-skill-title">
            <span><WandSparkles size={18} /></span>
            <div>
              <small>{skill.category} Skill</small>
              <h2>{skill.title}</h2>
              <p>{skill.summary}</p>
            </div>
          </div>
          <button aria-label="Close Project Wizard" onClick={onClose} type="button"><X size={18} /></button>
        </header>

        <div className="do-skill-body">
          <aside className="do-skill-readiness">
            <span className="do-kicker">Minimum project clarity</span>
            <h3>{missing.length === 0 ? "Ready to save" : `${missing.length} thing${missing.length === 1 ? "" : "s"} missing`}</h3>
            <p>
              This skill prevents vague projects by asking only the minimum needed to make the work usable by a team.
            </p>
            <div>
              {skill.minimalInputs.map((field) => {
                const done = !missing.includes(field);
                return (
                  <span className={done ? "is-done" : ""} key={field}>
                    {done ? <Check size={12} /> : <ChevronRight size={12} />}
                    {field}
                  </span>
                );
              })}
            </div>
          </aside>

          <main className="do-skill-form">
            <div className="do-skill-mode">
              <button
                className={mode === "create" ? "is-active" : ""}
                onClick={() => {
                  setMode("create");
                  setProjectId("");
                  setDraft(EMPTY_PROJECT_WIZARD_DRAFT);
                }}
                type="button"
              >
                <FolderPlus size={14} /> Create project
              </button>
              <button
                className={mode === "update" ? "is-active" : ""}
                disabled={projects.length === 0}
                onClick={() => {
                  setMode("update");
                  const project = activeProject || projects[0];
                  setProjectId(project?.id || "");
                  setDraft(project ? projectWizardDraftFromProject(project) : EMPTY_PROJECT_WIZARD_DRAFT);
                }}
                type="button"
              >
                <Sparkles size={14} /> Update project
              </button>
            </div>

            {mode === "update" && (
              <label className="do-skill-field">
                <span>Project to update</span>
                <select onChange={(event) => selectProject(event.target.value)} value={projectId}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{projectTitle(project)}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="do-skill-grid">
              <label className="do-skill-field">
                <span>Project name</span>
                <input
                  onChange={(event) => update({ title: event.target.value })}
                  placeholder="e.g. KruOps Marketplace"
                  value={draft.title}
                />
              </label>
              <label className="do-skill-field">
                <span>Method</span>
                <select
                  onChange={(event) => update({ methodology: event.target.value as ProjectMethodology })}
                  value={draft.methodology}
                >
                  <option value="Hybrid">Hybrid</option>
                  <option value="Scrum">Scrum</option>
                  <option value="PMI">PMI</option>
                </select>
                <small>{methodHelp[draft.methodology]}</small>
              </label>
            </div>

            <label className="do-skill-field">
              <span>What outcome must this project create?</span>
              <textarea
                onChange={(event) => update({ outcome: event.target.value })}
                placeholder="Describe the observable result, not the activity."
                value={draft.outcome}
              />
            </label>

            <label className="do-skill-field">
              <span>Why does it matter?</span>
              <textarea
                onChange={(event) => update({ why: event.target.value })}
                placeholder="Strategic value, user/customer need, risk avoided, or business result."
                value={draft.why}
              />
            </label>

            <div className="do-skill-grid">
              <label className="do-skill-field">
                <span>Accountable owner</span>
                <input
                  onChange={(event) => update({ owner: event.target.value })}
                  placeholder="Person accountable for delivery"
                  value={draft.owner}
                />
              </label>
              <label className="do-skill-field">
                <span>Target date</span>
                <input
                  disabled={draft.noTargetDate}
                  onChange={(event) => update({ targetDate: event.target.value, noTargetDate: false })}
                  type="date"
                  value={draft.noTargetDate ? "" : draft.targetDate}
                />
                <button
                  className={draft.noTargetDate ? "is-active" : ""}
                  onClick={() => update({ noTargetDate: !draft.noTargetDate, targetDate: "" })}
                  type="button"
                >
                  No date yet
                </button>
              </label>
            </div>

            <div className="do-skill-grid">
              <label className="do-skill-field">
                <span>First milestone</span>
                <input
                  onChange={(event) => update({ firstMilestone: event.target.value })}
                  placeholder="Optional, but useful"
                  value={draft.firstMilestone}
                />
              </label>
              <label className="do-skill-field">
                <span>First next action</span>
                <input
                  onChange={(event) => update({ firstAction: event.target.value })}
                  placeholder="Concrete first action the team can take"
                  value={draft.firstAction}
                />
              </label>
            </div>

            <label className="do-skill-field">
              <span>Success criteria</span>
              <textarea
                onChange={(event) => update({ successCriteriaText: event.target.value })}
                placeholder="One per line. Example: Pilot user can create and assign work orders."
                value={draft.successCriteriaText}
              />
              <small>{criteriaCount} success criteri{criteriaCount === 1 ? "on" : "a"} captured</small>
            </label>

            <label className="do-skill-field">
              <span>Definition of done</span>
              <textarea
                onChange={(event) => update({ definitionOfDone: event.target.value })}
                placeholder="What must be true before the project can be considered complete?"
                value={draft.definitionOfDone}
              />
            </label>

            {error && <p className="do-skill-error">{error}</p>}
          </main>
        </div>

        <footer className="do-skill-foot">
          <span>{missing.length === 0 ? "Looks solid. This can become real work now." : `Complete: ${missing.join(", ")}`}</span>
          <div>
            <button onClick={onClose} type="button">Cancel</button>
            <button disabled={missing.length > 0 || saving} onClick={save} type="button">
              {saving ? "Saving..." : mode === "update" ? "Update project" : "Create project"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
