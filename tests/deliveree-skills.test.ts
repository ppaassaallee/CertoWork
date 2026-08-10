import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVEREE_SKILLS,
  EMPTY_PROJECT_WIZARD_DRAFT,
  isProjectWizardInvocation,
  isProjectWizardReady,
  projectWizardDraftFromProject,
  projectWizardMissingFields,
  splitProjectWizardLines,
} from "../src/lib/delivereeSkills";

test("project wizard is registered as the first Certo Work skill", () => {
  assert.equal(DELIVEREE_SKILLS[0].id, "project_wizard");
  assert.ok(DELIVEREE_SKILLS[0].invocation.includes("/project wizard"));
  assert.ok(DELIVEREE_SKILLS[0].minimalInputs.includes("Outcome"));
});

test("project wizard blocks vague projects until minimum clarity exists", () => {
  const missing = projectWizardMissingFields(EMPTY_PROJECT_WIZARD_DRAFT);
  assert.ok(missing.includes("Project name"));
  assert.ok(missing.includes("Outcome"));
  assert.ok(missing.includes("First next action"));
  assert.equal(isProjectWizardReady(EMPTY_PROJECT_WIZARD_DRAFT), false);
});

test("project wizard accepts a complete guided project brief", () => {
  const draft = {
    title: "FieldOps Pilot",
    outcome: "Castillo Retail can run one complete technician assignment pilot.",
    why: "It proves the operating model before expanding scope.",
    methodology: "Hybrid" as const,
    owner: "Alejandro",
    targetDate: "2026-09-15",
    noTargetDate: false,
    firstMilestone: "Pilot scope approved",
    firstAction: "Schedule the pilot scope gate with operations and engineering.",
    successCriteriaText: "Pilot journey completed\nOwner can see status\nDeployment evidence is captured",
    definitionOfDone: "The pilot is reviewed, documented, and ready for a go/no-go decision.",
  };
  assert.deepEqual(projectWizardMissingFields(draft), []);
  assert.equal(isProjectWizardReady(draft), true);
  assert.deepEqual(splitProjectWizardLines(draft.successCriteriaText), [
    "Pilot journey completed",
    "Owner can see status",
    "Deployment evidence is captured",
  ]);
});

test("project wizard can prefill from an existing project", () => {
  const draft = projectWizardDraftFromProject({
    title: "KruOps",
    objective: "Launch controlled marketplace foundation.",
    description: "Enable traceable delivery.",
    methodology: "Scrum",
    projectManager: "Team Ops",
    targetDate: "2026-10-01",
    successCriteria: ["Requirements mapped", "Backlog approved"],
    definitionOfDone: "Traceability and delivery controls are live.",
  });
  assert.equal(draft.title, "KruOps");
  assert.equal(draft.methodology, "Scrum");
  assert.equal(draft.successCriteriaText, "Requirements mapped\nBacklog approved");
});

test("project wizard recognizes direct invocations", () => {
  assert.equal(isProjectWizardInvocation("/project wizard"), true);
  assert.equal(isProjectWizardInvocation("Project Wizard for KruOps"), true);
  assert.equal(isProjectWizardInvocation("help me plan today"), false);
});
