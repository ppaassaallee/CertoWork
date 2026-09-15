import test from "node:test";
import assert from "node:assert/strict";
import { findFreeSlots } from "../src/lib/calendar/freeSlots";

const TZ = "UTC";
const day = "2026-09-15";
const from = `${day}T00:00:00.000Z`;
const to = `${day}T23:59:59.000Z`;
const workHours = { start: 9, end: 17 };

test("empty day yields one workHours slot", () => {
  const slots = findFreeSlots([], { from, to, minMinutes: 60, workHours, timezone: TZ });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].start, `${day}T09:00:00.000Z`);
  assert.equal(slots[0].end, `${day}T17:00:00.000Z`);
});

test("midday event splits into two slots", () => {
  const slots = findFreeSlots(
    [{ start: `${day}T12:00:00.000Z`, end: `${day}T13:00:00.000Z` }],
    { from, to, minMinutes: 60, workHours, timezone: TZ },
  );
  assert.equal(slots.length, 2);
  assert.equal(slots[0].end, `${day}T12:00:00.000Z`);
  assert.equal(slots[1].start, `${day}T13:00:00.000Z`);
});

test("overlapping events merge", () => {
  const slots = findFreeSlots(
    [
      { start: `${day}T10:00:00.000Z`, end: `${day}T12:00:00.000Z` },
      { start: `${day}T11:00:00.000Z`, end: `${day}T13:00:00.000Z` },
    ],
    { from, to, minMinutes: 60, workHours, timezone: TZ },
  );
  assert.equal(slots.length, 2);
  assert.equal(slots[0].end, `${day}T10:00:00.000Z`);
  assert.equal(slots[1].start, `${day}T13:00:00.000Z`);
});

test("45 min gap ignored when minMinutes is 60", () => {
  const slots = findFreeSlots(
    [
      { start: `${day}T09:00:00.000Z`, end: `${day}T12:00:00.000Z` },
      { start: `${day}T12:45:00.000Z`, end: `${day}T17:00:00.000Z` },
    ],
    { from, to, minMinutes: 60, workHours, timezone: TZ },
  );
  assert.equal(slots.length, 0);
});
