/**
 * Dry-run only. Reads item JSON from stdin and prints a tag cleanup plan.
 * Does not write to Firestore.
 *
 *   tsx scripts/dedupe-item-tags.ts < items.json
 *   tsx scripts/dedupe-item-tags.ts --catalog catalog.json < items.json
 *
 * Rollback: write each plan row's `before` array back to tagIds, tags, and labels.
 * A second run on the `after` arrays prints an empty plan.
 */
import { readFileSync } from "node:fs";
import { planTagCleanup, type TagLike } from "../src/lib/tagging";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

const catalogFlag = process.argv.indexOf("--catalog");
const catalogPath = catalogFlag >= 0 ? process.argv[catalogFlag + 1] : "";
const catalog: TagLike[] = catalogPath
  ? (JSON.parse(readFileSync(catalogPath, "utf8")) as TagLike[])
  : [];

const raw = (await readStdin()).trim();
const records = raw ? (JSON.parse(raw) as unknown[]) : [];
const plan = planTagCleanup(Array.isArray(records) ? records : [], catalog);
process.stdout.write(`${JSON.stringify({ dryRun: true, count: plan.length, plan }, null, 2)}\n`);
