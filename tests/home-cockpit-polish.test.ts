import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHomeCockpitData,
  homeProjectStatus,
  shortProjectName,
} from "../src/features/home/buildHomeCockpitData";

const actor = { userId: "u1", email: "a@x.com", aliases: [] as string[] };

test("short project names strip years and keep tooltip-length titles separate", () => {
  assert.equal(
    shortProjectName("RPA Banrural Carga BD 2024", { shortName: "RPA Banrural · Carga BD" }),
    "RPA Banrural · Carga BD",
  );
  assert.ok(shortProjectName("Very Long Client Name Project Delivery Initiative 2025").length <= 43);
});

test("past milestone cannot stay on track at 0%", () => {
  const now = new Date("2026-09-13T12:00:00");
  const status = homeProjectStatus(
    { dueDate: "2026-06-01", status: "active" },
    [],
    [],
    0,
    now,
    "es",
  );
  assert.equal(status.health, "at_risk");
  assert.equal(status.lineTone, "danger");
  assert.match(status.milestoneLabel, /vencido hace/);
});

test("Sunday editorial mentions tomorrow and overdue, never on-track 0%", () => {
  const sunday = new Date("2026-09-13T10:00:00"); // Sunday
  const model = buildHomeCockpitData({
    userName: "Alejandro Pascual",
    actor,
    locale: "es",
    now: sunday,
    projects: [
      { id: "p1", title: "KruOps", status: "active", dueDate: "2026-10-01" },
      { id: "p2", title: "Banrural", status: "active", dueDate: "2026-06-01" },
    ],
    tasks: [
      {
        id: "t1",
        title: "Wording",
        status: "open",
        assigneeIds: ["u1"],
        projectId: "p1",
        dueDate: "2026-09-14",
      },
      {
        id: "t2",
        title: "Old",
        status: "open",
        assigneeIds: ["u1"],
        projectId: "p2",
        dueDate: "2026-09-01",
      },
    ],
    reviewItems: [],
    accessRequests: [],
  });

  assert.match(model.greeting, /Buenos días, Alejandro\./);
  const prose = model.editorial.map((p) => p.text).join("");
  assert.match(prose, /Nada vence hoy/);
  assert.match(prose, /mañana/);
  assert.match(prose, /vencidos/);
  assert.doesNotMatch(prose, /on track|va en fecha/i);
  assert.equal(model.defaultItemTab, "overdue");
  assert.equal(model.overdueItems.length, 1);
  assert.equal(model.todayItems.length, 0);

  const banrural = model.projects.find((p) => /Banrural/i.test(p.title));
  assert.ok(banrural);
  assert.notEqual(banrural!.health, "on_track");
  assert.match(banrural!.line, /vencido/);
});

test("empty action queue counts stay available for collapsed line", () => {
  const model = buildHomeCockpitData({
    userName: "Alex",
    actor,
    locale: "en",
    now: new Date("2026-09-15T09:00:00"),
    projects: [],
    tasks: [],
  });
  assert.equal(model.actions.length, 0);
  assert.equal(model.actionCounts.approvals, 0);
  assert.equal(model.quietStats.length, 5);
});
