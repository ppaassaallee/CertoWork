#!/usr/bin/env node
/**
 * lint:budget — counts debt markers and fails if any metric rises vs lint-budget.json.
 *
 * Metrics (runbook Paso 0): any · select · gray · localeTernaries · confirm
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const BUDGET_PATH = resolve(ROOT, "lint-budget.json");
const WRITE = process.argv.includes("--write") || process.argv.includes("--init");

/**
 * @param {string[]} patterns
 * @param {string[]} globs  e.g. ["*.ts", "*.tsx"]
 * @param {string[]} paths  e.g. ["src"]
 */
function walkFiles(dir, extensions, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walkFiles(path, extensions, out);
    else if (extensions.has(extname(name))) out.push(path);
  }
  return out;
}

/**
 * Node walk used when rg is missing. A missing counter must not look like zero debt.
 * Patterns are one alternation, the same way rg ORs `-e` flags, so `any[]`
 * is one match rather than both `: any` and `any[`.
 */
function nodeCount(patterns, extensions) {
  const combined = new RegExp(patterns.map((pattern) => `(?:${pattern})`).join("|"), "g");
  let total = 0;
  for (const file of walkFiles(resolve(ROOT, "src"), extensions)) {
    const text = readFileSync(file, "utf8");
    const matches = text.match(combined);
    if (matches) total += matches.length;
    combined.lastIndex = 0;
  }
  return total;
}

function rgCount(patterns, globs, paths = ["src"]) {
  const args = ["-n", "--no-heading", "--count-matches"];
  for (const g of globs) args.push("-g", g);
  for (const p of patterns) args.push("-e", p);
  args.push(...paths);
  const result = spawnSync("rg", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const rgOk = !result.error && (result.status === 0 || result.status === 1);
  if (!rgOk) {
    const extensions = new Set(
      globs.map((glob) => glob.replace("*", "")).filter((ext) => ext.startsWith(".")),
    );
    if (!extensions.size) {
      console.error(result.stderr || result.error?.message || "rg failed and no file types were given");
      process.exit(1);
    }
    console.error("rg is not usable; counting with a file walk so a missing tool cannot report zero.");
    return nodeCount(patterns, extensions);
  }
  let total = 0;
  for (const line of (result.stdout || "").split("\n")) {
    const m = line.match(/:(\d+)\s*$/);
    if (m) total += Number(m[1]);
  }
  return total;
}

const TS = ["*.ts", "*.tsx"];
const TSX = ["*.tsx", "*.jsx"];
const STYLE = ["*.ts", "*.tsx", "*.js", "*.jsx", "*.css"];

const current = {
  generatedAt: new Date().toISOString(),
  any: rgCount(
    [String.raw`:\s*any\b`, String.raw`\bas any\b`, "<any>", String.raw`\bany\[`],
    TS,
  ),
  select: rgCount([String.raw`<select\b`], TSX),
  gray: rgCount(
    [String.raw`\b(bg|text|border|ring|from|to|via)-(gray|slate|zinc)-`],
    STYLE,
  ),
  localeTernaries: rgCount(
    [
      String.raw`locale\s*===\s*["']es["']`,
      String.raw`locale\s*===\s*["']en["']`,
      String.raw`getLocale\(\)\s*===\s*["']es["']`,
      String.raw`getLocale\(\)\s*===\s*["']en["']`,
    ],
    TS,
  ),
  confirm: rgCount([String.raw`window\.(confirm|alert)\s*\(`], ["*.ts", "*.tsx", "*.js", "*.jsx"]),
  notes: {
    any: "`: any`, `as any`, `<any>`, `any[` in src",
    select: "`<select` JSX openings in src",
    gray: "Tailwind gray/slate/zinc color utilities in src",
    localeTernaries: "`locale === \"es|en\"` / getLocale() ternaries",
    confirm: "`window.confirm|alert(` calls",
  },
};

if (WRITE || !existsSync(BUDGET_PATH)) {
  const baseline = {
    ...current,
    source: "paso-0-baseline",
    runbookTargets: {
      any: 1158,
      select: 297,
      gray: 4222,
      localeTernaries: 187,
      confirm: 14,
    },
  };
  writeFileSync(BUDGET_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Wrote ${BUDGET_PATH}`);
  console.log(JSON.stringify(current, null, 2));
  process.exit(0);
}

const budget = JSON.parse(readFileSync(BUDGET_PATH, "utf8"));
const keys = ["any", "select", "gray", "localeTernaries", "confirm"];
const regressions = [];
for (const key of keys) {
  const limit = Number(budget[key] ?? 0);
  const value = Number(current[key] ?? 0);
  if (value > limit) {
    regressions.push({ key, limit, value, delta: value - limit });
  }
}

console.log("lint:budget current vs baseline");
for (const key of keys) {
  const limit = Number(budget[key] ?? 0);
  const value = Number(current[key] ?? 0);
  const mark = value > limit ? "REGRESS" : value < limit ? "improved" : "ok";
  console.log(`  ${key}: ${value} / budget ${limit} (${mark})`);
}

if (regressions.length) {
  console.error("\nDebt budget exceeded — CI fail:");
  for (const row of regressions) {
    console.error(`  ${row.key}: ${row.value} > ${row.limit} (+${row.delta})`);
  }
  process.exit(1);
}

console.log("\nDebt budget OK (no metric rose).");
process.exit(0);
