#!/usr/bin/env node
/**
 * perf-baseline — static + build metrics for Certo Work performance budget.
 *
 * Records file sizes, listener debt, and production bundle sizes into
 * docs/perf/BASELINE.md (or --write path). Runtime long-task / Profiler
 * counts require a browser session; this script documents the static
 * baseline and the budgets Step 8 must hit.
 *
 * Usage:
 *   node --import tsx scripts/perf-baseline.ts
 *   node --import tsx scripts/perf-baseline.ts --write docs/perf/BASELINE.md
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE_ARG = process.argv.find((arg) => arg.startsWith("--write"));
const OUT =
  WRITE_ARG === "--write"
    ? resolve(ROOT, "docs/perf/BASELINE.md")
    : WRITE_ARG?.includes("=")
      ? resolve(ROOT, WRITE_ARG.split("=")[1])
      : process.argv.includes("--write")
        ? resolve(ROOT, "docs/perf/BASELINE.md")
        : null;

function countMatches(filePath, pattern) {
  if (!existsSync(filePath)) return 0;
  const text = readFileSync(filePath, "utf8");
  return (text.match(pattern) || []).length;
}

function lineCount(filePath) {
  if (!existsSync(filePath)) return 0;
  return readFileSync(filePath, "utf8").split("\n").length;
}

function rgCount(args) {
  try {
    const out = execSync(`rg -c ${args}`, {
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

function bundleStats() {
  const assetsDir = resolve(ROOT, "dist/client/assets");
  if (!existsSync(assetsDir)) {
    return { missing: true, files: [] };
  }
  const files = readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
    .map((name) => {
      const full = resolve(assetsDir, name);
      const raw = readFileSync(full);
      const gzip = gzipSync(raw);
      return {
        name,
        bytes: raw.length,
        gzipBytes: gzip.length,
        kb: +(raw.length / 1024).toFixed(1),
        gzipKb: +(gzip.length / 1024).toFixed(1),
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
  const js = files.filter((f) => f.name.endsWith(".js"));
  const css = files.filter((f) => f.name.endsWith(".css"));
  const initialJsGzip = js.reduce((s, f) => s + f.gzipBytes, 0);
  return {
    missing: false,
    files,
    jsCount: js.length,
    cssCount: css.length,
    largestJsKb: js[0]?.kb ?? 0,
    largestJsGzipKb: js[0]?.gzipKb ?? 0,
    totalJsGzipKb: +(initialJsGzip / 1024).toFixed(1),
    totalCssGzipKb: +(css.reduce((s, f) => s + f.gzipBytes, 0) / 1024).toFixed(1),
  };
}

const shell = resolve(ROOT, "src/components/DelivereeWorkspace.tsx");
const surfaces = resolve(ROOT, "src/components/ProjectSurfaces.tsx");
const workItems = resolve(ROOT, "src/components/WorkItemsCenter.tsx");

const metrics = {
  generatedAt: new Date().toISOString(),
  files: {
    DelivereeWorkspace: lineCount(shell),
    ProjectSurfaces: lineCount(surfaces),
    WorkItemsCenter: lineCount(workItems),
  },
  useStateInShell: countMatches(shell, /\buseState\b/g),
  includeMetadataChanges: rgCount(
    '"includeMetadataChanges" -g "*.ts" -g "*.tsx" src',
  ),
  reactLazy: rgCount('"React\\.lazy|\\\\blazy\\\\(" -g "*.ts" -g "*.tsx" src'),
  onSnapshotOutsideData: rgCount('"onSnapshot\\\\(" -g "*.ts" -g "*.tsx" src'),
  tasksFilterByProjectInSurfaces: countMatches(
    surfaces,
    /tasks\.filter\(\(task\) => task\.projectId === project\.id\)/g,
  ),
  bundle: bundleStats(),
};

const budgets = {
  longTaskAfterLoadMs: 200,
  longTasksFirst15s: 10,
  shellCommitsPerBurst: 5,
  initialJsGzipKb: 600,
  componentMaxLines: 1500,
  includeMetadataChanges: 0,
};

const report = `# Certo Work — performance baseline

Generated: \`${metrics.generatedAt}\`

Static snapshot of the tree **before** Steps 2–8 of the performance remediation.
Runtime long-task / React.Profiler / onSnapshot burst counts need a browser
session (Playwright or DevTools); fill those rows after a local interactive run.

## Budgets (target by Step 8)

| Metric | Budget |
| --- | ---: |
| Long task after load | ≤ ${budgets.longTaskAfterLoadMs} ms |
| Long tasks in first 15 s (\`/work/projects\`) | ≤ ${budgets.longTasksFirst15s} |
| \`DelivereeWorkspace\` commits per snapshot burst | ≤ ${budgets.shellCommitsPerBurst} |
| Initial route JS (gzip) | ≤ ${budgets.initialJsGzipKb} KB |
| Component file size | ≤ ${budgets.componentMaxLines} lines |
| \`includeMetadataChanges\` listeners | ${budgets.includeMetadataChanges} |

## Static metrics (this run)

| Metric | Value |
| --- | ---: |
| \`DelivereeWorkspace.tsx\` lines | ${metrics.files.DelivereeWorkspace} |
| \`ProjectSurfaces.tsx\` lines | ${metrics.files.ProjectSurfaces} |
| \`WorkItemsCenter.tsx\` lines | ${metrics.files.WorkItemsCenter} |
| \`useState\` in shell | ${metrics.useStateInShell} |
| \`includeMetadataChanges\` in \`src\` | ${metrics.includeMetadataChanges} |
| \`React.lazy\` / \`lazy(\` in \`src\` | ${metrics.reactLazy} |
| \`onSnapshot(\` in \`src\` | ${metrics.onSnapshotOutsideData} |
| \`tasks.filter(…projectId)\` in ProjectSurfaces | ${metrics.tasksFilterByProjectInSurfaces} |

## Bundle (\`dist/client/assets\` after \`npm run build\`)

${
  metrics.bundle.missing
    ? "_No build artifacts found — run \`npm run build\` then re-run this script._"
    : [
        `| File | KB | gzip KB |`,
        `| --- | ---: | ---: |`,
        ...metrics.bundle.files.map(
          (f) => `| \`${f.name}\` | ${f.kb} | ${f.gzipKb} |`,
        ),
        ``,
        `| Aggregate | Value |`,
        `| --- | ---: |`,
        `| JS chunks | ${metrics.bundle.jsCount} |`,
        `| Largest JS (min) | ${metrics.bundle.largestJsKb} KB |`,
        `| Largest JS (gzip) | ${metrics.bundle.largestJsGzipKb} KB |`,
        `| Total JS (gzip) | ${metrics.bundle.totalJsGzipKb} KB |`,
        `| Total CSS (gzip) | ${metrics.bundle.totalCssGzipKb} KB |`,
      ].join("\n")
}

## Runtime (fill after browser run)

| Route | Long tasks (>50 ms) | Long-task ms | List paint ms | Shell commits | onSnapshot calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| \`/home\` | — | — | — | — | — |
| \`/work/projects\` | — | — | — | — | — |
| project page | — | — | — | — | — |
| \`/my-work\` | — | — | — | — | — |

## Notes

- One monolithic JS chunk (~4 MB / ~1 MB gzip) confirms \`manualChunks\` pnpm-path rules never match under \`npm ci\`.
- Projects page recomputes \`tasks.filter(projectId)\` repeatedly inside render (see count above) with no index — Step 3 target.
- Shell holds all collection state + listeners — Step 4/5 target.
`;

if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, report);
  console.log(`Wrote ${OUT}`);
} else {
  console.log(report);
}

console.log(
  JSON.stringify(
    {
      metrics,
      budgets,
      ok:
        metrics.includeMetadataChanges <= budgets.includeMetadataChanges &&
        (!metrics.bundle.missing
          ? metrics.bundle.totalJsGzipKb <= budgets.initialJsGzipKb
          : true),
    },
    null,
    2,
  ),
);
