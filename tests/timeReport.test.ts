import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTimeReport, loadTimeReport, validReportRange, type TimeReportOptions } from "../src/features/time/report";
import { type TimeEntry } from "../src/features/time/model";
const options: TimeReportOptions = {
  from: "2026-11-01",
  to: "2026-11-30",
  sheetIds: ["default"],
  projectId: "",
  billableOnly: false,
};
const identity = { userId: "u", workspaceId: "w" };
const row: TimeEntry = {
  ...identity,
  id: "1",
  sheetId: "default",
  projectId: "p",
  itemId: "i",
  date: "2026-11-02",
  minutes: 90,
  billable: true,
  description: "Revisión técnica",
};
test("PDF pages require server confirmation and add no listeners or external rendering service", () => {
  const storage = readFileSync("src/lib/time/storage.ts", "utf8");
  const dialog = readFileSync("src/features/time/TimeReportDialog.tsx", "utf8");
  const report = readFileSync("src/features/time/report.ts", "utf8");
  assert.match(storage, /serverOnly \? await getDocsFromServer\(selection\)/);
  assert.match(dialog, /loadWeek\(from, to, cursor, true\)/);
  assert.doesNotMatch(report + dialog, /onSnapshot|httpsCallable|fetch\(/);
});
test("PDF report validates civil dates, ordering and 366 day boundary", () => {
  assert.ok(validReportRange("2024-01-01", "2024-12-31"));
  for (const [from, to] of [
    ["2024-01-01", "2025-01-01"],
    ["2026-02-30", "2026-03-10"],
    ["2026-12-01", "2026-01-01"],
    ["", "2026-01-01"],
  ])
    assert.equal(validReportRange(from, to), false);
});
test("PDF loads every page, deduplicates and applies selected sheet, dates, project and billability", async () => {
  let calls = 0;
  const result = await loadTimeReport(
    { ...options, projectId: "p", billableOnly: true },
    identity,
    async () => {
      calls++;
      return calls === 1
        ? { rows: [row, { ...row, id: "2", sheetId: "legal" }], cursor: "next", more: true }
        : {
            rows: [
              row,
              { ...row, id: "3", projectId: "other" },
              { ...row, id: "4", date: "2026-12-01" },
              { ...row, id: "5", billable: false },
            ],
            more: false,
          };
    },
    () => false,
    () => {},
  );
  assert.equal(calls, 2);
  assert.deepEqual(
    result.map((value) => value.id),
    ["1"],
  );
});
test("PDF refuses partial exports on permission/network failure or unexpected tenant data", async () => {
  let calls = 0;
  await assert.rejects(
    loadTimeReport(
      options,
      identity,
      async () => {
        if (++calls === 2) throw new Error("permission-denied");
        return { rows: [row], more: true, cursor: "next" };
      },
      () => false,
      () => {},
    ),
    /permission-denied/,
  );
  await assert.rejects(
    loadTimeReport(
      options,
      identity,
      async () => ({ rows: [{ ...row, userId: "other" }], more: false }),
      () => false,
      () => {},
    ),
    /report_identity/,
  );
  await assert.rejects(
    loadTimeReport(
      options,
      identity,
      async () => ({ rows: Array(2001).fill(row), more: false }),
      () => false,
      () => {},
    ),
    /report_large/,
  );
});
test("PDF cancellation stops pagination; missing cursor fails safely", async () => {
  let cancelled = false,
    calls = 0;
  await assert.rejects(
    loadTimeReport(
      options,
      identity,
      async () => {
        calls++;
        cancelled = true;
        return { rows: [row], more: true, cursor: "x" };
      },
      () => cancelled,
      () => {},
    ),
    /report_cancelled/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    loadTimeReport(
      options,
      identity,
      async () => ({ rows: [row], more: true }),
      () => false,
      () => {},
    ),
    /report_page/,
  );
});
test("PDF HTML is bilingual, escapes authored content, preserves accents and has print pagination", () => {
  const html = buildTimeReport(
    [{ ...row, description: '<script>alert("x")</script> Revisión técnica' }],
    options,
    {
      locale: "es",
      person: "Ana & José",
      workspace: "Certo",
      projects: [{ id: "p", title: "Proyecto" }],
      items: [{ id: "i", title: "PBI" }],
      sheets: [{ id: "default", name: "Mi hoja" }],
    },
    new Date("2026-11-24T18:00:00Z"),
  );
  assert.match(html, /Hoja de horas/);
  assert.match(html, /Ana &amp; José/);
  assert.match(html, /Revisión técnica/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /1:30/);
  assert.match(html, /counter\(page\)/);
  assert.match(html, /table-header-group/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /src="https?:/);
});
