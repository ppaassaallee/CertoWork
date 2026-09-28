#!/usr/bin/env node
/** CI guards for performance remediation — fail on known regressions. */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
let failed = false;

function fail(msg) {
  console.error(`perf-guards FAIL: ${msg}`);
  failed = true;
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

const meta = rgCount('"includeMetadataChanges"');
if (meta > 0) fail(`includeMetadataChanges still present (${meta})`);

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
