/**
 * Dry-run only. Reads saved-view JSON from stdin and prints a rename plan.
 * Does not write to Firestore.
 *
 *   tsx scripts/rename-duplicate-views.ts < views.json
 *
 * Rollback: write each row's `from` back onto that view name.
 * A second run on the renamed list prints an empty plan.
 */
import { planDuplicateViewRenames, type StoredViewName } from "../src/lib/views/duplicateViewNames";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

const raw = (await readStdin()).trim();
const records = raw ? (JSON.parse(raw) as StoredViewName[]) : [];
const plan = planDuplicateViewRenames(Array.isArray(records) ? records : []);
process.stdout.write(`${JSON.stringify({ dryRun: true, count: plan.length, plan }, null, 2)}\n`);
