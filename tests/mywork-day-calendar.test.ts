import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("My Work Today ships a day schedule beside the 2+8 plan", () => {
  const panel = readFileSync(resolve(root, "src/components/MyWorkTodayPanel.tsx"), "utf8");
  const schedule = readFileSync(resolve(root, "src/components/MyWorkDaySchedule.tsx"), "utf8");
  const shell = readFileSync(resolve(root, "src/components/DelivereeWorkspace.tsx"), "utf8");
  const css = readFileSync(resolve(root, "src/index.css"), "utf8");

  assert.match(panel, /MyWorkDaySchedule/);
  assert.match(panel, /onOpenWeek/);
  assert.match(schedule, /my-work-day-schedule/);
  assert.match(schedule, /my-work-date-strip/);
  assert.match(schedule, /my-work-open-week/);
  assert.match(schedule, /useCalendarEvents/);
  assert.match(shell, /onOpenWeek=\{\(\) => navigate\("\/my-work\/week"\)\}/);
  assert.match(shell, /CalendarDays size=\{13\}/);
  assert.match(css, /\.do-today-layout/);
  assert.match(css, /\.do-today-schedule/);
});
