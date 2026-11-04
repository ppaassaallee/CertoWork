import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveFeatureFlag } from "../src/lib/featureFlags.ts";
import { RUN_STORE_ACTIONS } from "../src/run/data/RunStore.tsx";
import { lastRunWorld, openRunWorldCount, readRunReturn, rememberRunReturn } from "../src/run/nav.ts";
import { runDocumentPath } from "../worker/runAssets.js";

test("commandRun defaults off and the nav source stays behind that flag", () => {
  assert.equal(resolveFeatureFlag("commandRun", { environment: "test" }), false);
  const desk = readFileSync("src/components/DelivereeWorkspace.tsx", "utf8");
  assert.match(desk, /isProductFlagEnabled\("commandRun"\)/);
  assert.match(desk, /\{runEnabled && \([\s\S]*data-testid="nav-certo-run"/);
  assert.match(desk, /data-testid="nav-certo-run-count"/);
  assert.equal(desk.includes("CertoRunDeskLazy"), false);
  assert.match(desk, /window\.location\.assign\("\/run"\)/);
  assert.match(desk, /rememberRunReturn/);
});

test("the Run document is served for /run routes and not for files or Certo routes", () => {
  assert.equal(runDocumentPath("/run", "GET"), "/run.html");
  assert.equal(runDocumentPath("/run/today", "GET"), "/run.html");
  assert.equal(runDocumentPath("/run/queue", "HEAD"), "/run.html");
  assert.equal(runDocumentPath("/run/assets/app.js", "GET"), null);
  assert.equal(runDocumentPath("/home", "GET"), null);
  assert.equal(runDocumentPath("/api/health", "GET"), null);
  const worker = readFileSync("worker/index.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.match(worker, /runDocumentPath/);
  assert.match(worker, /from "\.\/runDomain\.js"/);
  assert.match(wrangler, /"\/run"/);
  assert.match(wrangler, /"\/run\/\*"/);
});

test("Run styles never enter Certo and Certo styles never enter Run", () => {
  const runHtml = readFileSync("run.html", "utf8");
  const main = readFileSync("src/run/main.tsx", "utf8");
  const css = readFileSync("src/run/run.css", "utf8");
  const certoMain = readFileSync("src/main.tsx", "utf8");
  assert.match(runHtml, /Familjen\+Grotesk:wght@600;700/);
  assert.match(runHtml, /Atkinson\+Hyperlegible:wght@400;700/);
  assert.match(runHtml, /JetBrains\+Mono:wght@400;500;600/);
  assert.match(runHtml, /display=swap/);
  assert.equal(runHtml.includes("index.css"), false);
  assert.equal(main.includes("index.css"), false);
  assert.equal(main.includes("certo-tokens"), false);
  assert.equal(certoMain.includes("src/run/"), false);
  assert.equal(certoMain.includes("run.css"), false);
  assert.match(css, /@keyframes fade-in/);
  assert.match(css, /prefers-reduced-motion/);
});

test("RunStore keeps the AI Studio action names and does not store data in localStorage", () => {
  assert.deepEqual(RUN_STORE_ACTIONS, [
    "setWorld",
    "setTab",
    "setQueueMode",
    "setOutcome",
    "moveToMake",
    "setPriority",
    "setTop3",
    "togglePin",
    "saveAllocation",
    "updateDailyMetrics",
    "saveManifesto",
    "createPbi",
    "addIntakeLog",
    "approveProposal",
    "rejectProposal",
    "recordClose",
    "setProjectHealth",
    "updateLifePerson",
    "updateLifeBook",
    "showToast",
    "dismissToast",
    "clearCapError",
  ]);
  const source = readFileSync("src/run/data/RunStore.tsx", "utf8");
  assert.match(source, /localStorage\.setItem\("certo-run-world"/);
  assert.equal(source.includes("localStorage.setItem(\"certo-run-browser"), false);
  assert.equal((source.match(/localStorage\.setItem/g) || []).length, 1);
});

test("the nav count is the open items of the last world, and Back returns to Certo", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  Object.assign(globalThis, { localStorage: storage, sessionStorage: storage });
  try {
    localStorage.setItem("certo-run-world", "Boldr AI");
    assert.equal(lastRunWorld(), "Boldr AI");
    assert.equal(openRunWorldCount([
      { runWorld: "Boldr AI", status: "open" },
      { runWorld: "Boldr AI", status: "done" },
      { runWorld: "Pure AI", status: "open" },
    ], "Boldr AI"), 1);
    rememberRunReturn("/projects/alpha");
    assert.equal(readRunReturn(), "/projects/alpha");
    rememberRunReturn("/run/queue");
    assert.equal(readRunReturn(), "/home");
  } finally {
    Object.assign(globalThis, { localStorage: previousLocal, sessionStorage: previousSession });
  }
});

test("the Worker and the Run bundle import one domain module", () => {
  execFileSync("npx", ["esbuild", "worker/runDomain.js", "--bundle", "--platform=browser", "--format=esm", "--outfile=/tmp/run-domain-bundle.js"], {
    stdio: "pipe",
  });
  const bundled = readFileSync("/tmp/run-domain-bundle.js", "utf8");
  assert.match(bundled, /make:\s*5/);
  assert.match(bundled, /tomorrow:\s*3/);
});
