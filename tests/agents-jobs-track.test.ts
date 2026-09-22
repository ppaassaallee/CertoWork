import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTestRunPlan,
  createAgentRun,
  listActiveRunsForItem,
  resetAgentStoreMemory,
  saveAgentFromBuilder,
} from "../src/lib/agent-platform/agentStore";
import {
  ensureSystemTemplatesSeeded,
  SYSTEM_AGENT_TEMPLATES,
} from "../src/lib/agent-platform/agentTemplates";
import {
  clearTriggerRegistry,
  emitItemEvent,
  registerTrigger,
  triggerMatchesEvent,
} from "../src/lib/agent-platform/itemEvents";
import {
  bindAgentSchedule,
  clearScheduleBindings,
  hermesScheduleRuntimeEnabled,
} from "../src/lib/agent-platform/scheduleBridge";
import {
  parseAgentMentions,
  startRunOnAgentAssign,
} from "../src/lib/agent-platform/assignMention";
import { assertAgentReach, grantsFromVersion } from "../src/lib/agent-platform/reach";
import { provisionFromTemplate } from "../src/lib/agent-platform/agentStore";

test("builder save creates definition, version, and triggers", async () => {
  resetAgentStoreMemory();
  const saved = await saveAgentFromBuilder({
    workspaceId: "ws1",
    ownerUserId: "u1",
    name: "Risk Watcher",
    owns: "Delivery risk",
    outcome: "No slips",
    instructions: "Watch dates",
    skills: ["Risk detection"],
    modelTier: "balanced",
    status: "published",
    canDo: ["read", "post_update"],
    mustAsk: ["change_state"],
    triggers: {
      assignment: true,
      mention: true,
      workItemChanges: true,
      schedule: false,
      events: ["state_changed"],
      cron: "0 8 * * 1-5",
      timezone: "UTC",
    },
  });
  assert.equal(saved.definition.status, "published");
  assert.equal(saved.version.owns, "Delivery risk");
  assert.ok(saved.triggers.length >= 2);
  assert.equal(saved.version.actionPolicy.change_state, "ask");
});

test("test run plan never claims execution", () => {
  const plan = buildTestRunPlan({
    agentName: "Spec",
    itemId: "item-1",
    mustAsk: ["create_item"],
    instructions: "Structure it",
  });
  assert.ok(plan.some((step) => /dry run/i.test(step)));
});

test("system templates cover standup through checkpoint", () => {
  ensureSystemTemplatesSeeded();
  assert.ok(SYSTEM_AGENT_TEMPLATES.length >= 9);
  assert.ok(SYSTEM_AGENT_TEMPLATES.some((t) => t.id === "tmpl-standup"));
  assert.ok(SYSTEM_AGENT_TEMPLATES.some((t) => t.id === "tmpl-checkpoint-chaser"));
});

test("assign agent creates running record with step label", async () => {
  resetAgentStoreMemory();
  const saved = await saveAgentFromBuilder({
    workspaceId: "ws1",
    ownerUserId: "u1",
    name: "Spec Agent",
    owns: "Specs",
    outcome: "Clear AC",
    instructions: "Structure",
    skills: [],
    modelTier: "deep",
    status: "published",
    canDo: ["read"],
    mustAsk: ["post_update"],
    triggers: {
      assignment: true,
      mention: false,
      workItemChanges: false,
      schedule: false,
      events: [],
      cron: "",
      timezone: "UTC",
    },
  });
  const run = await startRunOnAgentAssign({
    workspaceId: "ws1",
    assigneeId: `agent:${saved.definition.id}`,
    itemId: "item-9",
    itemTitle: "Write AC",
  });
  assert.ok(run);
  assert.equal(run?.status, "running");
  assert.ok(run?.currentStepLabel);
  assert.equal(listActiveRunsForItem("item-9").length, 1);
});

test("mention parser finds @Agent ids", () => {
  const ids = parseAgentMentions("Hey @[agent:ag1] and @SpecAgent please", [
    { id: "agent:ag1", name: "Linker" },
    { id: "ag2", name: "SpecAgent" },
  ]);
  assert.ok(ids.includes("ag1"));
  assert.ok(ids.includes("ag2"));
});

