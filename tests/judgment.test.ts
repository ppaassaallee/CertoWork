import assert from "node:assert/strict";
import test from "node:test";
import { evaluateJudgment } from "../src/lib/judgment";

test("blocks commitments that use a past explicit date", () => {
  const result = evaluateJudgment(
    "Schedule the project kickoff for 2026-07-20",
    { tasks: [], projects: [] },
    new Date("2026-07-27T12:00:00Z"),
  );

  assert.equal(result.verdict, "stop");
  assert.ok(result.signals.some((signal) => signal.id === "impossible-date"));
});

test("challenges project creation when WIP is high and the outcome is vague", () => {
  const result = evaluateJudgment(
    "I want to start a new project to improve marketing",
    {
      tasks: [],
      projects: Array.from({ length: 5 }, (_, index) => ({
        id: String(index),
        title: `Active project ${index + 1}`,
        status: "active",
      })),
    },
    new Date("2026-07-27T12:00:00Z"),
  );

  assert.equal(result.verdict, "challenge");
  assert.ok(result.signals.some((signal) => signal.id === "wip-overload"));
  assert.ok(result.signals.some((signal) => signal.id === "missing-outcome"));
});

test("clears a reversible capture when no deterministic conflict exists", () => {
  const result = evaluateJudgment(
    "Capture an idea about the weekly report",
    { tasks: [], projects: [], goals: [{ title: "Improve reporting" }] },
    new Date("2026-07-27T12:00:00Z"),
  );

  assert.equal(result.verdict, "clear");
  assert.equal(result.dimensions.strategicAlignment, "aligned");
});

test("blocks a new meeting when real travel context exists", () => {
  const result = evaluateJudgment(
    "Schedule lunch with Alexis tomorrow",
    {
      events: [
        {
          id: "event-1",
          title: "Client site visit and travel",
          start: "2026-07-28T08:00:00Z",
          end: "2026-07-28T17:00:00Z",
        },
      ],
    },
    new Date("2026-07-27T12:00:00Z"),
  );

  assert.equal(result.verdict, "stop");
  assert.ok(result.signals.some((signal) => signal.id === "travel-conflict"));
});
