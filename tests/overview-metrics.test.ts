import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  buildProjectOverview,
  countCompletedVsPriorMonth,
  isExecutableItem,
  itemStageForOverview,
  projectDateRange,
} from "../src/features/overview/useOverviewData";

function walk(dir: string, files: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) files.push(full);
  }
  return files;
}

test("overview feature is read-only (no Firestore writes)", () => {
  const root = join(process.cwd(), "src/features/overview");
  const files = walk(root);
  assert.ok(files.length > 0);
  const writeRe = /\b(addDoc|updateDoc|setDoc|deleteDoc|writeBatch|runTransaction)\b/;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(writeRe.test(src), false, `write API found in ${file}`);
  }
});

test("project date range falls back to item dates when project dates missing", () => {
  const range = projectDateRange(
    { id: "p1" },
    [
      { id: "t1", startDate: "2026-09-05", dueDate: "2026-09-20" },
      { id: "t2", dueDate: "2026-10-01" },
    ],
  );
  assert.equal(range.start, "2026-09-05");
  assert.equal(range.end, "2026-10-01");
  assert.ok(range.label);
});

test("overdue counts dueDate before today and excludes done", () => {
  const model = buildProjectOverview({
    project: { id: "p1", title: "Demo", deliveryStage: "build" },
    tasks: [
      { id: "1", title: "Open", status: "backlog", dueDate: "2026-01-01", workItemType: "task" },
      { id: "2", title: "Done", status: "done", dueDate: "2026-01-01", workItemType: "task" },
      { id: "3", title: "Future", status: "in_progress", dueDate: "2099-01-01", workItemType: "task" },
    ],
    now: new Date("2026-09-12T12:00:00Z"),
  });
  const overdue = model.kpis.find((k) => k.id === "overdue");
  assert.equal(overdue?.value, 1);
});

test("completed vs prior month hides when completedAt missing or prior month empty", () => {
  assert.equal(
    countCompletedVsPriorMonth(
      [{ status: "done", completedAt: null }],
      new Date("2026-09-12T12:00:00Z"),
    ).computable,
    false,
  );
  assert.equal(
    countCompletedVsPriorMonth(
      [{ status: "done", completedAt: "2026-09-01" }],
      new Date("2026-09-12T12:00:00Z"),
    ).computable,
    false,
  );
  const withPrior = countCompletedVsPriorMonth(
    [
      { status: "done", completedAt: "2026-08-10" },
      { status: "done", completedAt: "2026-08-12" },
      { status: "done", completedAt: "2026-09-02" },
      { status: "done", completedAt: "2026-09-03" },
      { status: "done", completedAt: "2026-09-04" },
    ],
    new Date("2026-09-12T12:00:00Z"),
  );
  assert.equal(withPrior.computable, true);
  assert.equal(withPrior.pct, 50);
});

test("MoM subtitle never shows +0%", () => {
  const model = buildProjectOverview({
    project: { id: "p1", title: "Demo", deliveryStage: "build" },
    tasks: [
      { id: "1", status: "done", completedAt: "2026-08-10", workItemType: "task" },
      { id: "2", status: "done", completedAt: "2026-09-02", workItemType: "task" },
    ],
    now: new Date("2026-09-12T12:00:00Z"),
  });
  const done = model.kpis.find((k) => k.id === "done");
  assert.equal(done?.subtitle, null);
});

test("blocked subtitle only when blocked > 0", () => {
  const withBlocked = buildProjectOverview({
    project: { id: "p1", title: "Demo", deliveryStage: "build" },
    tasks: [
      { id: "1", status: "blocked", dueDate: "2026-01-01", workItemType: "task" },
      { id: "2", status: "backlog", dueDate: "2026-01-02", workItemType: "task" },
    ],
    now: new Date("2026-09-12T12:00:00Z"),
  });
  assert.equal(
    withBlocked.kpis.find((k) => k.id === "overdue")?.subtitle,
    "1 bloqueado",
  );

  const without = buildProjectOverview({
    project: { id: "p1", title: "Demo", deliveryStage: "build" },
    tasks: [{ id: "1", status: "backlog", dueDate: "2026-01-01", workItemType: "task" }],
    now: new Date("2026-09-12T12:00:00Z"),
  });
  assert.equal(without.kpis.find((k) => k.id === "overdue")?.subtitle, null);
});

test("stage progress excludes epics and features", () => {
  assert.equal(isExecutableItem({ workItemType: "epic" }), false);
  assert.equal(isExecutableItem({ workItemType: "feature" }), false);
  assert.equal(isExecutableItem({ workItemType: "task" }), true);

  const model = buildProjectOverview({
    project: { id: "p1", title: "Demo", deliveryStage: "build" },
    tasks: [
      {
        id: "e1",
        title: "Epic",
        workItemType: "epic",
        productPhase: "Development",
        startDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "in_progress",
      },
      {
        id: "t1",
        title: "Task",
        workItemType: "task",
        productPhase: "Development",
        status: "done",
      },
      {
        id: "t2",
        title: "Task 2",
        workItemType: "task",
        productPhase: "Development",
        status: "backlog",
      },
    ],
    now: new Date("2026-09-12T12:00:00Z"),
  });
  const build = model.roadmap.find((row) => row.stage === "build");
  assert.equal(build?.progressPct, 50);
});

test("item stage uses productPhase then project deliveryStage (2A)", () => {
  assert.equal(
    itemStageForOverview({ productPhase: "Discovery" }, { deliveryStage: "build" }),
    "onboarding",
  );
  assert.equal(
    itemStageForOverview({}, { deliveryStage: "deploy" }),
    "deploy",
  );
});

test("empty project shows zero tiles without subtitles and empty dated flag", () => {
  const model = buildProjectOverview({
    project: { id: "p1", title: "Empty", deliveryStage: "define" },
    tasks: [],
    milestones: [],
    now: new Date("2026-09-12T12:00:00Z"),
  });
  assert.equal(model.emptyDated, true);
  for (const kpi of model.kpis) {
    assert.equal(kpi.value, 0);
    assert.equal(kpi.subtitle, null);
  }
});

test("roadmap includes onboarding stage row", () => {
  const model = buildProjectOverview({
    project: { id: "p1", title: "Demo", deliveryStage: "build" },
    tasks: [],
  });
  assert.ok(model.roadmap.some((row) => row.stage === "onboarding"));
  assert.equal(model.roadmap.length, 5);
});
