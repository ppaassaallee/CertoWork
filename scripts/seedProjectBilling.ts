/**
 * Seed projectBilling/{projectId} from existing project cost fields.
 * Dry-run by default. Pass --write to apply.
 *
 *   npx tsx scripts/seedProjectBilling.ts
 *   npx tsx scripts/seedProjectBilling.ts --write
 */
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const write = process.argv.includes("--write");

async function main() {
  if (!getApps().length) {
    try {
      initializeApp({ credential: applicationDefault() });
    } catch {
      console.log("Step 12 — seedProjectBilling: Firebase Admin not configured; dry-run sample only.");
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            sample: {
              projectId: "example",
              recurringAmount: 30292,
              currency: "USD",
              billingDay: 1,
              termsDays: 30,
              autoGenerate: true,
            },
          },
          null,
          2,
        ),
      );
      return;
    }
  }
  const db = getFirestore();
  const projects = await db.collection("projects").limit(200).get();
  let n = 0;
  for (const p of projects.docs) {
    const d = p.data() as Record<string, unknown>;
    const recurring =
      Number(d.monthlyRecurring || d.recurringAmount || d.monthlyCost || 0) || 0;
    if (!recurring && !d.initialInvestment && !d.budget) continue;
    const payload = {
      projectId: p.id,
      workspaceId: String(d.workspaceId || ""),
      recurringAmount: recurring,
      currency: String(d.currency || "USD"),
      billingDay: Number(d.billingDay || 1),
      termsDays: Number(d.termsDays || 30),
      oneTime: [] as Array<{ label: string; amount: number; dueDate: string }>,
      autoGenerate: true,
      clientId: String(d.clientId || d.customerId || ""),
      deliveryEntity: String(d.deliveryEntity || d.entity || ""),
      projectName: String(d.name || d.title || p.id),
    };
    console.log(write ? "WRITE" : "DRY", p.id, payload.recurringAmount, payload.currency);
    if (write) {
      await db.doc(`projectBilling/${p.id}`).set(payload, { merge: true });
    }
    n += 1;
  }
  console.log(`${write ? "Wrote" : "Would write"} ${n} projectBilling docs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
