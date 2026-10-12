import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(path), "utf8");

test("cloudflare deploy waits for a green CI push to main", () => {
  const workflow = read(".github/workflows/deploy-cloudflare.yml");
  assert.match(workflow, /workflows:\s*\["CI"\]/);
  assert.match(workflow, /types:\s*\[completed\]/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /workflow_run\.event == 'push'/);
  assert.match(workflow, /workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /group: cloudflare-production-deploy/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /workflow_run\.head_sha/);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /branches:\s*\[main\]/);
});

test("CI runs the lint budget and a missing counter cannot pass as zero", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /npm run lint:budget/);
  const script = read("scripts/lint-budget.mjs");
  assert.match(script, /missing tool cannot report zero/);
  assert.match(script, /join\("\|"\)/);
  assert.match(script, /process\.exit\(1\)/);
  const budget = JSON.parse(read("lint-budget.json"));
  assert.match(String(budget.ceilingNote), /43dea50/);
  assert.equal(budget.runbookTargets.any, 1158);
  assert.ok(budget.any >= budget.runbookTargets.any);
});
