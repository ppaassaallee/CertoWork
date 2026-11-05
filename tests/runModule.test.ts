import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { resolveFeatureFlag } from "../src/lib/featureFlags.ts";
import { RUN_STORE_ACTIONS } from "../src/run/data/RunStore.tsx";
import { lastRunWorld, openRunWorldCount, readRunReturn, rememberRunReturn } from "../src/run/nav.ts";
import { runDocumentPath } from "../worker/runAssets.js";

test("Run is a Certo module in the sidebar and opens the desk", () => {
  assert.equal(resolveFeatureFlag("commandRun", { environment: "test" }), false);
  const desk = readFileSync("src/components/DelivereeWorkspace.tsx", "utf8");
  assert.match(desk, /data-testid="nav-certo-run"/);
  assert.match(desk, /data-testid="nav-certo-run-count"/);
  assert.match(desk, /navigate\("\/run"\)/);
  assert.match(desk, /CertoRunDeskLazy/);
  assert.equal(desk.includes("window.location.assign(\"/run\")"), false);
  assert.equal(desk.includes("isProductFlagEnabled(\"commandRun\")"), false);
});

test("/run stays on the Certo document", () => {
  assert.equal(runDocumentPath("/run", "GET"), null);
  assert.equal(runDocumentPath("/run/today", "GET"), null);
  assert.equal(runDocumentPath("/run/queue", "HEAD"), null);
  assert.equal(runDocumentPath("/home", "GET"), null);
  const worker = readFileSync("worker/index.js", "utf8");
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.equal(worker.includes("runDocumentPath"), false);
  assert.match(worker, /from "\.\/runDomain\.js"/);
  assert.equal(wrangler.includes("\"/run\""), false);
});

test("Certo has one document and Run is a route in it", () => {
  assert.equal(existsSync("run.html"), false);
  assert.equal(existsSync("src/run/entry.html"), false);
  assert.equal(existsSync("src/run/main.tsx"), false);
  const vite = readFileSync("vite.config.ts", "utf8");
  const server = readFileSync("server.ts", "utf8");
  const pkg = readFileSync("package.json", "utf8");
  const certoMain = readFileSync("src/main.tsx", "utf8");
  assert.equal(vite.includes("entry.html"), false);
  assert.equal(vite.includes("run.html"), false);
  assert.equal(server.includes("run.html"), false);
  assert.equal(server.includes("isRunDocument"), false);
  assert.equal(pkg.includes("dist/run"), false);
  assert.equal(certoMain.includes("src/run/"), false);
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
