import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  analyzeTime,
  parsePastedTime,
  csvExport,
  durationLabel,
  parseDuration,
  validEntry,
  weekDates,
  shiftDate,
  type TimeEntry,
} from "../src/features/time/model";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";
import { chromeViewFromSearch, tabForProjectView, searchWithProjectView } from "../src/lib/projectViewUrl";
const entry: TimeEntry = {
  id: "e",
  workspaceId: "w",
  userId: "u",
  sheetId: "default",
  projectId: "p",
  itemId: "i",
  description: "Engineering review",
  date: "2026-11-24",
  minutes: 90,
  billable: true,
};
test("paste validates each row before allowing an atomic import", () => {
  const parsed = parsePastedTime("2026-11-24\tReview\t1:30\n2026-11-25\tDraft\t0,5");
  assert.equal(parsed.rows.length, 2);
  assert.equal(
    parsed.rows.reduce((sum, row) => sum + row.minutes, 0),
    120,
  );
  assert.deepEqual(parsed.invalidLines, []);
  assert.deepEqual(parsePastedTime("2026-02-30\tInvalid\t1\n2026-11-24\tReview\t1:80").invalidLines, [1, 2]);
  assert.equal(parsePastedTime(Array(51).fill("2026-11-24\tReview\t1").join("\n")).invalidLines[0], 51);
});
test("visual insights reconcile to the loaded filtered view", () => {
  const result = analyzeTime([entry, { ...entry, id: "b", minutes: 30, projectId: "other" }], weekDates(entry.date));
  assert.equal(
    result.daily.reduce((sum, row) => sum + row.minutes, 0),
    120,
  );
  assert.deepEqual(result.projects, [
    { projectId: "p", minutes: 90 },
    { projectId: "other", minutes: 30 },
  ]);
});
test("time durations accept clock and decimal hours without minute ambiguity", () => {
  for (const [input, output] of [
    ["1:30", 90],
    ["1.5", 90],
    ["1,5", 90],
    ["0:01", 1],
    ["24:00", 1440],
    ["2", 120],
  ] as const)
    assert.equal(parseDuration(input), output);
  for (const input of ["", "0", "1:90", "-1", "25", "24:01", "1h", "1:2", "Infinity"])
    assert.equal(parseDuration(input), null, input);
  assert.equal(durationLabel(90), "1:30");
});
test("timesheet weeks are Monday based, preserve civil dates and year boundaries", () => {
  assert.deepEqual(weekDates("2026-11-29"), [
    "2026-11-23",
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
    "2026-11-27",
    "2026-11-28",
    "2026-11-29",
  ]);
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(weekDates("2027-01-01")[0], "2026-12-28");
});
test("entry validation rejects impossible dates, invalid duration and empty identity", () => {
  assert.equal(validEntry(entry), true);
  for (const patch of [
    { date: "2026-02-30" },
    { minutes: 0 },
    { minutes: 1.5 },
    { minutes: 1441 },
    { description: "  " },
    { userId: "" },
    { workspaceId: "" },
    { sheetId: "" },
  ])
    assert.equal(validEntry({ ...entry, ...patch }), false);
  assert.equal(validEntry({ ...entry, projectId: "", itemId: "" }), true);
});
test("CSV preserves narratives and neutralizes spreadsheet formulas", () => {
  const csv = csvExport([{ ...entry, description: ' =HYPERLINK("evil")' }]);
  assert.ok(csv.includes('"\' =HYPERLINK(""evil"")"'));
  assert.ok(csv.includes('"90","true"'));
});
test("personal route and project Time tab are deep linkable", () => {
  assert.equal(resolveDelivereeLens("/timesheets").kind, "timesheets");
  assert.equal(chromeViewFromSearch("?view=time"), "time");
  assert.equal(tabForProjectView("time"), "time");
  assert.equal(searchWithProjectView("?item=i", "time"), "?item=i&view=time");
});
test("timesheets are author and tenant scoped; links validate real authorized targets", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const section = rules.slice(rules.indexOf("function ownTime("), rules.indexOf("// Stakeholders"));
  assert.match(section, /request.auth.uid == userId && isWorkspaceParticipant\(workspaceId\)/);
  assert.match(section, /canReadProject/);
  assert.match(section, /hasProjectTaskAccess\(data\) \|\| hasDirectTaskAccess\(data\)/);
  assert.match(section, /data\.get\('projectId', ''\) == data.projectId/);
  assert.match(section, /incoming\(\)\.minutes <= 1440/);
  assert.match(section, /incoming\(\)\.updatedAt == request.time/);
  assert.doesNotMatch(section, /allow .*if true/);
});
test("storage is paginated on demand, timer start and stop are transactional", () => {
  const storage = readFileSync("src/lib/time/storage.ts", "utf8");
  assert.doesNotMatch(storage, /onSnapshot|setInterval|httpsCallable|fetch\(/);
  assert.match(storage, /startAfter\(cursor\)/);
  assert.match(storage, /limit\(TIME_PAGE_SIZE\)/);
  assert.match(storage, /tx\.set\(ref,[\s\S]*tx\.delete\(state\)/);
  assert.match(storage, /if \(\(await tx.get\(state\)\).exists\(\)\) throw/);
  assert.doesNotMatch(storage, /loggedHours|actualHours|cost_entries/);
});
