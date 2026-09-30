import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  EMPTY_PROJECT_WIZARD_DRAFT,
  projectWizardDraftFromProject,
} from "../src/lib/delivereeSkills";
import { uiStore } from "../src/data/uiStore";

const root = resolve(import.meta.dirname, "..");

test("New project entry points open the short form; the wizard stays optional", () => {
  const shell = readFileSync(resolve(root, "src/components/DelivereeWorkspace.tsx"), "utf8");
  const host = readFileSync(resolve(root, "src/routes/ModalHost.tsx"), "utf8");
  const store = readFileSync(resolve(root, "src/data/uiStore.ts"), "utf8");
  const quick = readFileSync(resolve(root, "src/components/QuickProjectModal.tsx"), "utf8");

  assert.match(shell, /openQuickProject/);
  assert.match(shell, /uiStore\.openQuickProject/);
  assert.match(shell, /createQuickProject/);
  assert.match(shell, /ModalHost/);
  assert.match(host, /projectWizardIntent === "context"/);
  assert.match(host, /contextProject/);
  assert.match(host, /QuickProjectModal/);
  assert.match(host, /openProjectWizard\("create"\)/);
  assert.match(store, /projectWizardIntent/);
  assert.match(store, /openQuickProject/);

  assert.match(shell, /onNewProject=\{\(\) => openQuickProject\(\)\}/);
  assert.match(shell, /onCreateProject=\{\(\) => openQuickProject\(\)\}/);
  assert.match(shell, /onSelect: \(\) => openQuickProject\(\)/);
  assert.match(quick, /Project name/);
  assert.match(quick, /Start date/);
  assert.match(quick, /End date/);
  assert.match(quick, /Description/);
  assert.match(quick, /Use the wizard/);
  assert.match(shell, /startDate/);
  assert.match(shell, /endDate,/);
  assert.match(shell, /dueDate: endDate/);
  assert.match(shell, /createdFromSkill: "quick_project"/);
  assert.doesNotMatch(
    shell.slice(shell.indexOf("const createQuickProject"), shell.indexOf("const createProjectFromWizard")),
    /addProjectTask|boldi_conversations/,
  );

  // Odysseus "update project" / action menu, and the skills list, keep the wizard.
  assert.match(shell, /openProjectWizard\("context"\)/);
  assert.equal((shell.match(/openProjectWizard\("context"\)/g) || []).length, 2);
  assert.match(shell, /openProjectWizard\("create"\)/);
});

test("uiStore openProjectWizard defaults to create intent", () => {
  uiStore.closeProjectWizard();
  uiStore.closeMagicProject();
  uiStore.openProjectWizard();
  assert.equal(uiStore.getSnapshot().projectWizardOpen, true);
  assert.equal(uiStore.getSnapshot().projectWizardIntent, "create");
  uiStore.openProjectWizard("context");
  assert.equal(uiStore.getSnapshot().projectWizardIntent, "context");
  uiStore.closeProjectWizard();
  assert.equal(uiStore.getSnapshot().projectWizardOpen, false);
});

test("wizard draft reset keys on project id so snapshot identity churn keeps typed draft", () => {
  const source = readFileSync(resolve(root, "src/components/ProjectWizardSkill.tsx"), "utf8");

  assert.match(source, /activeProjectRef/);
  assert.match(source, /const activeProjectId = activeProject\?\.id \|\| ""/);
  assert.match(source, /}, \[activeProjectId, isOpen\]\);/);
  assert.doesNotMatch(source, /}, \[activeProject, isOpen\]\);/);

  const snapA = {
    id: "proj-kruops",
    title: "KruOps",
    outcome: "Run ops",
    description: "why",
    methodology: "Hybrid",
    projectManager: "Regina",
    targetDate: "2026-10-01",
    successCriteria: ["a"],
  };
  const snapB = { ...snapA };
  assert.notEqual(snapA, snapB);
  assert.equal(snapA.id, snapB.id);
  assert.deepEqual(projectWizardDraftFromProject(snapA), projectWizardDraftFromProject(snapB));

  const typed = {
    ...projectWizardDraftFromProject(snapA),
    title: "COMPENSAR PAC DE APEX",
  };
  const resetKeySame = (snapA.id || "") === (snapB.id || "");
  const draftAfterIdentityChurn = resetKeySame ? typed : projectWizardDraftFromProject(snapB);
  assert.equal(draftAfterIdentityChurn.title, "COMPENSAR PAC DE APEX");
  assert.notDeepEqual(draftAfterIdentityChurn, EMPTY_PROJECT_WIZARD_DRAFT);
});
