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
  const css = readFileSync("src/styles/certo-tokens.css", "utf8");

  assert.match(component, /cw-cal-wizard/);
  assert.match(component, /cw-cal-wizard-providers/);
  assert.match(component, /cw-cal-wizard-btn is-primary/);
  assert.match(component, /cw-cal-wizard-foot/);
  assert.match(css, /\.cw-cal-wizard\s*\{[^}]*width:\s*min\(520px, calc\(100vw - 32px\)\)/s);
  assert.match(css, /\.cw-cal-wizard-card\.is-selected/);
  assert.match(css, /\.cw-cal-wizard-foot\s*\{/);
});
