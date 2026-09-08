/**
 * Admin one-shot: sync Pure AI projects from Pricing_Data_Portafolio_IA_2026.
 *
 * Requires one of:
 * - FIREBASE_SERVICE_ACCOUNT (JSON string)
 * - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * Usage: pnpm exec tsx scripts/sync-pricing-portfolio.ts
 */
import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import pricingFile from "../src/data/pricingPortfolio2026.json";
import {
  isPureAiWorkspace,
  resolvePortfolioShareTargets,
} from "../src/lib/portfolioMasterImport";
import {
  PRICING_PORTFOLIO_IMPORT_KEY,
  PRICING_PORTFOLIO_SOURCE,
  buildPricingProjectPayload,
  buildPricingProjectUpdate,
  hasUnmatchedPrefix,
  matchPricingProjects,
  stripUnmatchedPrefix,
  withUnmatchedPrefix,
  type PricingPortfolioFile,
} from "../src/lib/pricingPortfolioSync";
import type { WorkspaceMember } from "../src/lib/workspaceCollaboration";

const BATCH_LIMIT = 400;
const data = pricingFile as PricingPortfolioFile;

function loadCredential() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (raw) {
    const parsed = JSON.parse(raw);
    return cert(parsed);
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (clientEmail && privateKey) {
    return cert({
      projectId: firebaseConfig.projectId,
      clientEmail,
      privateKey,
    });
  }
  throw new Error(
    "Missing FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY",
  );
}

async function commitInChunks(
  db: Firestore,
  ops: Array<(batch: ReturnType<Firestore["batch"]>) => void>,
) {
  for (let index = 0; index < ops.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    ops.slice(index, index + BATCH_LIMIT).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

async function main() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!getApps().length) {
    initializeApp({
      credential: loadCredential(),
      projectId: firebaseConfig.projectId,
    });
  }
  const db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(firebaseConfig.firestoreDatabaseId)
    : getFirestore();

  const workspacesSnap = await db.collection("workspaces").get();
  const pureAi = workspacesSnap.docs.find((doc) =>
    isPureAiWorkspace(doc.data() as { name?: string }),
  );
  if (!pureAi) {
    throw new Error("Pure AI workspace not found");
  }
  const workspace = { id: pureAi.id, ...pureAi.data() } as {
    id: string;
    name?: string;
    ownerId?: string;
  };
  console.log(`Pure AI workspace: ${workspace.id} (${workspace.name})`);

  const membersSnap = await db
    .collection("workspace_members")
    .where("workspaceId", "==", workspace.id)
    .get();
  const members = membersSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as WorkspaceMember,
  );
  const share = resolvePortfolioShareTargets(members);
  const ownerId = String(workspace.ownerId || "");
  const ownerMember = members.find((member) => member.userId === ownerId);
  const ownerEmail = ownerMember?.email || ownerMember?.emailLower || null;

  const projectsSnap = await db
    .collection("projects")
    .where("workspaceId", "==", workspace.id)
    .get();
  const certoProjects = projectsSnap.docs.map((doc) => {
    const row = doc.data();
    return {
      id: doc.id,
      title: row.title,
      name: row.name,
      shortTitle: row.shortTitle,
      projectKey: row.projectKey,
      importKey: row.importKey,
      clientEntity: row.clientEntity,
      client: row.client,
      deliveryEntity: row.deliveryEntity,
      bpo: row.bpo,
      technology: row.technology,
      serviceLine: row.serviceLine,
      excel: row.excel,
    };
  });

  const match = matchPricingProjects(data.projects, certoProjects);
  console.log(
    `Match preview: update=${match.matched.length} create=${match.unmatchedPricing.length} markX=${match.unmatchedCertoIds.length}`,
  );

  const byId = new Map(projectsSnap.docs.map((doc) => [doc.id, doc]));
  const ops: Array<(batch: ReturnType<Firestore["batch"]>) => void> = [];

  for (const item of match.matched) {
    const existing = byId.get(item.projectId!);
    if (!existing) continue;
    const payload = buildPricingProjectUpdate(item.pricing);
    ops.push((batch) =>
      batch.update(existing.ref, {
        ...payload,
        title: stripUnmatchedPrefix(payload.title),
        name: stripUnmatchedPrefix(payload.name),
        updatedAt: FieldValue.serverTimestamp(),
        pricingSyncedAt: FieldValue.serverTimestamp(),
        pricingMatchConfidence: item.confidence,
        pricingMatchReason: item.reason,
      }),
    );
  }

  for (const pricing of match.unmatchedPricing) {
    ops.push((batch) => {
      const ref = db.collection("projects").doc();
      batch.set(ref, {
        ...buildPricingProjectPayload(pricing, {
          userId: ownerId || "admin-sync",
          email: ownerEmail,
          workspaceId: workspace.id,
          shareUserIds: share.userIds,
          shareMemberIds: share.memberIds,
          shareEmails: share.emails,
          shareLabels: share.labels,
        }),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        pricingSyncedAt: FieldValue.serverTimestamp(),
        pricingMatchConfidence: 0,
        pricingMatchReason: "created",
      });
    });
  }

  for (const projectId of match.unmatchedCertoIds) {
    const existing = byId.get(projectId);
    if (!existing) continue;
    const row = existing.data();
    const currentTitle = String(row.title || row.name || "").trim();
    if (!currentTitle || hasUnmatchedPrefix(currentTitle)) continue;
    const marked = withUnmatchedPrefix(currentTitle);
    ops.push((batch) =>
      batch.update(existing.ref, {
        title: marked,
        name: marked,
        normalizedTitle: marked.toLowerCase().replace(/\s+/g, " "),
        pricingUnmatched: true,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
  }

  await commitInChunks(db, ops);
  await pureAi.ref.update({
    portfolioImportKey: PRICING_PORTFOLIO_IMPORT_KEY,
    portfolioImportSource: PRICING_PORTFOLIO_SOURCE,
    portfolioImportCount: data.projects.length,
    portfolioImportAt: FieldValue.serverTimestamp(),
    pricingPortfolioSyncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        updatedProjects: match.matched.length,
        createdProjects: match.unmatchedPricing.length,
        markedUnmatched: match.unmatchedCertoIds.length,
        sharedWith: share.labels,
        missingAliases: share.missingAliases,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
