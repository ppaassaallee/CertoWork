import assert from "node:assert/strict";
import test from "node:test";
import rows from "../src/data/portfolioMasterAgo2026.json";
import {
  PORTFOLIO_MASTER_IMPORT_KEY,
  buildPortfolioProjectPayload,
  isPureAiWorkspace,
  mapProductPhase,
  mapSourceHealth,
  mapSourceStatus,
  memberMatchesShareAlias,
  portfolioImportKey,
  resolvePortfolioShareTargets,
  shouldReplacePureAiPortfolio,
} from "../src/lib/portfolioMasterImport";

const masterRows = rows as Array<{
  sourceRow: number;
  projectName: string;
  bpo?: string;
  client?: string;
  project?: string;
  technology?: string;
  phase?: string;
  sourceStatus?: string;
  description?: string;
  managementFocus?: string;
  juneUsd?: number;
  julyUsd?: number;
  totalUsd?: number;
  qaPlanDate?: string | null;
  prodPlanDate?: string | null;
  daysToProd?: number | null;
  contact?: string | null;
}>;

test("parses every executive portfolio row with all excel columns", () => {
  assert.equal(masterRows.length, 65);
  assert.equal(new Set(masterRows.map((row) => row.projectName)).size, 65);
  for (const row of masterRows) {
    assert.ok(row.projectName);
    assert.ok(row.bpo);
    assert.ok(row.client);
    assert.ok(row.project);
    assert.ok(row.technology);
    assert.ok(row.phase);
    assert.ok(row.sourceStatus);
    assert.ok(row.description);
    assert.ok(row.managementFocus);
    assert.equal(typeof row.juneUsd, "number");
    assert.equal(typeof row.julyUsd, "number");
    assert.equal(typeof row.totalUsd, "number");
  }
});

test("maps excel attributes onto live project fields without dropping columns", () => {
  const blocked = masterRows.find((row) => row.sourceStatus === "Bloqueado");
  assert.ok(blocked);
  const payload = buildPortfolioProjectPayload(blocked, {
    userId: "owner-1",
    email: "alejandro@getboldr.ai",
    workspaceId: "pure-ai",
    shareUserIds: ["cesar-uid", "nico-uid"],
    shareMemberIds: ["ws_cesar", "ws_nico"],
    shareEmails: ["cesar.a@getboldr.ai"],
    shareLabels: ["cesar", "nico"],
  });
  assert.equal(payload.title, blocked.projectName);
  assert.equal(payload.shortTitle, blocked.project);
  assert.equal(payload.bpo, blocked.bpo);
  assert.equal(payload.deliveryEntity, blocked.bpo);
  assert.equal(payload.client, blocked.client);
  assert.equal(payload.clientEntity, blocked.client);
  assert.equal(payload.technology, blocked.technology);
  assert.equal(payload.phase, blocked.phase);
  assert.equal(payload.sourceStatus, "Bloqueado");
  assert.equal(payload.healthOverride, "blocked");
  assert.equal(payload.contact, blocked.contact);
  assert.equal(payload.prodPlanDate, blocked.prodPlanDate);
  assert.equal(payload.qaPlanDate, blocked.qaPlanDate);
  assert.equal(payload.daysToProd, blocked.daysToProd);
  assert.equal(payload.description, blocked.description);
  assert.equal(payload.nextAction, blocked.managementFocus);
  assert.equal(payload.juneUsd, blocked.juneUsd);
  assert.equal(payload.julyUsd, blocked.julyUsd);
  assert.equal(payload.totalUsd, blocked.totalUsd);
  assert.equal(payload.excel.estado, "Bloqueado");
  assert.deepEqual(payload.visibleToUserIds, ["owner-1", "cesar-uid", "nico-uid"]);
  assert.ok((payload.visibleToEmails as string[]).includes("cesar.a@getboldr.ai"));
  assert.equal(payload.importedFrom, PORTFOLIO_MASTER_IMPORT_KEY);
});

test("keeps production rows visible and hold/eol mapped", () => {
  assert.equal(mapSourceStatus("Producción", "Producción"), "active");
  assert.equal(mapSourceStatus("On Hold", "Hold"), "paused");
  assert.equal(mapSourceStatus("End of Life", "EOL"), "completed");
  assert.equal(mapSourceStatus("TBC", "TBC"), "planning");
  assert.equal(mapSourceHealth("Bloqueado"), "blocked");
  assert.equal(mapSourceHealth("Vencido"), "at_risk");
  assert.equal(mapProductPhase("Desarrollo"), "Build");
  assert.equal(mapProductPhase("Producción"), "Grow");
  assert.equal(mapProductPhase("QA"), "Beta");
});

test("shares with alias users even when emails differ", () => {
  const share = resolvePortfolioShareTargets([
    { id: "ws_cesar", userId: "u-cesar", alias: "cesar", email: "cesar.ar@alliedglobal.com", status: "active" },
    { id: "ws_nico", userId: "u-nico", alias: "Nico", displayName: "Nicolas", status: "active" },
    { id: "ws_jose", userId: "u-jose", displayName: "Jose Perez", email: "jose@getboldr.ai", status: "active" },
    { id: "ws_rafa", userId: "u-rafa", alias: "rafael", emailLower: "rafael.f@getboldr.ai", status: "active" },
    { id: "ws_regina", userId: "u-regina", alias: "regina", status: "active" },
  ]);
  assert.deepEqual(share.missingAliases, []);
  assert.deepEqual(share.userIds.sort(), ["u-cesar", "u-jose", "u-nico", "u-rafa", "u-regina"]);
  assert.ok(share.emails.includes("cesar.a@getboldr.ai"));
  assert.ok(share.emails.includes("rafael.f@alliedglobal.com"));
  assert.equal(memberMatchesShareAlias({ id: "x", alias: "cesar", userId: "1" }, "cesar"), true);
});

test("only replaces the Pure AI workspace until this workbook key is stored", () => {
  assert.equal(isPureAiWorkspace({ name: "Pure AI" }), true);
  assert.equal(isPureAiWorkspace({ name: "Delivery" }), false);
  assert.equal(shouldReplacePureAiPortfolio({ name: "Pure AI" }), true);
  assert.equal(
    shouldReplacePureAiPortfolio({
      name: "Pure AI",
      portfolioImportKey: PORTFOLIO_MASTER_IMPORT_KEY,
    }),
    false,
  );
  assert.ok(portfolioImportKey(masterRows[0]).includes(String(masterRows[0].sourceRow)));
});
