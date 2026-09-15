import assert from "node:assert/strict";
import test from "node:test";
import {
  getManifest,
  GUIDED_MANIFESTS,
  weekOfIso,
  weekLabel,
} from "../src/lib/routines";
import { prepareRitualData } from "../src/lib/routines/prepare";
import { formatSemanticBlock, getBlocks } from "../src/lib/semanticBlocks";
import { buildHomeCockpitData } from "../src/features/home/buildHomeCockpitData";

test("guided manifests cover WRAP, Plan and Close Day", () => {
  assert.equal(GUIDED_MANIFESTS.length, 3);
  const wrap = getManifest("wrap-review");
  const plan = getManifest("weekly-plan");
  const close = getManifest("close-day");
  assert.ok(wrap);
  assert.ok(plan);
  assert.ok(close);
  assert.equal(wrap!.class, "guided");
  assert.equal(plan!.chainsTo, undefined);
  assert.equal(wrap!.chainsTo, "weekly-plan");
  assert.equal(close!.estimatedMinutes, 2);
  const types = new Set(
    [...wrap!.steps, ...plan!.steps, ...close!.steps].flatMap((s) =>
      s.cards.map((c) => c.type),
    ),
  );
  for (const needed of [
    "ItemTriage",
    "Finding",
    "MetricStrip",
    "Reflection",
    "GoalComposer",
    "TimeBlocks",
    "Capacity",
    "Summary",
    "Choice",
    "EnergyTag",
  ]) {
    assert.ok(types.has(needed as any), `missing card ${needed}`);
  }
});

test("prepare gathers win signals and undone items deterministically", () => {
  const prepared = prepareRitualData(
    ["undone_items", "done_items", "win_signals", "metrics" as any],
    {
      userId: "u1",
      now: new Date("2026-09-11T12:00:00"),
      tasks: [
        {
          id: "a",
          title: "Open",
          status: "open",
          assigneeIds: ["u1"],
          dueDate: "2026-09-10",
        },
        {
          id: "b",
          title: "Done epic",
          status: "done",
          workItemType: "epic",
          assigneeIds: ["u1"],
          dueDate: "2026-09-09",
          completedAt: "2026-09-09",
        },
      ],
      projects: [],
      routineRuns: [{ id: "r1", status: "completed", finishedAt: "2026-09-10" }],
    },
  );
  assert.ok(Array.isArray(prepared.undone_items));
  assert.ok(Array.isArray(prepared.win_signals));
  assert.ok((prepared.win_signals as any[]).length >= 1);
});

test("WRAP semantic blocks round-trip", () => {
  const md = [
    formatSemanticBlock("wins", "- Cerraste la épica"),
    formatSemanticBlock("resultados", "Planeado 10, hecho 7"),
    formatSemanticBlock("alineacion", "4/5 — cerca"),
    formatSemanticBlock("metas", "- Ship pricing"),
    formatSemanticBlock("tiempo_protegido", "- lun 09:00–11:00 Foco"),
  ].join("\n\n");
  const blocks = getBlocks(md);
  assert.equal(blocks.length, 5);
  assert.ok(blocks.some((b) => b.type === "wins"));
  assert.ok(blocks.some((b) => b.type === "tiempo_protegido"));
});

test("Home action queue surfaces ready ritual sessions", () => {
  const model = buildHomeCockpitData({
    userName: "Alejandro",
    actor: { userId: "u1", email: "a@x.com", aliases: [] },
    locale: "es",
    now: new Date("2026-09-12T17:00:00"),
    projects: [],
    tasks: [],
    routineSessions: [
      {
        id: "s1",
        recipeId: "wrap-review",
        status: "ready",
        estimatedMinutes: 12,
        weekOf: weekOfIso(new Date("2026-09-12")),
      },
    ],
  });
  assert.ok(model.actions.some((a) => a.kind === "routine_session"));
  assert.match(model.actions[0].title, /WRAP Review/);
  assert.equal(model.actions[0].actionLabel, "start");
});

test("week label helpers", () => {
  assert.match(weekLabel("2026-W37", "es"), /Semana 37/);
});
