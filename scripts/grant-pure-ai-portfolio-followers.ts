/**
 * Admin one-shot: promote Regina / César / Rafael / Edgar to Pure AI admins
 * and add them as followers on every Pure AI project.
 *
 * Requires one of:
 * - FIREBASE_SERVICE_ACCOUNT (JSON string)
 * - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * Usage: pnpm exec tsx scripts/grant-pure-ai-portfolio-followers.ts
 */
import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { isPureAiWorkspace } from "../src/lib/portfolioMasterImport";
import {
  PURE_AI_PORTFOLIO_FOLLOWER_ALIASES,
  buildPureAiFollowerMemberPatch,
  buildPureAiFollowerProjectPatch,
  buildPureAiFollowerWorkspaceRolesPatch,
  matchedPureAiFollowerMembers,
  resolvePureAiPortfolioFollowers,
  summarizePureAiFollowerGrant,
} from "../src/lib/pureAiPortfolioFollowers";
import type { WorkspaceMember } from "../src/lib/workspaceCollaboration";

const BATCH_LIMIT = 400;

function loadCredential() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (raw) {
    return cert(JSON.parse(raw));
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
    roles?: Record<string, string>;
  };
  console.log(`Pure AI workspace: ${workspace.id} (${workspace.name})`);

  const membersSnap = await db
    .collection("workspace_members")
    .where("workspaceId", "==", workspace.id)
    .get();
  const members = membersSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as WorkspaceMember,
  );
  const share = resolvePureAiPortfolioFollowers(members);
  const matched = matchedPureAiFollowerMembers(members)
    .map((item) => item.member)
    .filter(Boolean) as WorkspaceMember[];

  console.log(
    `Matched followers: ${share.labels.join(", ") || "(none)"}; missing: ${
      share.missingAliases.join(", ") || "(none)"
    }`,
  );
  if (!matched.length) {
    throw new Error(
      `No active members matched ${PURE_AI_PORTFOLIO_FOLLOWER_ALIASES.join(", ")}`,
    );
  }

  const memberOps = matched.map(
    (member) => (batch: ReturnType<Firestore["batch"]>) => {
      batch.update(db.collection("workspace_members").doc(member.id), {
        ...buildPureAiFollowerMemberPatch(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    },
  );
  await commitInChunks(db, memberOps);

  await db.collection("workspaces").doc(workspace.id).update({
    roles: buildPureAiFollowerWorkspaceRolesPatch(workspace.roles, matched),
    portfolioFollowersGrantedAt: FieldValue.serverTimestamp(),
    portfolioFollowersGrantedAliases: PURE_AI_PORTFOLIO_FOLLOWER_ALIASES,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const projectsSnap = await db
    .collection("projects")
    .where("workspaceId", "==", workspace.id)
    .get();
  const projectOps = projectsSnap.docs.map(
    (item) => (batch: ReturnType<Firestore["batch"]>) => {
      batch.update(item.ref, {
        ...buildPureAiFollowerProjectPatch(item.data() as Record<string, unknown>, share),
        updatedAt: FieldValue.serverTimestamp(),
      });
    },
  );
  await commitInChunks(db, projectOps);

  console.log(
    summarizePureAiFollowerGrant({
      share,
      projectsUpdated: projectsSnap.size,
      membersPromoted: matched.length,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
