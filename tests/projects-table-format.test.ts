import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Timestamp } from "firebase/firestore";
import { toDateKey } from "../src/shared/formatDate";

test("project adapter coerces Firestore dates and never stringifies Timestamp(", () => {
  const adapter = readFileSync(
    resolve("src/features/views/adapters/projectAdapter.ts"),
    "utf8",
  );
  assert.match(adapter, /toDateKey/);
  assert.match(adapter, /function readDate/);
  assert.match(adapter, /type: "updated_at"/);
  assert.doesNotMatch(
    adapter,
    /readString\(row, \["updatedAt"\]\)/,
  );
});

test("ViewGrid enables mouse column resize with visible handles", () => {
  const viewGrid = readFileSync(resolve("src/features/views/ViewGrid.tsx"), "utf8");
  const css = readFileSync(resolve("src/styles/certo-tokens.css"), "utf8");
  assert.match(viewGrid, /columnResizeMode:\s*"onChange"/);
  assert.match(viewGrid, /enableColumnResizing:\s*true/);
  assert.match(viewGrid, /getResizeHandler\(\)/);
  assert.match(viewGrid, /cw-views-col-resizer/);
  assert.match(viewGrid, /readOnly=\{!column\.write\}/);
  assert.match(viewGrid, /onViewChange/);
  assert.match(css, /\.cw-views-col-resizer/);
  assert.match(css, /cursor:\s*col-resize/);
});

test("ProjectsViewsSurface persists resized column widths", () => {
  const surface = readFileSync(
    resolve("src/features/views/ProjectsViewsSurface.tsx"),
    "utf8",
  );
  assert.match(surface, /onViewChange=\{/);
  assert.match(surface, /ensurePersisted/);
});

test("Progress and Date cells prefer compact single-value UX", () => {
  const cells = readFileSync(
    resolve("src/features/tables/cells/RecordCells.tsx"),
    "utf8",
  );
  assert.match(cells, /type="range"/);
  assert.match(cells, /cw-tables-progress is-edit/);
  assert.match(cells, /is-single/);
  assert.match(cells, /column\.type === "updated_at"/);
  assert.doesNotMatch(
    cells,
    /type="number"[\s\S]{0,80}max=\{100\}/,
  );
});

test("toDateKey produces ISO keys for project updatedAt shapes", () => {
  const ts = Timestamp.fromDate(new Date("2026-09-23T18:00:00Z"));
  assert.equal(toDateKey(ts), toDateKey({ seconds: ts.seconds, nanoseconds: 0 }));
  assert.match(toDateKey(ts), /^2026-09-2[23]$/);
  assert.equal(String(ts).includes("Timestamp("), true);
  assert.equal(toDateKey(ts).includes("Timestamp"), false);
});
