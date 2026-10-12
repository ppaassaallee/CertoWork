import assert from "node:assert/strict";
import test from "node:test";
import { formatStatusActivity } from "../src/lib/activityText";
import { calendarDateKey, dueDateChipLabel } from "../src/lib/itemDateLabel";
import { htmlToMarkdown, markdownToHtml } from "../src/lib/noteMarkup";
import { noteDraftChanged } from "../src/lib/noteDraft";
import { t } from "../src/lib/i18n";
import { planDuplicateViewRenames } from "../src/lib/views/duplicateViewNames";
import { nextPersonalViewName } from "../src/lib/views/storage";

test("opening a note is not a save, and a real edit is", () => {
  const note = { title: "Plan", content: "Hello", projectId: "", tags: ["a"] };
  const opened = { title: "Plan", content: "Hello", projectId: "", tagsText: "a" };
  assert.equal(noteDraftChanged(opened, note), false);
  assert.equal(noteDraftChanged({ ...opened, projectId: "active-project" }, note), true);
  assert.equal(noteDraftChanged({ ...opened, content: "Hello!" }, note), true);
});

test("status activity uses readable names", () => {
  assert.equal(formatStatusActivity({ from: "", to: "in_progress" }), "Moved to Doing");
  assert.equal(formatStatusActivity({ from: "todo", to: "done" }), "To do → Done");
});

test("a date-only due stays on that calendar day", () => {
  assert.equal(calendarDateKey("2026-10-13"), "2026-10-13");
  const label = dueDateChipLabel("2026-10-13");
  assert.match(label, /13/);
  assert.doesNotMatch(label, /This week|Esta semana/);
  const utcMidnight = new Date("2026-10-13T00:00:00Z");
  const shifted = new Date(utcMidnight.getTime() - 6 * 60 * 60 * 1000);
  assert.equal(shifted.getUTCDate(), 12);
  assert.equal(calendarDateKey("2026-10-13"), "2026-10-13");
});

test("markdown tables render and round-trip, and blank lines collapse", () => {
  const source = "| Task | Owner |\n| --- | --- |\n| Send | Ana |\n\n\n\nNext";
  const html = markdownToHtml(source);
  assert.match(html, /<table class="cw-notes-table">/);
  assert.match(html, /<th>Task<\/th>/);
  assert.match(html, /<td>Send<\/td>/);
  const breaks = (html.match(/<p><br><\/p>/g) || []).length;
  assert.ok(breaks > 0 && breaks < 4);
  const back = htmlToMarkdown(html);
  assert.match(back, /\| Task \| Owner \|/);
  assert.match(back, /\| Send \| Ana \|/);
});

test("personal view names stay unique", () => {
  assert.equal(nextPersonalViewName(["Default"], "My view"), "My view");
  assert.equal(nextPersonalViewName(["My view", "My view 2"], "My view"), "My view 3");
  assert.equal(nextPersonalViewName(["mi vista"], "Mi vista"), "Mi vista 2");
});

test("duplicate saved views get a dry-run rename plan", () => {
  const views = ["a", "b", "c", "d"].map((id, index) => ({
    id,
    name: "My view",
    workspaceId: "boldr",
    surface: "my-work",
    ownerId: "ana",
    createdAt: `2026-10-0${index + 1}`,
  }));
  const plan = planDuplicateViewRenames(views);
  assert.deepEqual(plan.map((row) => row.to), ["My view 2", "My view 3", "My view 4"]);
  assert.equal(plan[0].from, "My view");
  assert.equal(planDuplicateViewRenames([{ ...views[0], id: "only" }]).length, 0);
  const renamed = views.map((view) => {
    const change = plan.find((row) => row.id === view.id);
    return change ? { ...view, name: change.to } : view;
  });
  assert.equal(planDuplicateViewRenames(renamed).length, 0);
});

test("palette and note strings follow the language setting", () => {
  assert.equal(t("palette.viewRoutineFlow", "es"), "Ver flujo de");
  assert.equal(t("palette.goRoutines", "en"), "Go to Routines");
  assert.equal(t("project.backToTable", "es"), "Volver a la tabla");
  assert.equal(t("notes.ask", "en"), "Ask about this note");
  assert.equal(dueDateChipLabel("2026-10-13").includes("Oct"), true);
});
