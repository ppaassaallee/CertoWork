import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  computeMapHealth,
  consecutiveFailures,
  hasLoop,
  successRate,
} from "../src/features/agentsMap/mapHealth";
import { buildAgentsMapModel } from "../src/features/agentsMap/buildAgentsMapModel";
import type { RoutineSpec } from "../src/lib/routines";

function walk(dir: string, files: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

test("agents map feature derives health without Firestore writes in map modules", () => {
  const root = join(process.cwd(), "src/features/agentsMap");
  const files = walk(root).filter((file) => !file.endsWith("AgentsArea.tsx"));
  const writeRe = /\b(addDoc|updateDoc|setDoc|deleteDoc|writeBatch)\b/;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    // AgentsArea may call allowRoutineWriteOthers (user action); map view itself must not embed writes
    if (file.endsWith("AgentsMapView.tsx") || file.endsWith("buildAgentsMapModel.ts") || file.endsWith("mapHealth.ts")) {
      assert.equal(writeRe.test(src), false, `unexpected write in ${file}`);
    }
  }
});

test("health thresholds: sana / degradada / fallando", () => {
  assert.equal(
    computeMapHealth({
      runs: Array.from({ length: 10 }, () => ({ status: "completed" })),
    }),
    "sana",
  );
  assert.equal(
    computeMapHealth({
      runs: [
        ...Array.from({ length: 8 }, () => ({ status: "completed" })),
        { status: "failed" },
        { status: "failed" },
      ],
    }),
    "degradada",
  );
  assert.equal(
    computeMapHealth({
      runs: [
        { status: "completed" },
        { status: "failed" },
        { status: "failed" },
        { status: "failed" },
      ],
    }),
    "fallando",
  );
  assert.equal(
    computeMapHealth({ runs: [{ status: "completed" }], failStreak: 3 }),
    "fallando",
  );
});

test("loop detection uses chainDepth >= 3", () => {
  assert.equal(hasLoop([{ chainDepth: 2 }]), false);
  assert.equal(hasLoop([{ chainDepth: 3 }]), true);
});

test("consecutive failures count from newest runs", () => {
  assert.equal(
    consecutiveFailures([
      { status: "failed", startedAt: "2026-09-12T10:00:00Z" },
      { status: "failed", startedAt: "2026-09-12T09:00:00Z" },
      { status: "completed", startedAt: "2026-09-12T08:00:00Z" },
    ]),
    2,
  );
});

test("successRate returns null without decided runs", () => {
  assert.equal(successRate([]), null);
  assert.equal(successRate([{ status: "completed" }, { status: "failed" }]), 50);
});

test("buildAgentsMapModel creates four layers from routines", () => {
  const routine = {
    id: "r1",
    workspaceId: "w1",
    ownerUserId: "u1",
    title: "Cazador de bloqueos",
    sentence: "x",
    scope: { entityType: "project", entityId: "p1", entityTitle: "RPA Sigma 7" },
    trigger: {
      kind: "event",
      eventType: "item.blocked",
      cooldownSeconds: 0,
      human: "Ítem bloqueado",
    },
    goal: "x",
    deliverable: { channel: "whatsapp", to: ["a@b.com"], format: "short", language: "es" },
    permissions: {
      readCerto: "always",
      writeOwner: "always",
      editItems: "ask",
      writeOthers: "ask",
      approvedActionTypes: [],
    },
    status: "active",
    nextRunAt: null,
    lastRunAt: null,
    lastRunStatus: null,
    stats: {
      runs30d: 9,
      success30d: 7,
      actions30d: 7,
      pending: 0,
      minutesSavedEstimate: 0,
      costUsd30d: 1.2,
    },
  } as RoutineSpec;

  const model = buildAgentsMapModel({
    routines: [routine],
    runsByRoutineId: {
      r1: [
        { id: "1", status: "completed", startedAt: "2026-09-12T10:00:00Z", usage: { durationMs: 41000, costUsd: 0.2 } },
        { id: "2", status: "failed", startedAt: "2026-09-12T11:00:00Z", usage: { durationMs: 41000, costUsd: 0.2 } },
      ],
    },
    workspaceName: "Pure AI",
    now: new Date("2026-09-12T12:00:00Z"),
  });

  assert.ok(model.nodes.some((node) => node.kind === "trigger"));
  assert.ok(model.nodes.some((node) => node.kind === "routine"));
  assert.ok(model.nodes.some((node) => node.kind === "agent"));
  assert.ok(model.nodes.some((node) => node.kind === "output" && node.label === "WhatsApp"));
  const whatsapp = model.nodes.find((node) => node.label === "WhatsApp");
  assert.equal(whatsapp?.meta.permissionMissing, true);
  assert.ok(model.edges.length > 0);
});
