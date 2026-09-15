import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("calendar wizard stays narrow so provider actions are visible inside admin drawer", () => {
  const component = readFileSync("src/features/calendar/CalendarConnectWizard.tsx", "utf8");
  const css = readFileSync("src/index.css", "utf8");

  assert.match(component, /do-calendar-connect-modal/);
  assert.match(component, /do-calendar-provider-grid/);
  assert.match(component, /do-calendar-wizard-button is-primary/);
  assert.match(css, /\.do-calendar-connect-modal\s*{\s*width:\s*min\(560px, calc\(100vw - 32px\)\)/);
  assert.match(css, /\.do-calendar-connect-modal \.do-skill-body\s*{\s*display:\s*block/);
  assert.match(css, /\.do-calendar-provider-card\.is-selected/);
});
