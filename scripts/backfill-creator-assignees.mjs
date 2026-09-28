/**
 * Admin one-shot / dry-run: restore creator as assignee on tasks that have
 * createdBy set but no assigneeIds / assignee labels.
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Requires one of:
 * - FIREBASE_SERVICE_ACCOUNT (JSON string)
 * - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * Usage:
 *   node scripts/backfill-creator-assignees.mjs --workspace <id>
 *   node scripts/backfill-creator-assignees.mjs --workspace <id> --apply
 *   node scripts/backfill-creator-assignees.mjs --workspace <id> --limit 200
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const BATCH_LIMIT = 400;

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] || null;
}

function hasAssignees(data) {
  const ids = Array.isArray(data.assigneeIds)
    ? data.assigneeIds.map((v) => String(v || "")).filter(Boolean)
    : [];
  const id = data.assigneeId != null ? String(data.assigneeId).trim() : "";
  const labels = [
    ...(Array.isArray(data.assignees) ? data.assignees : []),
    data.owner,
    data.assignee,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return ids.length > 0 || Boolean(id) || labels.length > 0;
}

function loadCredential(firebaseConfig) {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (raw) return cert(JSON.parse(raw));
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
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

async function commitInChunks(db, ops) {
  for (let index = 0; index < ops.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    ops.slice(index, index + BATCH_LIMIT).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

async function main() {
  const workspaceId = argValue("--workspace");
  if (!workspaceId) {
    console.error("Usage: node scripts/backfill-creator-assignees.mjs --workspace <id> [--apply] [--limit N]");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const limitRaw = argValue("--limit");
  const limit = Math.min(2000, Math.max(1, Number(limitRaw || 500) || 500));

  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!getApps().length) {
    initializeApp({
      credential: loadCredential(firebaseConfig),
      projectId: firebaseConfig.projectId,
    });
  }
  const db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(firebaseConfig.firestoreDatabaseId)
    : getFirestore();

  const workspaceSnap = await db.doc(`workspaces/${workspaceId}`).get();
  if (!workspaceSnap.exists) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  console.log(
    `${apply ? "APPLY" : "DRY-RUN"} restoreCreatorAssignees workspace=${workspaceId} limit=${limit}`,
  );

  const membersSnap = await db
    .collection("workspace_members")
    .where("workspaceId", "==", workspaceId)
    .get();
  const memberByUserId = new Map();
  for (const doc of membersSnap.docs) {
    const data = doc.data();
    const userId = String(data.userId || "").trim();
    if (!userId) continue;
    const label =
      String(data.alias || data.displayName || data.email || "").trim() || userId;
    memberByUserId.set(userId, { id: doc.id, label });
  }

  const tasksSnap = await db
    .collection("tasks")
    .where("workspaceId", "==", workspaceId)
    .limit(limit)
    .get();

  const ops = [];
  const sample = [];
  for (const doc of tasksSnap.docs) {
    const data = doc.data();
    const createdBy = String(data.createdBy || data.userId || "").trim();
    if (!createdBy) continue;
    if (hasAssignees(data)) continue;
    const member = memberByUserId.get(createdBy);
    if (!member) continue;
    if (sample.length < 20) {
      sample.push({ id: doc.id, createdBy, assigneeId: member.id });
    }
    ops.push((batch) => {
      batch.update(doc.ref, {
        assigneeIds: [member.id],
        assignees: member.label ? [member.label] : [],
        owner: member.label || "",
        assignee: member.label || "",
        assigneeId: member.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  console.log(`scanned=${tasksSnap.size} matched=${ops.length}`);
  if (sample.length) console.log("sample:", JSON.stringify(sample, null, 2));
  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write.");
    return;
  }
  await commitInChunks(db, ops);
  console.log(`updated=${ops.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
