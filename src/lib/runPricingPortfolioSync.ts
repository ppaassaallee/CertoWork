import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { WorkspaceMember } from "./workspaceCollaboration";
import {
  isPureAiWorkspace,
  resolvePortfolioShareTargets,
} from "./portfolioMasterImport";
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
  type PricingProjectRow,
} from "./pricingPortfolioSync";
import pricingFile from "../data/pricingPortfolio2026.json";

const PRICING_DATA = pricingFile as PricingPortfolioFile;
const BATCH_LIMIT = 400;

async function commitInChunks(
  db: Firestore,
  operations: Array<(batch: ReturnType<typeof writeBatch>) => void>,
) {
  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db);
    operations.slice(index, index + BATCH_LIMIT).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

export function pricingPortfolioProjectCount() {
  return PRICING_DATA.projectCount;
}

export function pricingPortfolioTransactionCount() {
  return PRICING_DATA.transactionCount;
}

export async function syncPureAiPricingPortfolio(input: {
  db: Firestore;
  user: { uid: string; email?: string | null };
  workspace: {
    id: string;
    name?: string;
    ownerId?: string;
    portfolioImportKey?: string | null;
  };
  members: WorkspaceMember[];
  pricingProjects?: PricingProjectRow[];
}) {
  if (!isPureAiWorkspace(input.workspace)) {
    return { skipped: true as const, reason: "not-pure-ai" };
  }
  if (input.workspace.ownerId !== input.user.uid) {
    return { skipped: true as const, reason: "not-owner" };
  }

  const pricingProjects = input.pricingProjects || PRICING_DATA.projects;
  const share = resolvePortfolioShareTargets(input.members);
  const projectsSnap = await getDocs(
    query(collection(input.db, "projects"), where("workspaceId", "==", input.workspace.id)),
  );

  const certoProjects = projectsSnap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      title: data.title,
      name: data.name,
      shortTitle: data.shortTitle,
      projectKey: data.projectKey,
      importKey: data.importKey,
      clientEntity: data.clientEntity,
      client: data.client,
      deliveryEntity: data.deliveryEntity,
      bpo: data.bpo,
      technology: data.technology,
      serviceLine: data.serviceLine,
      excel: data.excel,
    };
  });

  const match = matchPricingProjects(pricingProjects, certoProjects);
  const byId = new Map(projectsSnap.docs.map((item) => [item.id, item]));

  const updates: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const item of match.matched) {
    const existing = byId.get(item.projectId!);
    if (!existing) continue;
    const payload = buildPricingProjectUpdate(item.pricing);
    updates.push((batch) =>
      batch.update(existing.ref, {
        ...payload,
        // Drop any prior "X " unmatched marker once pricing finds the project.
        title: stripUnmatchedPrefix(payload.title),
        name: stripUnmatchedPrefix(payload.name),
        updatedAt: serverTimestamp(),
        pricingSyncedAt: serverTimestamp(),
        pricingMatchConfidence: item.confidence,
        pricingMatchReason: item.reason,
      }),
    );
  }

  for (const pricing of match.unmatchedPricing) {
    updates.push((batch) => {
      const ref = doc(collection(input.db, "projects"));
      batch.set(ref, {
        ...buildPricingProjectPayload(pricing, {
          userId: input.user.uid,
          email: input.user.email,
          workspaceId: input.workspace.id,
          shareUserIds: share.userIds,
          shareMemberIds: share.memberIds,
          shareEmails: share.emails,
          shareLabels: share.labels,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        pricingSyncedAt: serverTimestamp(),
        pricingMatchConfidence: 0,
        pricingMatchReason: "created",
      });
    });
  }

  for (const projectId of match.unmatchedCertoIds) {
    const existing = byId.get(projectId);
    if (!existing) continue;
    const data = existing.data();
    const currentTitle = String(data.title || data.name || "").trim();
    if (!currentTitle || hasUnmatchedPrefix(currentTitle)) continue;
    const marked = withUnmatchedPrefix(currentTitle);
    updates.push((batch) =>
      batch.update(existing.ref, {
        title: marked,
        name: marked,
        normalizedTitle: marked.toLowerCase().replace(/\s+/g, " "),
        pricingUnmatched: true,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  await commitInChunks(input.db, updates);

  await updateDoc(doc(input.db, "workspaces", input.workspace.id), {
    portfolioImportKey: PRICING_PORTFOLIO_IMPORT_KEY,
    portfolioImportSource: PRICING_PORTFOLIO_SOURCE,
    portfolioImportCount: pricingProjects.length,
    portfolioImportAt: serverTimestamp(),
    pricingPortfolioSyncedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    skipped: false as const,
    updatedProjects: match.matched.length,
    createdProjects: match.unmatchedPricing.length,
    markedUnmatched: match.unmatchedCertoIds.length,
    sharedWith: share.labels,
    missingAliases: share.missingAliases,
    matches: match.matched.map((item) => ({
      projectId: item.projectId,
      pricingId: item.pricing.projectId,
      title: item.pricing.title,
      confidence: item.confidence,
      reason: item.reason,
    })),
  };
}
