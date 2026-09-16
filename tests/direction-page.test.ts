import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("Direction page replaces widget composer", () => {
  const page = readFileSync(
    resolve(root, "src/features/direction/DirectionPage.tsx"),
    "utf8",
  );
  assert.match(page, /direction-page/);
  assert.match(page, /direction-customize/);
  assert.doesNotMatch(page, /Add widget/);
  assert.match(page, /WorkloadWidget/);
  assert.match(page, /OverdueByOwnerWidget/);
  assert.match(page, /ProjectsAttentionWidget/);
  assert.match(page, /MoneyWidget/);
  assert.match(page, /ControlsWidget/);
  assert.match(page, /RequestsWidget/);
});

test("composer files are removed", () => {
  let missing = 0;
  for (const rel of [
    "src/features/dashboard/ComposedDashboard.tsx",
    "src/lib/dashboardLayout.ts",
  ]) {
    try {
      readFileSync(resolve(root, rel), "utf8");
    } catch {
      missing += 1;
    }
  }
  assert.equal(missing, 2);
});

test("i18n ships Direction labels in en and es", () => {
  const i18n = readFileSync(resolve(root, "src/lib/i18n.ts"), "utf8");
  assert.match(i18n, /"nav\.direction": "Leadership"/);
  assert.match(i18n, /"nav\.direction": "Dirección"/);
  assert.match(i18n, /"direction\.widget\.workload"/);
  assert.match(i18n, /"tables\.trash\.link"/);
});
