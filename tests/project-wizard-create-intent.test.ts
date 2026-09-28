import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  EMPTY_PROJECT_WIZARD_DRAFT,
  projectWizardDraftFromProject,
} from "../src/lib/delivereeSkills";

const root = resolve(import.meta.dirname, "..");

test("New project entry points open wizard in create mode without conversation project", () => {
  const shell = readFileSync(resolve(root, "src/components/DelivereeWorkspace.tsx"), "utf8");

  assert.match(shell, /projectWizardIntent/);
  assert.match(shell, /openProjectWizard/);
  assert.match(
    shell,
    /activeProject=\{projectWizardIntent === "context" \? routeOrPrimaryProject : null\}/,
  );

  // Create / New project surfaces must not reuse the conversation's project.
  assert.match(shell, /onNewProject=\{\(\) => openProjectWizard\("create"\)\}/);
  assert.match(shell, /onCreateProject=\{\(\) => openProjectWizard\("create"\)\}/);
  assert.match(shell, /onSelect: \(\) => openProjectWizard\("create"\)/);
  assert.match(shell, /onClick=\{\(\) => openProjectWizard\("create"\)\}/);

  // Odysseus "update project" / action menu keep context mode.
  assert.match(shell, /openProjectWizard\("context"\)/);
  assert.equal((shell.match(/openProjectWizard\("context"\)/g) || []).length, 2);
});

test("wizard draft reset keys on project id so snapshot identity churn keeps typed draft", () => {
  const source = readFileSync(resolve(root, "src/components/ProjectWizardSkill.tsx"), "utf8");

  assert.match(source, /activeProjectRef/);
  assert.match(source, /const activeProjectId = activeProject\?\.id \|\| ""/);
  assert.match(source, /}, \[activeProjectId, isOpen\]\);/);
  assert.doesNotMatch(source, /}, \[activeProject, isOpen\]\);/);

  // Same id, different object identity → same seed; a reset keyed on id alone
  // therefore does not wipe a user edit that happened after the first seed.
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
  const snapB = { ...snapA }; // new object, same id (Firestore republish)
  assert.notEqual(snapA, snapB);
  assert.equal(snapA.id, snapB.id);
  assert.deepEqual(projectWizardDraftFromProject(snapA), projectWizardDraftFromProject(snapB));

  const typed = {
    ...projectWizardDraftFromProject(snapA),
    title: "COMPENSAR PAC DE APEX",
  };
  // Simulates the effect guard: id unchanged → keep typed draft rather than re-seed.
  const resetKeySame = (snapA.id || "") === (snapB.id || "");
  const draftAfterIdentityChurn = resetKeySame ? typed : projectWizardDraftFromProject(snapB);
  assert.equal(draftAfterIdentityChurn.title, "COMPENSAR PAC DE APEX");
  assert.notDeepEqual(draftAfterIdentityChurn, EMPTY_PROJECT_WIZARD_DRAFT);
});
