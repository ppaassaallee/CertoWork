import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canOperateInvoices } from "../src/lib/workspaceCollaboration";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";

const root = resolve(import.meta.dirname, "..");

test("finance privilege: owner/admin or financeAccess can operate", () => {
  assert.equal(canOperateInvoices("member", false, false), false);
  assert.equal(canOperateInvoices("viewer", false, false), false);
  assert.equal(canOperateInvoices("member", false, true), true);
  assert.equal(canOperateInvoices("admin", false, false), true);
  assert.equal(canOperateInvoices("member", true, false), true);
});

test("/finance and /costs open portfolio (Costs sheet), not invoices", () => {
  assert.deepEqual(resolveDelivereeLens("/finance"), {
    kind: "work",
    section: "portfolio",
  });
  assert.deepEqual(resolveDelivereeLens("/costs"), {
    kind: "work",
    section: "portfolio",
  });
  assert.deepEqual(resolveDelivereeLens("/financials"), {
    kind: "work",
    section: "portfolio",
  });
  assert.deepEqual(resolveDelivereeLens("/invoices"), { kind: "invoices" });
});

test("shell surfaces privilege-gated Costs entry points", () => {
  const shell = readFileSync(resolve(root, "src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(shell, /data-testid="nav-costs"/);
  assert.match(shell, /canViewFinance/);
  assert.match(shell, /\/projects\?view=economics/);
  assert.match(shell, /onPortfolioViewChange/);
  assert.match(shell, /canViewFinance=\{canViewFinance\}/);
});

test("Projects home and project chrome expose Costs only when privileged", () => {
  const surfaces = readFileSync(
    resolve(root, "src/components/ProjectSurfaces.tsx"),
    "utf8",
  );
  const chrome = readFileSync(
    resolve(root, "src/features/projects/chrome/ProjectPageChrome.tsx"),
    "utf8",
  );
  assert.match(surfaces, /data-testid="projects-costs-tab"/);
  assert.match(surfaces, /canViewFinance \? \(/);
  assert.match(surfaces, /showCosts=\{canViewFinance\}/);
  assert.match(chrome, /id: "costs"/);
  assert.match(chrome, /data-testid=\{id === "costs" \? "project-costs-tab"/);
});

test("portfolio finance analyst keeps month→project sheet UX", () => {
  const analyst = readFileSync(
    resolve(root, "src/components/PortfolioFinanceAnalyst.tsx"),
    "utf8",
  );
  assert.match(analyst, /data-testid="portfolio-finance-analyst"/);
  assert.match(analyst, /Costs by month → project/);
  assert.match(analyst, /groupPortfolioFinanceByMonthThenProject/);
  assert.match(analyst, /do-portfolio-finance-filters/);
});
