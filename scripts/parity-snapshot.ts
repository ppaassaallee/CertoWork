#!/usr/bin/env tsx
/**
 * Track A parity snapshot — static analysis fallback (no Playwright).
 * Records routes, interactive controls (role/name/testid/href/handlerHash),
 * and Firestore collection string refs found near route-related source files.
 *
 * Usage:
 *   npx tsx scripts/parity-snapshot.ts --out docs/clean-ui/parity/baseline.json
 *   npx tsx scripts/parity-snapshot.ts --out docs/clean-ui/parity/after.json
 *   npx tsx scripts/parity-snapshot.ts --compare docs/clean-ui/parity/baseline.json docs/clean-ui/parity/after.json
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  lensToPath,
  type DelivereeLens,
} from "../src/lib/delivereeRoutes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

type Control = {
  role: string;
  name: string;
  testId: string | null;
  href: string | null;
  handlerHash: string;
  source: string;
};

type RouteSnapshot = {
  path: string;
  routeId: string;
  lens: DelivereeLens;
  controls: Control[];
  collections: string[];
};

function hash(text: string) {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function walk(dir: string, acc: string[] = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function extractControls(filePath: string, source: string): Control[] {
  const controls: Control[] = [];
  const rel = path.relative(ROOT, filePath);
  // Buttons / links with identifiable attrs
  const tagRe =
    /<(button|a|input|select|textarea|summary)\b([^>]*?)(?:\/>|>)/gis;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(source))) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || "";
    if (/\bdisabled\b/.test(attrs) && /type=["']hidden["']/.test(attrs)) continue;
    const testId = attrs.match(/data-testid=["'{`]([^"'`}]+)["'`}]/)?.[1] || null;
    const aria = attrs.match(/aria-label=["'{`]([^"'`}]+)["'`}]/)?.[1] || null;
    const title = attrs.match(/title=["'{`]([^"'`}]+)["'`}]/)?.[1] || null;
    const href = attrs.match(/href=["'{`]([^"'`}]+)["'`}]/)?.[1] || null;
    const type = attrs.match(/type=["']([^"']+)["']/)?.[1] || null;
    const onClick = attrs.match(/onClick=\{([^}]+)\}/)?.[1]?.trim() || "";
    const onChange = attrs.match(/onChange=\{([^}]+)\}/)?.[1]?.trim() || "";
    const onSubmit = attrs.match(/onSubmit=\{([^}]+)\}/)?.[1]?.trim() || "";
    const handlerSrc = onClick || onChange || onSubmit || type || tag;
    const name = aria || title || testId || href || `${tag}:${type || "default"}`;
    const role =
      tag === "a"
        ? "link"
        : tag === "button" || type === "button" || type === "submit"
          ? "button"
          : tag === "input"
            ? type === "checkbox"
              ? "checkbox"
              : type === "radio"
                ? "radio"
                : "textbox"
            : tag === "select"
              ? "combobox"
              : tag === "textarea"
                ? "textbox"
                : tag;
    controls.push({
      role,
      name: String(name).slice(0, 120),
      testId,
      href,
      handlerHash: hash(handlerSrc),
      source: rel,
    });
  }
  // Icon-only / custom interactive with role=button and onClick on non-native tags
  const customRe =
    /<(div|span|li)\b([^>]*\bonClick=\{[^}]+\}[^>]*)>/gis;
  while ((match = customRe.exec(source))) {
    const attrs = match[2] || "";
    const testId = attrs.match(/data-testid=["'{`]([^"'`}]+)["'`}]/)?.[1] || null;
    const aria = attrs.match(/aria-label=["'{`]([^"'`}]+)["'`}]/)?.[1] || null;
    const onClick = attrs.match(/onClick=\{([^}]+)\}/)?.[1]?.trim() || "";
    if (!aria && !testId) continue;
    controls.push({
      role: "button",
      name: String(aria || testId).slice(0, 120),
      testId,
      href: null,
      handlerHash: hash(onClick),
      source: rel,
    });
  }
  return controls;
}

function extractCollections(source: string): string[] {
  const names = new Set<string>();
  const re =
    /(?:collection|doc)\(\s*(?:db|firestore)\s*,\s*["'`]([a-zA-Z0-9_]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) names.add(m[1]);
  const makeQuery = /makeQuery\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g;
  while ((m = makeQuery.exec(source))) names.add(m[1]);
  return [...names].sort();
}

function routeMatrix(): DelivereeLens[] {
  return [
    { kind: "home" },
    { kind: "my-work", section: "assigned" },
    { kind: "my-work", section: "inbox" },
    { kind: "my-work", section: "waiting" },
    { kind: "my-work", section: "today" },
    { kind: "my-work", section: "this_week" },
    { kind: "my-work", section: "captured" },
    { kind: "my-work", section: "reviews" },
    { kind: "work", section: "portfolio" },
    { kind: "work", section: "issues" },
    { kind: "work", section: "intake" },
    { kind: "agents", section: "home" },
    { kind: "agents", section: "automations" },
    { kind: "agents", section: "activity" },
    { kind: "routines" },
    { kind: "project", projectId: "sample-a", tab: "overview" },
    { kind: "project", projectId: "sample-a", tab: "notes" },
    { kind: "project", projectId: "sample-a", tab: "tasks" },
    { kind: "project", projectId: "sample-b", tab: "overview" },
    { kind: "approvals" },
    { kind: "invoices" },
    { kind: "settings" },
    { kind: "collab" },
    { kind: "feedback", section: "submit" },
    { kind: "feedback", section: "queue" },
    { kind: "requests", section: "inbox" },
    { kind: "requests", section: "mine" },
    { kind: "requests", section: "waiting" },
    { kind: "requests", section: "resolved" },
    { kind: "requests", section: "new" },
    { kind: "notes" },
    { kind: "tables" },
    { kind: "tables", tableId: "sample-table" },
    { kind: "dashboard" },
    { kind: "workload" },
    { kind: "more", section: "automations" },
    { kind: "more", section: "workspace" },
    { kind: "inbox" },
  ];
}

function sourceFilesForLens(lens: DelivereeLens): string[] {
  const files = new Set<string>();
  const addGlob = (dir: string) => walk(path.join(ROOT, dir)).forEach((f) => files.add(f));
  // Shared shell always present
  [
    "src/components/DelivereeWorkspace.tsx",
    "src/features/shell/DesktopRail.tsx",
    "src/layout/AppShell.tsx",
    "src/layout/Header.tsx",
    "src/layout/Sidebar.tsx",
  ].forEach((f) => {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) files.add(full);
  });

  switch (lens.kind) {
    case "home":
      addGlob("src/features/dayplan");
      addGlob("src/features/odysseus");
      break;
    case "my-work":
      addGlob("src/features/dayplan");
      files.add(path.join(ROOT, "src/components/WorkItemsCenter.tsx"));
      break;
    case "project":
    case "work":
      files.add(path.join(ROOT, "src/components/ProjectSurfaces.tsx"));
      addGlob("src/features/views");
      addGlob("src/features/projects");
      addGlob("src/features/overview");
      break;
    case "agents":
    case "routines":
      addGlob("src/components");
      addGlob("src/features");
      break;
    case "notes":
      files.add(path.join(ROOT, "src/components/NotesWorkspace.tsx"));
      break;
    case "tables":
    case "tables-dashboard":
      addGlob("src/features/tables");
      break;
    case "collab":
      addGlob("src/features/collab");
      break;
    case "invoices":
      addGlob("src/features/billing");
      break;
    case "settings":
      addGlob("src/features/settings");
      break;
    default:
      break;
  }
  return [...files].filter((f) => fs.existsSync(f));
}

function routeIdFor(lens: DelivereeLens) {
  if (lens.kind === "my-work") return `my-work:${lens.section}`;
  if (lens.kind === "work") return `work:${lens.section}`;
  if (lens.kind === "agents") return `agents:${lens.section}`;
  if (lens.kind === "project") return `project:${lens.projectId}:${lens.tab}`;
  if (lens.kind === "feedback") return `feedback:${lens.section}`;
  if (lens.kind === "requests") return `requests:${lens.section}`;
  if (lens.kind === "tables") return `tables:${lens.tableId || "index"}`;
  if (lens.kind === "more") return `more:${lens.section}`;
  if (lens.kind === "routines") return `routines:${lens.routineId || "index"}`;
  return lens.kind;
}

function snapshotRoutes(): RouteSnapshot[] {
  return routeMatrix().map((lens) => {
    const files = sourceFilesForLens(lens);
    const controls: Control[] = [];
    const collections = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      controls.push(...extractControls(file, source));
      extractCollections(source).forEach((c) => collections.add(c));
    }
    // Stable sort + dedupe by role|name|testid|handlerHash
    const seen = new Set<string>();
    const unique = controls
      .sort((a, b) =>
        `${a.role}|${a.name}|${a.testId}|${a.handlerHash}`.localeCompare(
          `${b.role}|${b.name}|${b.testId}|${b.handlerHash}`,
        ),
      )
      .filter((c) => {
        const key = `${c.role}|${c.name}|${c.testId}|${c.href}|${c.handlerHash}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return {
      path: lensToPath(lens),
      routeId: routeIdFor(lens),
      lens,
      controls: unique,
      collections: [...collections].sort(),
    };
  });
}

function controlKey(c: Control) {
  const name = c.name.replace(/\s+/g, " ").trim();
  if (c.testId) return `testid:${c.testId}|${c.handlerHash}`;
  if (c.href) return `href:${c.href}|${c.handlerHash}`;
  return `${c.role}|${name}|${c.handlerHash}`;
}

function compare(baselinePath: string, afterPath: string) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const after = JSON.parse(fs.readFileSync(afterPath, "utf8"));
  const diffs: string[] = [];
  const baseRoutes: RouteSnapshot[] = baseline.routes;
  const afterRoutes: RouteSnapshot[] = after.routes;
  const afterById = new Map(
    afterRoutes.map((r) => [r.routeId || r.path, r]),
  );
  for (const route of baseRoutes) {
    const id = route.routeId || route.path;
    const next = afterById.get(id);
    if (!next) {
      diffs.push(`MISSING_ROUTE ${id}`);
      continue;
    }
    const baseKeys = new Set(route.controls.map(controlKey));
    const nextKeys = new Set(next.controls.map(controlKey));
    for (const key of baseKeys) {
      if (!nextKeys.has(key)) diffs.push(`LOST_CONTROL ${id} :: ${key}`);
    }
    for (const key of nextKeys) {
      if (!baseKeys.has(key)) {
        if (!process.argv.includes("--allow-additions")) {
          diffs.push(`ADDED_CONTROL ${id} :: ${key}`);
        }
      }
    }
    const baseCols = new Set(route.collections);
    const nextCols = new Set(next.collections);
    for (const c of baseCols) {
      if (!nextCols.has(c)) diffs.push(`LOST_COLLECTION ${id} :: ${c}`);
    }
    if (!process.argv.includes("--allow-additions")) {
      for (const c of nextCols) {
        if (!baseCols.has(c)) diffs.push(`ADDED_COLLECTION ${id} :: ${c}`);
      }
    }
  }
  return diffs;
}

function writePlaceholderScreenshots(dir: string, routes: RouteSnapshot[]) {
  fs.mkdirSync(dir, { recursive: true });
  for (const route of routes) {
    const safe = route.path.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "root";
    const note = path.join(dir, `${safe}.txt`);
    fs.writeFileSync(
      note,
      `Screenshot placeholder for ${route.path}\nMode: static parity (no Playwright)\nControls: ${route.controls.length}\nCollections: ${route.collections.join(", ")}\n`,
    );
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--compare") {
    const diffs = compare(args[1], args[2]);
    const out = {
      ok: diffs.length === 0,
      diffCount: diffs.length,
      diffs: diffs.slice(0, 500),
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(diffs.length === 0 ? 0 : 1);
  }

  const outIdx = args.indexOf("--out");
  const outPath =
    outIdx >= 0
      ? path.resolve(args[outIdx + 1])
      : path.join(ROOT, "docs/clean-ui/parity/baseline.json");

  const routes = snapshotRoutes();
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: "static-source-analysis",
    viewportNote: "Playwright 1440x900 / 390x844 deferred — see ASSUMPTIONS.md",
    routeCount: routes.length,
    controlCount: routes.reduce((n, r) => n + r.controls.length, 0),
    routes,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  const shotDir = outPath.includes("after")
    ? path.join(ROOT, "docs/clean-ui/parity/after")
    : path.join(ROOT, "docs/clean-ui/parity/before");
  writePlaceholderScreenshots(shotDir, routes);
  console.log(
    `Wrote ${outPath} (${payload.routeCount} routes, ${payload.controlCount} controls)`,
  );
}

main();
