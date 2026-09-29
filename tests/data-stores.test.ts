import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createDocStore,
  sameDocSignature,
} from "../src/data/createDocStore";
import { resolveFirestoreListenPacks } from "../src/lib/firestoreListenDiet";

test("sameDocSignature ignores object identity when ids and stamps match", () => {
  const a = [
    { id: "1", updatedAt: 10, title: "A" },
    { id: "2", updatedAt: 20, title: "B" },
  ];
  const b = [
    { id: "1", updatedAt: 10, title: "A" },
    { id: "2", updatedAt: 20, title: "B" },
  ];
  assert.notEqual(a, b);
  assert.equal(sameDocSignature(a, b), true);
  assert.equal(
    sameDocSignature(a, [
      { id: "1", updatedAt: 11, title: "A" },
      { id: "2", updatedAt: 20, title: "B" },
    ]),
    false,
  );
});

test("doc store replaceAll is a no-op when signature is unchanged", () => {
  const store = createDocStore<{ id: string; updatedAt?: number; title?: string }>();
  let emits = 0;
  store.subscribe(() => {
    emits += 1;
  });
  store.replaceAll([
    { id: "p1", updatedAt: 1, title: "One" },
    { id: "p2", updatedAt: 2, title: "Two" },
  ]);
  assert.equal(emits, 1);
  assert.equal(store.getSnapshot().length, 2);
  store.replaceAll([
    { id: "p1", updatedAt: 1, title: "One" },
    { id: "p2", updatedAt: 2, title: "Two" },
  ]);
  assert.equal(emits, 1, "identical signature must not notify subscribers");
  store.replaceAll([
    { id: "p1", updatedAt: 3, title: "One*" },
    { id: "p2", updatedAt: 2, title: "Two" },
  ]);
  assert.equal(emits, 2);
  assert.equal(store.getSnapshot()[0].title, "One*");
});

test("data layer and Projects route are wired for store-backed portfolio", () => {
  const root = resolve(import.meta.dirname, "..");
  const index = readFileSync(resolve(root, "src/data/index.ts"), "utf8");
  const route = readFileSync(resolve(root, "src/routes/ProjectsRoute.tsx"), "utf8");
  const start = readFileSync(resolve(root, "src/data/startWorkspaceData.ts"), "utf8");
  assert.match(index, /startWorkspaceData/);
  assert.match(index, /useProjects/);
  assert.match(index, /uiStore/);
  assert.match(route, /useProjects\(\)/);
  assert.match(route, /useTasks\(\)/);
  assert.match(route, /ProjectCommandCenter/);
  assert.match(start, /projectsStore\.replaceAll/);
  assert.match(start, /tasksStore\.replaceAll/);
});

test("projects portfolio listen pack stays slim after store migration", () => {
  const portfolio = resolveFirestoreListenPacks({ kind: "work", section: "portfolio" });
  assert.equal(portfolio.tableRecords, false);
  assert.equal(portfolio.financeOps, false);
});

test("useTasksIndex equality is content-stable (ProjectRoute must not infinite-loop)", () => {
  const root = resolve(import.meta.dirname, "..");
  const collections = readFileSync(resolve(root, "src/data/collections.ts"), "utf8");
  const route = readFileSync(resolve(root, "src/routes/ProjectRoute.tsx"), "utf8");
  assert.match(route, /useTasksIndex\(\)/);
  assert.match(collections, /function sameTaskIndex/);
  assert.match(collections, /sameTaskIndex/);
  // Reference-only Map equality is unsafe: selector always allocates a new Map.
  assert.doesNotMatch(
    collections,
    /useTasksIndex\(\) \{[\s\S]*?\(a, b\) => a === b,/,
  );
});

test("useProjectsWhen / useTasksWhen release sticky snapshots when disabled", () => {
  const collections = readFileSync(
    resolve(import.meta.dirname, "../src/data/collections.ts"),
    "utf8",
  );
  assert.match(
    collections,
    /if \(!enabled\) return a === EMPTY_PROJECTS && b === EMPTY_PROJECTS/,
  );
  assert.match(
    collections,
    /if \(!enabled\) return a === EMPTY_TASKS && b === EMPTY_TASKS/,
  );
});
