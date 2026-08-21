import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeWorkItemSequence,
  formatWorkItemDateStamp,
  isModernWorkItemKey,
  nextWorkItemKey,
  parseWorkItemSequence,
} from "../src/lib/workItemKey";

test("item keys do not copy company or project names", () => {
  const key = nextWorkItemKey(["ALLIEDGLOB-1", "ALLIED-GLOBAL-BANRURAL-1"], {
    now: new Date(2026, 7, 20),
    random: () => 0.47,
  });
  assert.equal(key, "47-002-200826");
  assert.equal(key.includes("ALLIED"), false);
  assert.equal(isModernWorkItemKey(key), true);
});

test("sequence continues across the workspace and encodes alphanumerically", () => {
  assert.equal(parseWorkItemSequence("47-00A-200826"), 10);
  assert.equal(encodeWorkItemSequence(10), "00A");
  const key = nextWorkItemKey(["47-00A-010826", "TASK-3"], {
    now: new Date(2026, 7, 20),
    random: () => 0.09,
  });
  assert.equal(key, "09-00B-200826");
});

test("date stamp is day, month, then two-digit year", () => {
  assert.equal(formatWorkItemDateStamp(new Date(2026, 0, 5)), "050126");
});
