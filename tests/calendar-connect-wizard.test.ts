import assert from "node:assert/strict";
import test from "node:test";

import {
  CALENDAR_CONNECT_STEPS,
  calendarConnectStepIndex,
  nextCalendarConnectStep,
} from "../src/lib/calendar/connectWizard.ts";

test("calendar connect wizard steps advance provider → done", () => {
  assert.deepEqual(CALENDAR_CONNECT_STEPS, [
    "provider",
    "authorize",
    "calendars",
    "privacy",
    "done",
  ]);
  assert.equal(calendarConnectStepIndex("provider"), 0);
  assert.equal(nextCalendarConnectStep("provider"), "authorize");
  assert.equal(nextCalendarConnectStep("authorize"), "calendars");
  assert.equal(nextCalendarConnectStep("calendars"), "privacy");
  assert.equal(nextCalendarConnectStep("privacy"), "done");
  assert.equal(nextCalendarConnectStep("done"), null);
});
