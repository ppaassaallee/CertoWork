import assert from "node:assert/strict";
import test from "node:test";
import {
  countDoneItems,
  hideDoneItems,
  readShowDone,
  resetDoneVisibilityForTests,
  revealDoneFor,
  setDoneViewAsks,
  toggleDoneVisibility,
  viewAsksForDone,
  writeShowDone,
} from "../src/lib/doneVisibility.ts";

const memory = new Map<string, string>();

test("done visibility hides completed work until the user asks", () => {
  const rows = [
    { status: "todo" },
    { status: "done" },
    { status: "cancelled" },
    { status: "deleted" },
  ];
  assert.deepEqual(
    hideDoneItems(rows, false).map((row) => row.status),
    ["todo", "deleted"],
  );
  assert.equal(hideDoneItems(rows, true).length, 4);
  assert.equal(countDoneItems(rows), 2);
  assert.equal(viewAsksForDone({ filters: [{ columnId: "status", op: "eq", value: "done" }] }), true);
  assert.equal(viewAsksForDone({ filters: [{ columnId: "status", op: "eq", value: "todo" }] }), false);
});

test("show done is remembered per list and a done view can still be hidden", () => {
  const store = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      key: (index: number) => [...memory.keys()][index] || null,
      get length() {
        return memory.size;
      },
    },
  });
  try {
    resetDoneVisibilityForTests();
    const mine = "my-work";
    const project = "project:alpha";
    assert.equal(readShowDone(mine), false);
    writeShowDone(mine, true);
    assert.equal(readShowDone(mine), true);
    assert.equal(readShowDone(project), false);
    setDoneViewAsks(project, true);
    assert.equal(revealDoneFor(project), true);
    toggleDoneVisibility(project);
    assert.equal(revealDoneFor(project), false);
    assert.equal(revealDoneFor(mine), true);
    toggleDoneVisibility(project);
    assert.equal(revealDoneFor(project), true);
  } finally {
    memory.clear();
    if (store) Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
  }
});