test("domain event trigger honors cooldown and loop guard", async () => {
  resetAgentStoreMemory();
  clearTriggerRegistry();
  const saved = await saveAgentFromBuilder({
    workspaceId: "ws1",
    ownerUserId: "u1",
    name: "Risk",
    owns: "Risk",
    outcome: "Flag",
    instructions: "x",
    skills: [],
    modelTier: "fast",
    status: "published",
    canDo: ["read"],
    mustAsk: [],
    triggers: {
      assignment: false,
      mention: false,
      workItemChanges: true,
      schedule: false,
      events: ["state_changed"],
      cron: "",
      timezone: "UTC",
    },
  });
  const trigger = {
    id: "tr-test",
    workspaceId: "ws1",
    agentId: saved.definition.id,
    agentVersionId: saved.version.id,
    type: "domain_event" as const,
    enabled: true,
    events: ["state_changed" as const],
    cooldownSeconds: 60,
  };
  registerTrigger(trigger);
  assert.equal(
    triggerMatchesEvent(trigger, {
      workspaceId: "ws1",
      itemId: "i1",
      type: "state_changed",
      at: new Date().toISOString(),
    }),
    true,
  );
  const first = await emitItemEvent({
    workspaceId: "ws1",
    itemId: "i1",
    type: "state_changed",
    at: new Date().toISOString(),
  });
  assert.equal(first.length, 1);
  const second = await emitItemEvent({
    workspaceId: "ws1",
    itemId: "i1",
    type: "state_changed",
    at: new Date().toISOString(),
  });
  assert.equal(second.length, 0, "cooldown blocks duplicate");
  const loop = await emitItemEvent({
    workspaceId: "ws1",
    itemId: "i2",
    type: "state_changed",
    at: new Date().toISOString(),
    causedByAgentId: saved.definition.id,
  });
  assert.equal(loop.length, 0, "same agent cannot retrigger itself");
});

test("schedule binds to exactly one backend", () => {
  clearScheduleBindings();
  assert.equal(hermesScheduleRuntimeEnabled({}), false);
  const binding = bindAgentSchedule(
    {
      id: "tr-sched",
      workspaceId: "ws",
      agentId: "ag",
      agentVersionId: "v1",
      type: "schedule",
      enabled: true,
      schedule: "0 8 * * 1-5",
      timezone: "UTC",
    },
    {},
  );
  assert.equal(binding.mode, "routines");
  const hermes = bindAgentSchedule(
    {
      id: "tr-sched-h",
      workspaceId: "ws",
      agentId: "ag",
      agentVersionId: "v1",
      type: "schedule",
      enabled: true,
      schedule: "0 8 * * 1-5",
    },
    { CERTO_HERMES_RUNTIME: "1" },
  );
  assert.equal(hermes.mode, "hermes");
  assert.ok(hermes.hermesJobId);
});

test("reach denies project outside dataAccess", () => {
  assert.throws(
    () =>
      assertAgentReach({
        workspaceId: "ws1",
        agentWorkspaceId: "ws1",
        resourceWorkspaceId: "ws1",
        grants: [{ resource: "projects:p1", mode: "read" }],
        resource: "projects:p2",
      }),
    /REACH_DENIED/,
  );
});

test("template provision creates draft agent", async () => {
  resetAgentStoreMemory();
  ensureSystemTemplatesSeeded();
  const template = SYSTEM_AGENT_TEMPLATES[0];
  const provisioned = await provisionFromTemplate({
    template,
    workspaceId: "ws1",
    ownerUserId: "u1",
  });
  assert.equal(provisioned.definition.status, "draft");
  assert.ok(provisioned.version.instructions);
  assert.ok(grantsFromVersion(provisioned.version).length >= 1);
});

test("createAgentRun stores finding labels for chips", async () => {
  resetAgentStoreMemory();
  const run = await createAgentRun({
    workspaceId: "ws1",
    agentId: "ag",
    agentVersionId: "v1",
    triggerType: "domain_event",
    inputSummary: "slip",
    context: { itemId: "i9" },
    currentStepLabel: "Checking dates…",
  });
  assert.equal(run.currentStepLabel, "Checking dates…");
});
