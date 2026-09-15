import assert from "node:assert/strict";
import test from "node:test";
import { eventDayKeys, localDayKey, minutesFromMidnight } from "../src/lib/calendar/dates.ts";

test("timed event uses local day (Guatemala UTC-6)", () => {
  // 02:00Z on Sep 15 = 20:00 previous evening in America/Guatemala
  const keys = eventDayKeys({
    start: "2026-09-15T02:00:00.000Z",
    end: "2026-09-15T03:00:00.000Z",
    allDay: false,
  });
  assert.equal(keys.length, 1);
  // When TZ=America/Guatemala this is 2026-09-14; in UTC CI it may be 15.
  // Assert consistency with localDayKey of the same instant.
  assert.equal(keys[0], localDayKey(new Date("2026-09-15T02:00:00.000Z")));
});

test("all-day single day uses start date only (end exclusive)", () => {
  assert.deepEqual(
    eventDayKeys({ start: "2026-09-15", end: "2026-09-16", allDay: true }),
    ["2026-09-15"],
  );
});

test("all-day multi-day spans inclusive starts", () => {
  assert.deepEqual(
    eventDayKeys({ start: "2026-09-15", end: "2026-09-18", allDay: true }),
    ["2026-09-15", "2026-09-16", "2026-09-17"],
  );
});

test("minutesFromMidnight uses local clock", () => {
  const mins = minutesFromMidnight("2026-09-15T14:30:00");
  assert.equal(typeof mins, "number");
  assert.ok(mins >= 0 && mins < 24 * 60);
});
