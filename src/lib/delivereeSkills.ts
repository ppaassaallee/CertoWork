export type DelivereeSkillId = "project_wizard";

export type ProjectMethodology = "Scrum" | "PMI" | "Hybrid";

export type ProjectWizardMode = "create" | "update";

export type ProjectWizardDraft = {
  title: string;
  outcome: string;
  why: string;
  methodology: ProjectMethodology;
  owner: string;
  targetDate: string;
  noTargetDate: boolean;
  firstMilestone: string;
  firstAction: string;
  successCriteriaText: string;
  definitionOfDone: string;
};

export type ProjectWizardMissingField =
  | "Project name"
  | "Outcome"
  | "Why it matters"
  | "Method"
  | "Owner"
  | "Target date or no-date decision"
  | "First next action"
  | "Success criteria"
  | "Definition of done";

export type DelivereeSkillDefinition = {
  id: DelivereeSkillId;
  title: string;
  category: string;
  summary: string;
  invocation: string[];
  minimalInputs: ProjectWizardMissingField[];
};

export const DELIVEREE_SKILLS: DelivereeSkillDefinition[] = [
  {
    id: "project_wizard",
    title: "Project Wizard",
    category: "Project Management",
    summary:
      "Creates or updates a project only after the minimum useful setup is clear: outcome, owner, method, date decision, success criteria, and next action.",
    invocation: ["/project wizard", "project wizard", "new project", "setup project"],
    minimalInputs: [
      "Project name",
      "Outcome",
      "Why it matters",
      "Method",
      "Owner",
      "Target date or no-date decision",
      "First next action",
      "Success criteria",
      "Definition of done",
    ],
  },
];

export const EMPTY_PROJECT_WIZARD_DRAFT: ProjectWizardDraft = {
  title: "",
  outcome: "",
  why: "",
  methodology: "Hybrid",
  owner: "",
  targetDate: "",
  noTargetDate: false,
  firstMilestone: "",
  firstAction: "",
  successCriteriaText: "",
  definitionOfDone: "",
};

export function projectWizardDraftFromProject(project: any): ProjectWizardDraft {
  const successCriteria = Array.isArray(project?.successCriteria)
    ? project.successCriteria.join("\n")
    : String(project?.successCriteria || "");

  return {
    title: String(project?.title || project?.name || ""),
    outcome: String(project?.outcome || project?.objective || ""),
    why: String(project?.description || project?.why || ""),
    methodology: normalizeProjectMethodology(project?.methodology),
    owner: String(project?.projectManager || project?.owner || project?.assignee || ""),
    targetDate: String(project?.targetDate || project?.dueDate || "").slice(0, 10),
    noTargetDate: !project?.targetDate && !project?.dueDate,
    firstMilestone: "",
    firstAction: "",
    successCriteriaText: successCriteria,
    definitionOfDone: String(project?.definitionOfDone || ""),
  };
}

export function normalizeProjectMethodology(value: any): ProjectMethodology {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("scrum") || normalized.includes("agile")) return "Scrum";
  if (normalized.includes("pmi") || normalized.includes("waterfall")) return "PMI";
  return "Hybrid";
}

export function splitProjectWizardLines(value: string): string[] {
  return String(value || "")
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const PROJECT_WIZARD_OPTIONAL_FIELDS: readonly ProjectWizardMissingField[] = [
  "First next action",
];

export function projectWizardMissingFields(draft: ProjectWizardDraft): ProjectWizardMissingField[] {
  const missing: ProjectWizardMissingField[] = [];
  if (!draft.title.trim()) missing.push("Project name");
  if (!draft.outcome.trim()) missing.push("Outcome");
  if (!draft.why.trim()) missing.push("Why it matters");
  if (!draft.methodology) missing.push("Method");
  if (!draft.owner.trim()) missing.push("Owner");
  if (!draft.noTargetDate && !draft.targetDate.trim()) missing.push("Target date or no-date decision");
  if (!draft.firstAction.trim()) missing.push("First next action");
  if (splitProjectWizardLines(draft.successCriteriaText).length === 0) missing.push("Success criteria");
  if (!draft.definitionOfDone.trim()) missing.push("Definition of done");
  return missing;
}

export function projectWizardBlockingFields(draft: ProjectWizardDraft): ProjectWizardMissingField[] {
  return projectWizardMissingFields(draft).filter(
    (field) => !PROJECT_WIZARD_OPTIONAL_FIELDS.includes(field),
  );
}

export function defaultProjectWizardFirstAction(draft: ProjectWizardDraft): string {
  const explicit = draft.firstAction.trim();
  if (explicit) return explicit;
  const title = draft.title.trim();
  return title ? `Kick off ${title}` : "Define the first next action";
}

export function seedProjectWizardDraft(draft: ProjectWizardDraft): ProjectWizardDraft {
  return {
    ...draft,
    firstAction: defaultProjectWizardFirstAction(draft),
  };
}

export function isProjectWizardReady(draft: ProjectWizardDraft) {
  return projectWizardBlockingFields(draft).length === 0;
}

export function isProjectWizardInvocation(text: string) {
  const normalized = String(text || "").trim().toLowerCase();
  return /^\/?project wizard\b/.test(normalized) || /^\/?wizard project\b/.test(normalized);
}
