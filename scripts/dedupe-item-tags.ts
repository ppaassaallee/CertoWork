/**
 * Dry-run only. Reads item JSON from stdin and prints a tag cleanup plan.
 * Does not write to Firestore. There is no --apply flag.
 *
 * Owner runbook (review the report before any future write, and do not point
 * this at production from an unattended job):
 *
 *   1. Export work items and the tag catalog to local JSON with a read-only
 *      console session. Do not paste production credentials into this script.
 *   2. Preview and write a review file:
 *
 *      npx tsx scripts/dedupe-item-tags.ts \
 *        --catalog catalog.json \
 *        --out tag-plan.json \
 *        --csv tag-plan.csv < items.json
 *
 *   3. Open tag-plan.csv. Each row is one item. `before` is the stored ids
 *      joined by `|`. `after` is the ids that would remain.
 *   4. Rollback of a future write is each row's `before` array copied back
 *      onto tagIds, tags, and labels. A second dry-run on the `after` arrays
 *      prints an empty plan.
 *   5. This script refuses --apply. Applying the plan is a separate reviewed
 *      change. Do not run it against production from this repository task.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { planTagCleanup, tagCleanupCsv, type TagLike } from "../src/lib/tagging";

if (process.argv.includes("--apply")) {
  process.stderr.write("dedupe-item-tags is dry-run only. Remove --apply and review the CSV before any write.\n");
  process.exit(1);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

function flagValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

const catalogPath = flagValue("--catalog");
const outPath = flagValue("--out");
const csvPath = flagValue("--csv");
const catalog: TagLike[] = catalogPath
  ? (JSON.parse(readFileSync(catalogPath, "utf8")) as TagLike[])
  : [];

const raw = (await readStdin()).trim();
const records = raw ? (JSON.parse(raw) as unknown[]) : [];
const plan = planTagCleanup(Array.isArray(records) ? records : [], catalog);
const report = { dryRun: true, count: plan.length, plan };
const json = `${JSON.stringify(report, null, 2)}\n`;
if (outPath) writeFileSync(outPath, json);
if (csvPath) writeFileSync(csvPath, tagCleanupCsv(plan));
process.stdout.write(json);
