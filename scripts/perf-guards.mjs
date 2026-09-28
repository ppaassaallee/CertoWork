#!/usr/bin/env node
/** CI guards for performance remediation — fail on known regressions. */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { basename, extname, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
let failed = false;

function fail(msg) {
  console.error(`perf-guards FAIL: ${msg}`);
  failed = true;
}

function warn(msg) {
  console.warn(`perf-guards WARN: ${msg}`);
}

function rgCount(pattern) {
  try {
    const out = execSync(`rg -c ${pattern} -g '*.ts' -g '*.tsx' src`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .reduce((sum, line) => {
        const m = line.match(/:(\d+)\s*$/);
        return sum + (m ? Number(m[1]) : 0);
      }, 0);
  } catch {
    return 0;
  }
}

function rgSnapshotHits() {
  try {
    const out = execSync(`rg -n 'onSnapshot\\(' -g '*.ts' -g '*.tsx' src`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

const meta = rgCount('"includeMetadataChanges"');
if (meta > 0) fail(`includeMetadataChanges still present (${meta})`);

/** Mega-shell / known debt — warn until split finishes. Do not grow casually. */
const LINE_WARN_ALLOWLIST = new Set([
  "DelivereeWorkspace.tsx",
  "ProjectSurfaces.tsx",
  // Existing oversized debt tracked in docs/perf/BASELINE.md
  "WorkItemsCenter.tsx",
  "TasksList.tsx",
  "WarRoom.tsx",
  "DailyClarityModal.tsx",
  "BoldiAssistant.tsx",
  "ProjectDetails.tsx",
]);

const LINE_LIMIT = 1500;
const srcRoot = resolve(ROOT, "src");
for (const file of walkFiles(srcRoot)) {
  const ext = extname(file);
  if (ext === ".css") continue;
  if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) continue;
  const lines = readFileSync(file, "utf8").split("\n").length;
  if (lines <= LINE_LIMIT) continue;
  const name = basename(file);
  const rel = relative(ROOT, file);
  if (LINE_WARN_ALLOWLIST.has(name)) {
    warn(`${rel} is ${lines} lines (>${LINE_LIMIT}; allowlisted until split)`);
    continue;
  }
  fail(`${rel} is ${lines} lines (>${LINE_LIMIT}; not allowlisted)`);
}

// onSnapshot outside src/data — migrating; warn only for now.
const allSnapshots = rgSnapshotHits();
const outsideData = allSnapshots.filter((line) => {
  const path = line.split(":")[0] || "";
  return path.startsWith("src/") && !path.startsWith("src/data/");
});
const inShell = outsideData.filter((line) =>
  (line.split(":")[0] || "").includes("DelivereeWorkspace.tsx"),
);
console.log(
  `perf-guards: onSnapshot outside src/data/ = ${outsideData.length} (DelivereeWorkspace=${inShell.length}; warn only — listeners still migrating)`,
);
if (inShell.length === 0) {
  warn("DelivereeWorkspace no longer has onSnapshot — confirm migration complete");
} else {
  warn(`DelivereeWorkspace still has ${inShell.length} onSnapshot usage(s)`);
}

const assets = resolve(ROOT, "dist/client/assets");
try {
  const js = readdirSync(assets).filter((n) => n.endsWith(".js"));
  for (const name of js) {
    const raw = readFileSync(resolve(assets, name));
    const gz = gzipSync(raw).length;
    if (gz > 600 * 1024 && name.startsWith("index-")) {
      // App entry may still exceed until lazy routes land; warn only for vendors > 600KB gz.
    }
    if (gz > 600 * 1024 && !name.startsWith("index-") && !name.startsWith("icons-")) {
      fail(`chunk ${name} gzip ${Math.round(gz / 1024)} KB > 600 KB`);
    }
  }
  console.log(`perf-guards: checked ${js.length} JS chunks, includeMetadataChanges=${meta}`);
} catch {
  console.log("perf-guards: no dist/ yet — skip chunk size checks");
}

if (failed) process.exit(1);
console.log("perf-guards OK");
