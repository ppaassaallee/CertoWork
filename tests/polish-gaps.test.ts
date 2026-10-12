import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatStatusActivity } from "../src/lib/activityText";
import { filterPointerKeepsOpen, shouldDismissFilterOnEscape } from "../src/lib/filterPopover";
import { copyOnWritePlan, dedupeViewsForDisplay } from "../src/lib/views/displayViews";

test("status activity never shows a raw in_progress arrow", () => {
  assert.equal(formatStatusActivity({ from: "—", to: "in_progress" }), "Moved to Doing");
  assert.equal(formatStatusActivity({ from: "–", status: "in_progress" }), "Moved to Doing");
  assert.equal(formatStatusActivity({ text: "System — → in_progress" }), "Moved to Doing");
  assert.equal(formatStatusActivity({ status: "in_progress" }), "Moved to Doing");
  assert.equal(formatStatusActivity({ from: "backlog", to: "in_progress" }), "Backlog → Doing");
  for (const line of [
    formatStatusActivity({ from: "—", to: "in_progress" }),
    formatStatusActivity({ text: "— → in_progress" }),
  ]) {
    assert.equal(line.includes("in_progress"), false);
    assert.equal(line.startsWith("—"), false);
  }
});

test("duplicate My view tabs collapse in the UI and copy-on-write reuses the personal one", () => {
  const views = [
    { id: "system:today", name: "Today", updatedAt: "2026-10-01" },
    { id: "a", name: "My view", scope: "personal", updatedAt: "2026-10-01", ownerId: "u" },
    { id: "b", name: "My view", scope: "personal", updatedAt: "2026-10-03", ownerId: "u" },
    { id: "c", name: "My view 2", scope: "personal", updatedAt: "2026-10-02", ownerId: "u" },
  ];
  const shown = dedupeViewsForDisplay(views, "system:today");
  assert.deepEqual(shown.map((view) => view.id), ["system:today", "b", "c"]);
  assert.equal(dedupeViewsForDisplay(views, "a").find((view) => view.name === "My view")?.id, "a");
  assert.deepEqual(copyOnWritePlan(views, "My view"), { action: "update", id: "b" });
  assert.deepEqual(copyOnWritePlan([{ id: "system:today", name: "Today" }], "My view"), {
    action: "create",
    name: "My view",
  });
  assert.equal(
    copyOnWritePlan(
      [{ id: "a", name: "My view", scope: "personal", updatedAt: "2026-10-01" }],
      "Team",
    ).action,
    "create",
  );
});

test("filter popover Escape closes and a select choice is not treated as outside", () => {
  assert.equal(shouldDismissFilterOnEscape("Escape"), true);
  assert.equal(shouldDismissFilterOnEscape("Enter"), false);
  assert.equal(filterPointerKeepsOpen("SELECT"), true);
  assert.equal(filterPointerKeepsOpen("OPTION"), true);
  assert.equal(filterPointerKeepsOpen("DIV", "SELECT"), true);
  assert.equal(filterPointerKeepsOpen("DIV", "BUTTON"), false);
});

test("magic and paste modals opt out of the two-column skill grid", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const gridAt = css.indexOf(".do-skill-body {\n  display: grid;");
  const singleAt = css.indexOf(".do-skill-modal.do-magic-modal .do-skill-body");
  assert.ok(gridAt > 0);
  assert.ok(singleAt > gridAt);
  assert.match(css.slice(singleAt, singleAt + 220), /display:\s*block/);
  assert.match(css, /\.do-project-menu-portal\s*\{[^}]*z-index:\s*220/);
  const surfaces = readFileSync(new URL("../src/components/ProjectSurfaces.tsx", import.meta.url), "utf8");
  assert.match(surfaces, /showFilterSort=\{false\}/);
  const items = readFileSync(new URL("../src/components/WorkItemsCenter.tsx", import.meta.url), "utf8");
  assert.match(items, /shouldDismissFilterOnEscape/);
  assert.match(items, /filterPointerKeepsOpen/);
});
