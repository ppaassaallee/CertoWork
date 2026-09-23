import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  WRAP_REVIEW_MANIFEST,
  WEEKLY_PLAN_MANIFEST,
} from "../src/lib/routines/guided";
import { buildFlowFromManifest, buildFlowFromPlan } from "../src/lib/routines/flowBuild";
import { compileRoutineSentence } from "../src/lib/routines/compile";
import { isAgentsMapEnabled } from "../src/features/agentsMap/agentsMapFlag";

test("WRAP Review flow has trigger, prepare, steps, chain decision, deliver", () => {
  const model = buildFlowFromManifest(WRAP_REVIEW_MANIFEST);
  const types = model.nodes.map((node) => node.type);
  assert.equal(types[0], "trigger");
  assert.equal(types[1], "prepare");
  assert.ok(types.includes("decision"));
  assert.equal(types[types.length - 1], "deliver");
  assert.ok(model.nodes.length >= 8);
  const wins = model.nodes.find((node) => node.sourceStepId === "wins");
  assert.ok(wins);
  assert.match(wins!.title, /celebrar/i);
});

test("weekly plan flow builds without chain decision", () => {
  const model = buildFlowFromManifest(WEEKLY_PLAN_MANIFEST);
  assert.equal(
    model.nodes.some((node) => node.type === "decision"),
    false,
  );
  assert.ok(model.nodes.some((node) => node.sourceStepId === "metas"));
});

test("compileRoutineSentence persists a plan with node ids", () => {
  const result = compileRoutineSentence({
    sentence:
      "Cada mañana a las 7 enviame un brief por correo y propon actualizaciones de ítems",
    scope: { entityType: "portfolio", entityId: null, entityTitle: "Portafolio" },
    ownerEmail: "ana@certo.work",
  });
  assert.ok(Array.isArray(result.spec.plan));
  assert.ok((result.spec.plan || []).length >= 4);
  assert.ok((result.spec.plan || []).some((node) => node.id === "deliver"));
  assert.ok((result.spec.plan || []).some((node) => node.id === "decision:editItems"));
});

test("automatic plan builder includes editItems decision and email deliver", () => {
  const model = buildFlowFromPlan({
    title: "Brief matutino",
    goal: "Resumen de la mañana",
    sentence: "Brief matutino",
    trigger: {
      kind: "schedule",
      human: "Lun-Vie 07:00",
      cron: "0 7 * * 1-5",
      timezone: "UTC",
    },
    deliverable: {
      channel: "email",
      to: ["owner@certo.work"],
      format: "short",
      language: "es",
    },
    permissions: {
      readCerto: "always",
      writeOwner: "always",
      editItems: "ask",
      writeOthers: "never",
      approvedActionTypes: [],
    },
  });
  assert.ok(model.nodes.some((node) => node.id === "decision:editItems"));
  assert.match(
    model.nodes.find((node) => node.type === "deliver")!.title,
    /Correo/,
  );
});

test("Rutinas no longer opens on the aggregate map by default", () => {
  assert.equal(isAgentsMapEnabled(), false);
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const home = readFileSync(resolve("src/components/routines/RoutinesHome.tsx"), "utf8");
  assert.match(workspace, /centerView === "routines"/);
  assert.match(workspace, /<RoutinesHome/);
  assert.doesNotMatch(
    workspace.slice(
      workspace.indexOf('centerView === "routines"'),
      workspace.indexOf('centerView === "agents"'),
    ),
    /initialTab="map"/,
  );
  assert.match(home, /t\("routinesMy"\)/);
  assert.match(home, /FlowMini/);
  assert.match(home, /RoutineDetail/);
  assert.match(workspace, /Ver flujo de/);
});
