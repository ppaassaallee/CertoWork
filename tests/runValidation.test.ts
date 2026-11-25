import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRunIngest } from "../src/lib/certoRun/validation";
import { checkTitle } from "../src/lib/certoRun/intake";
import { runDocToDeskItem } from "../src/lib/certoRun/store";

const item = { external_id: "GMAIL-test", world: "Pure AI", title: "Send proposal to client for approval", lane: "commercial", decision: "decide", epic: "Client · Proposal", tags: ["needs-info"] };
test("RUN-3 preflight rejects malformed sections without throwing or writing", () => {
  for (const value of [null, [], { format: "certo-run-ingest/1", items: "oops" }, { format: "certo-run-ingest/1", items: [null] }]) assert.equal(validateRunIngest(value).ok, false);
  assert.equal(validateRunIngest({ format: "certo-run-ingest/1", items: [item] }).ok, true);
});
test("RUN-3 duplicate IDs, conflicting epic worlds and admin Make are refused", () => {
  const doc = { format: "certo-run-ingest/1", items: [item, { ...item, world: "Boldr AI", lane: "admin", decision: "make" }] };
  const before = JSON.stringify(doc);
  const report = validateRunIngest(doc);
  assert.match(report.errors.join("\n"), /duplicate/);
  assert.match(report.errors.join("\n"), /both Pure AI and Boldr AI/);
  assert.match(report.errors.join("\n"), /admin is never Make/);
  assert.equal(JSON.stringify(doc), before);
});
test("RUN-10 allocation validates real Mondays and cumulative 100 percent", () => {
  const report = validateRunIngest({ format: "certo-run-ingest/1", allocations: [
    { week: "2026-11-03", person: "Person", pct: 50 },
    { week: "2026-11-02", person: "Person", pct: 60 },
    { week: "2026-11-02", person: "Person", pct: 60 },
  ] });
  assert.match(report.errors.join("\n"), /Monday/);
  assert.match(report.errors.join("\n"), /120%/);
});
test("RUN-3 title rules reject date/star/prefix but allow legitimate source nouns", () => {
  for (const title of ["Send report 2026-11-05", "★ Send report", "[PBI] Send report", "CRM: Send report"]) assert.equal(checkTitle(title).ok, false);
  assert.equal(checkTitle("Delegate Outlook migration to support team").ok, true);
});
test("RUN-2 adapter refuses a record from another workspace", () => {
  assert.equal(runDocToDeskItem("a", { workspaceId: "foreign", runWorld: "Pure AI" }, { id: "current" }), null);
});
test("RUN-1 queue never truncates records and keeps IDs behind context", () => {
  const source = readFileSync("src/features/certo-run/CertoRunDesk.tsx", "utf8");
  const queue = readFileSync("src/features/certo-run/RunQueue.tsx", "utf8");
  assert.doesNotMatch(queue, /items.slice\(0, 40\)/);
  assert.doesNotMatch(queue, /Math.min\(5, counts.make\)/);
  assert.match(queue, /cr-detail-record/);
  assert.match(queue, /<code>\{item.externalId \|\| item.id\}<\/code>/);
  assert.match(source, /storageScope=\{`\$\{workspaceId\}:\$\{user.uid\}`\}/);
});
