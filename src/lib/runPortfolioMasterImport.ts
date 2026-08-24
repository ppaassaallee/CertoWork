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
  PORTFOLIO_MASTER_IMPORT_KEY,
  PORTFOLIO_MASTER_SOURCE,
  buildPortfolioProjectPayload,
  resolvePortfolioShareTargets,
  shouldReplacePureAiPortfolio,
  type PortfolioMasterRow,
} from "./portfolioMasterImport";
import rows from "../data/portfolioMasterAgo2026.json";

const MASTER_ROWS = rows as PortfolioMasterRow[];

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

export async function replacePureAiPortfolioFromMaster(input: {
  db: Firestore;
  user: { uid: string; email?: string | null };
  workspace: {
    id: string;
    name?: string;
    ownerId?: string;
    portfolioImportKey?: string | null;
  };
  members: WorkspaceMember[];
}) {
  if (!shouldReplacePureAiPortfolio(input.workspace)) {
    return { skipped: true as const, reason: "not-needed" };
  }
  if (input.workspace.ownerId !== input.user.uid) {
    return { skipped: true as const, reason: "not-owner" };
  }

  const share = resolvePortfolioShareTargets(input.members);
  const projectsSnap = await getDocs(
    query(collection(input.db, "projects"), where("workspaceId", "==", input.workspace.id)),
  );
  if (projectsSnap.size > 0) {
    return { skipped: true as const, reason: "portfolio-exists" };
  }
  const tasksSnap = await getDocs(
    query(collection(input.db, "tasks"), where("workspaceId", "==", input.workspace.id)),
  );
  const legacyProjectIds = new Set(projectsSnap.docs.map((item) => item.id));
  const taskDeletes = tasksSnap.docs.filter((item) =>
    legacyProjectIds.has(String(item.data().projectId || "")),
  );

  const deletions: Array<(batch: ReturnType<typeof writeBatch>) => void> = [
    ...taskDeletes.map((item) => (batch: ReturnType<typeof writeBatch>) =>
      batch.delete(item.ref),
    ),
    ...projectsSnap.docs.map((item) => (batch: ReturnType<typeof writeBatch>) =>
      batch.delete(item.ref),
    ),
  ];
  await commitInChunks(input.db, deletions);

  const creates: Array<(batch: ReturnType<typeof writeBatch>) => void> = MASTER_ROWS.map(
    (row) => (batch) => {
      const ref = doc(collection(input.db, "projects"));
      batch.set(ref, {
        ...buildPortfolioProjectPayload(row, {
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
      });
    },
  );
  await commitInChunks(input.db, creates);

  await updateDoc(doc(input.db, "workspaces", input.workspace.id), {
    portfolioImportKey: PORTFOLIO_MASTER_IMPORT_KEY,
    portfolioImportSource: PORTFOLIO_MASTER_SOURCE,
    portfolioImportCount: MASTER_ROWS.length,
    portfolioImportAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    skipped: false as const,
    removedProjects: projectsSnap.size,
    removedTasks: taskDeletes.length,
    createdProjects: MASTER_ROWS.length,
    sharedWith: share.labels,
    missingAliases: share.missingAliases,
  };
}

export function portfolioMasterRowCount() {
  return MASTER_ROWS.length;
}
