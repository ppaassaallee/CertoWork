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
import { isPureAiWorkspace } from "./portfolioMasterImport";
import {
  PURE_AI_PORTFOLIO_FOLLOWER_ALIASES,
  PURE_AI_PORTFOLIO_FOLLOWERS_KEY,
  buildPureAiFollowerMemberPatch,
  buildPureAiFollowerProjectPatch,
  buildPureAiFollowerWorkspaceRolesPatch,
  matchedPureAiFollowerMembers,
  resolvePureAiPortfolioFollowers,
  summarizePureAiFollowerGrant,
} from "./pureAiPortfolioFollowers";

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

/**
 * Promote Regina / César / Rafael / Edgar to admin + portfolioViewer and add
 * them as team followers on every Pure AI project so they see the full portfolio.
 */
export async function grantPureAiPortfolioFollowers(input: {
  db: Firestore;
  user: { uid: string; email?: string | null };
  workspace: {
    id: string;
    name?: string;
    ownerId?: string;
    roles?: Record<string, string> | null;
    portfolioFollowersGrantedKey?: string | null;
  };
  members: WorkspaceMember[];
}) {
  if (!isPureAiWorkspace(input.workspace)) {
    return { skipped: true as const, reason: "not-pure-ai" as const };
  }
  if (input.workspace.ownerId !== input.user.uid) {
    const actor = input.members.find((member) => member.userId === input.user.uid);
    const role = String(actor?.role || "").toLowerCase();
    if (!["owner", "admin"].includes(role)) {
      return { skipped: true as const, reason: "not-owner" as const };
    }
  }

  const share = resolvePureAiPortfolioFollowers(input.members);
  const matched = matchedPureAiFollowerMembers(input.members)
    .map((item) => item.member)
    .filter(Boolean) as WorkspaceMember[];

  if (!matched.length) {
    return {
      skipped: true as const,
      reason: "no-matches" as const,
      missingAliases: [...PURE_AI_PORTFOLIO_FOLLOWER_ALIASES],
    };
  }

  const memberOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = matched.map(
    (member) => (batch) => {
      batch.update(doc(input.db, "workspace_members", member.id), {
        ...buildPureAiFollowerMemberPatch(),
        updatedAt: serverTimestamp(),
      });
    },
  );
  await commitInChunks(input.db, memberOps);

  await updateDoc(doc(input.db, "workspaces", input.workspace.id), {
    roles: buildPureAiFollowerWorkspaceRolesPatch(input.workspace.roles, matched),
    portfolioFollowersGrantedAt: serverTimestamp(),
    portfolioFollowersGrantedAliases: PURE_AI_PORTFOLIO_FOLLOWER_ALIASES,
    portfolioFollowersGrantedKey: PURE_AI_PORTFOLIO_FOLLOWERS_KEY,
    updatedAt: serverTimestamp(),
  });

  const projectsSnap = await getDocs(
    query(collection(input.db, "projects"), where("workspaceId", "==", input.workspace.id)),
  );
  const projectOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = projectsSnap.docs.map(
    (item) => (batch) => {
      batch.update(item.ref, {
        ...buildPureAiFollowerProjectPatch(item.data() as Record<string, unknown>, share),
        updatedAt: serverTimestamp(),
      });
    },
  );
  await commitInChunks(input.db, projectOps);

  return {
    skipped: false as const,
    projectsUpdated: projectsSnap.size,
    membersPromoted: matched.length,
    sharedWith: share.labels,
    missingAliases: share.missingAliases,
    message: summarizePureAiFollowerGrant({
      share,
      projectsUpdated: projectsSnap.size,
      membersPromoted: matched.length,
    }),
  };
}
