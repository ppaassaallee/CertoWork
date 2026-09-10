import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { WorkspaceMember } from "./workspaceCollaboration";
import { membershipPublicPatch, pendingMemberId } from "./workspaceCollaboration";
import { isPureAiWorkspace } from "./portfolioMasterImport";
import { normalizeAccessEmail } from "./accessControl";
import { buildOperationsStageRepairPatch } from "./pricingPortfolioSync";
import {
  PURE_AI_PORTFOLIO_FOLLOWER_ALIASES,
  PURE_AI_PORTFOLIO_FOLLOWERS_KEY,
  buildPureAiFollowerMemberPatch,
  buildPureAiFollowerMembersList,
  buildPureAiFollowerProjectPatch,
  buildPureAiFollowerWorkspaceRolesPatch,
  matchedPureAiFollowerMembers,
  memberIsPureAiFollower,
  pureAiFollowerSeatEmails,
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
 * Promote Regina / César / Rafael / Edgar to admin + portfolioViewer, ensure their
 * emails sit on `workspaces.members` (so login can discover Pure AI), and add them
 * as team followers on every Pure AI project.
 */
export async function grantPureAiPortfolioFollowers(input: {
  db: Firestore;
  user: { uid: string; email?: string | null };
  workspace: {
    id: string;
    name?: string;
    ownerId?: string;
    members?: Array<string | null | undefined> | null;
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
  const seatEmails = pureAiFollowerSeatEmails(input.members);

  const memberOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  for (const member of matched) {
    memberOps.push((batch) => {
      batch.set(
        doc(input.db, "workspace_members", member.id),
        {
          ...buildPureAiFollowerMemberPatch(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  }

  // Seed pending seats for known emails that are not yet active members so
  // Regina (and peers) can discover Pure AI via workspaces.members on login.
  const matchedEmails = new Set(
    matched.map((member) => normalizeAccessEmail(member.email || member.emailLower)).filter(Boolean),
  );
  let seatsEnsured = 0;
  for (const email of seatEmails) {
    if (matchedEmails.has(email)) continue;
    const pendingId = pendingMemberId(input.workspace.id, email);
    seatsEnsured += 1;
    memberOps.push((batch) => {
      batch.set(
        doc(input.db, "workspace_members", pendingId),
        {
          id: pendingId,
          workspaceId: input.workspace.id,
          userId: `pending:${email}`,
          email,
          emailLower: email,
          ...membershipPublicPatch({}),
          ...buildPureAiFollowerMemberPatch(),
          status: "invited",
          invitedBy: input.user.uid,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  }
  await commitInChunks(input.db, memberOps);

  await updateDoc(doc(input.db, "workspaces", input.workspace.id), {
    members: buildPureAiFollowerMembersList(input.workspace.members, seatEmails),
    roles: buildPureAiFollowerWorkspaceRolesPatch(input.workspace.roles, matched, seatEmails),
    portfolioFollowersGrantedAt: serverTimestamp(),
    portfolioFollowersGrantedAliases: PURE_AI_PORTFOLIO_FOLLOWER_ALIASES,
    portfolioFollowersGrantedKey: PURE_AI_PORTFOLIO_FOLLOWERS_KEY,
    updatedAt: serverTimestamp(),
  });

  const projectsSnap = await getDocs(
    query(collection(input.db, "projects"), where("workspaceId", "==", input.workspace.id)),
  );
  const shareWithSeats = {
    ...share,
    emails: [...new Set([...share.emails, ...seatEmails])],
  };

  // Per-project updates: one invalid doc (missing createdAt timestamp, etc.)
  // must not fail the entire follower grant with "Missing or insufficient permissions".
  let projectsUpdated = 0;
  let projectsFailed = 0;
  let stagesRepaired = 0;
  for (const item of projectsSnap.docs) {
    const data = item.data() as Record<string, unknown>;
    const repair = buildOperationsStageRepairPatch(data);
    try {
      await updateDoc(item.ref, {
        ...buildPureAiFollowerProjectPatch(data, shareWithSeats),
        ...(repair || {}),
        updatedAt: serverTimestamp(),
      });
      projectsUpdated += 1;
      if (repair) stagesRepaired += 1;
    } catch {
      projectsFailed += 1;
    }
  }

  return {
    skipped: false as const,
    projectsUpdated,
    projectsFailed,
    stagesRepaired,
    membersPromoted: matched.length,
    seatsEnsured,
    sharedWith: share.labels,
    missingAliases: share.missingAliases,
    message: summarizePureAiFollowerGrant({
      share,
      projectsUpdated,
      membersPromoted: matched.length,
      seatsEnsured,
      projectsFailed,
    }),
  };
}

/**
 * When a Pure AI follower signs into Pure AI, promote their own membership so
 * portfolio queries use the workspace-wide projects path.
 */
export async function selfHealPureAiFollowerMembership(input: {
  db: Firestore;
  user: { uid: string; email?: string | null };
  workspace: { id: string; name?: string | null; roles?: Record<string, string> | null };
  member?: WorkspaceMember | null;
}) {
  if (!isPureAiWorkspace(input.workspace) || !input.user.uid) {
    return { healed: false as const, reason: "not-applicable" as const };
  }
  const email = normalizeAccessEmail(input.user.email);
  const member =
    input.member ||
    ({
      id: `${input.workspace.id}_${input.user.uid}`,
      userId: input.user.uid,
      email,
      emailLower: email,
      alias: "",
      displayName: "",
    } as WorkspaceMember);
  if (!memberIsPureAiFollower({ ...member, email: email || member.email })) {
    return { healed: false as const, reason: "not-follower" as const };
  }
  const memberId = member.id || `${input.workspace.id}_${input.user.uid}`;
  await setDoc(
    doc(input.db, "workspace_members", memberId),
    {
      id: memberId,
      workspaceId: input.workspace.id,
      userId: input.user.uid,
      email: email || member.email || "",
      emailLower: email || member.emailLower || "",
      ...buildPureAiFollowerMemberPatch(),
      status: "active",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  if (email) {
    await updateDoc(doc(input.db, "workspaces", input.workspace.id), {
      roles: {
        ...(input.workspace.roles || {}),
        [email]: "admin",
      },
      updatedAt: serverTimestamp(),
    });
  }
  return { healed: true as const };
}
