import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  buildDryRunPreview,
  compileRoutineSentence,
  computeNextRunAt,
  recipesForEntity,
  relativeNextRunLabel,
  ROUTINE_RECIPES,
  routineStatusTone,
} from "../src/lib/routines";

test("curated recipes cover project and portfolio", () => {
  assert.ok(ROUTINE_RECIPES.length >= 5);
  assert.ok(recipesForEntity("project").some((recipe) => recipe.id === "brief-matutino"));
  assert.ok(recipesForEntity("portfolio").some((recipe) => recipe.id === "pulso-portafolio"));
  assert.ok(recipesForEntity("invoice").some((recipe) => recipe.id === "cobranza-factura"));
});

test("compiler turns a morning brief sentence into a weekday schedule card", () => {
  const result = compileRoutineSentence({
    sentence: "Cada mañana de lunes a viernes a las 7 resumime este proyecto para mí por correo",
    scope: { entityType: "project", entityId: "p1", entityTitle: "RPA Sigma 7" },
    ownerEmail: "alejandro@example.com",
    timezone: "America/Guatemala",
  });
  assert.equal(result.spec.trigger.kind, "schedule");
  if (result.spec.trigger.kind === "schedule") {
    assert.match(result.spec.trigger.cron, /1-5/);
    assert.equal(result.spec.trigger.timezone, "America/Guatemala");
  }
  assert.equal(result.spec.deliverable.channel, "email");
  assert.deepEqual(result.spec.deliverable.to, ["alejandro@example.com"]);
  assert.equal(result.spec.permissions.writeOthers, "never");
  assert.equal(result.spec.status, "draft");
  assert.equal(result.questions.length, 0);
});

test("compiler asks once when the deliverable is for a client", () => {
  const result = compileRoutineSentence({
    sentence: "Cada viernes a las 16 prepará un borrador de correo al cliente con el avance",
    scope: { entityType: "project", entityId: "p1", entityTitle: "RPA" },
    ownerEmail: "alejandro@example.com",
  });
  assert.equal(result.spec.permissions.writeOthers, "ask");
  assert.equal(result.questions.length, 1);
  assert.match(result.questions[0].prompt, /correo/i);
});

test("blocked event sentences become event triggers", () => {
  const result = compileRoutineSentence({
    sentence: "Cuando un ítem se bloquee, avisame por correo con el motivo",
    scope: { entityType: "project", entityId: "p1" },
  });
  assert.equal(result.spec.trigger.kind, "event");
  if (result.spec.trigger.kind === "event") {
    assert.equal(result.spec.trigger.eventType, "item.blocked");
  }
});

test("dry-run preview lists read/think/draft/deliver steps", () => {
  const preview = buildDryRunPreview({
    goal: "Brief matutino",
    scopeTitle: "RPA Sigma 7",
    entityType: "project",
    itemCount: 14,
    blockedCount: 2,
    overdueCount: 1,
  });
  assert.match(preview.text, /RPA Sigma 7/);
  assert.equal(preview.steps.length, 4);
  assert.equal(preview.steps[0].kind, "read");
  assert.equal(preview.steps[3].kind, "deliver");
});

test("schedule helper computes a future weekday morning slot", () => {
  const from = new Date("2026-09-14T12:00:00.000Z"); // Monday
  const next = computeNextRunAt("0 7 * * 1-5", "America/Guatemala", from);
  assert.ok(next);
  assert.ok(next.getTime() > from.getTime());
  assert.match(relativeNextRunLabel(next.toISOString(), from), /en /);
  assert.equal(routineStatusTone("active"), "green");
  assert.equal(routineStatusTone("failing"), "red");
});

test("invoice recipes exist for cobranza", () => {
  assert.ok(recipesForEntity("invoice").some((recipe) => recipe.id === "cobranza-factura"));
  assert.ok(recipesForEntity("task").some((recipe) => recipe.id === "item-pulse"));
  assert.ok(recipesForEntity("request").some((recipe) => recipe.id === "seguimiento-request"));
  assert.ok(recipesForEntity("note").some((recipe) => recipe.id === "nota-a-estado"));
});

test("project and portfolio surfaces expose the Rutina entry points", () => {
  const chrome = readFileSync(
    new URL("../src/features/projects/chrome/ProjectPageChrome.tsx", import.meta.url),
    "utf8",
  );
  const surfaces = readFileSync(
    new URL("../src/components/ProjectSurfaces.tsx", import.meta.url),
    "utf8",
  );
  const composer = readFileSync(
    new URL("../src/components/routines/RoutineComposer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(chrome, /project-routine-button/);
  assert.match(chrome, /Rutina/);
  assert.match(surfaces, /useRoutineHost/);
  assert.match(surfaces, /portfolio-routine-button/);
  assert.match(surfaces, /✦ Rutina/);
  assert.match(composer, /routine-compiled-card/);
  assert.match(composer, /Probar ahora/);
  assert.match(composer, /Activar/);
});

test("Phase 2+ surfaces: /rutinas, Agents Rutinas, event outbox, everywhere entry", () => {
  const home = readFileSync(
    new URL("../src/components/routines/RoutinesHome.tsx", import.meta.url),
    "utf8",
  );
  const agents = readFileSync(
    new URL("../src/components/agents/AgentsLibrary.tsx", import.meta.url),
    "utf8",
  );
  const chrome = readFileSync(
    new URL("../src/features/projects/chrome/ProjectPageChrome.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const items = readFileSync(
    new URL("../src/components/WorkItemsCenter.tsx", import.meta.url),
    "utf8",
  );
  const events = readFileSync(new URL("../src/lib/routines/events.ts", import.meta.url), "utf8");
  const scheduler = readFileSync(new URL("../worker/routinesScheduler.js", import.meta.url), "utf8");
  assert.match(home, /routine-analytics/);
  assert.match(agents, /agents-routines/);
  assert.match(agents, /Rutinas/);
  assert.match(css, /overflow: visible/);
  assert.match(chrome, /<span>Rutina<\/span>/);
  assert.match(items, /item-routine-button/);
  assert.match(events, /emitDomainEvent/);
  assert.match(scheduler, /processEventOutbox/);
});
