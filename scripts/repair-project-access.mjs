/**
 * One-time, additive repair for legacy project access.
 *
 * - Project items without a visibility value become project-visible.
 * - Explicitly private items stay private.
 * - Item assignees are added to the destination project's team/access lists.
 * - No access is removed and no cross-workspace grant is created.
 *
 * Dry-run by default. Requires service-account credentials, matching the other
 * admin scripts in this repository.
 *
 * Usage:
 *   node scripts/repair-project-access.mjs --workspace <id>
 *   node scripts/repair-project-access.mjs --workspace <id> --apply
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const BATCH_LIMIT = 400;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? "" : String(process.argv[index + 1] || "");
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function loadCredential(config) {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (raw) return cert(JSON.parse(raw));
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    return cert({ projectId: config.projectId, clientEmail, privateKey });
  }
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY");
}

async function commitInChunks(db, operations) {
  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    operations.slice(index, index + BATCH_LIMIT).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

async function main() {
  const workspaceId = argValue("--workspace");
  if (!workspaceId) throw new Error("Usage: node scripts/repair-project-access.mjs --workspace <id> [--apply]");
  const apply = process.argv.includes("--apply");
  const config = JSON.parse(fs.readFileSync(path.resolve("firebase-applet-config.json"), "utf8"));
  if (!getApps().length) initializeApp({ credential: loadCredential(config), projectId: config.projectId });
  const db = getFirestore(config.firestoreDatabaseId);

  const [membersSnapshot, projectsSnapshot, tasksSnapshot] = await Promise.all([
    db.collection("workspace_members").where("workspaceId", "==", workspaceId).get(),
    db.collection("projects").where("workspaceId", "==", workspaceId).get(),
    db.collection("tasks").where("workspaceId", "==", workspaceId).get(),
  ]);
  const members = new Map();
  for (const memberDoc of membersSnapshot.docs) {
    const member = memberDoc.data();
    members.set(memberDoc.id, {
      id: memberDoc.id,
      userId: String(member.userId || "").trim(),
      email: String(member.emailLower || member.email || "").trim().toLowerCase(),
    });
  }
  const projects = new Map(projectsSnapshot.docs.map((doc) => [doc.id, doc]));
  const projectGrants = new Map();
  const operations = [];
  let visibilityRepairs = 0;

  for (const taskDoc of tasksSnapshot.docs) {
    const task = taskDoc.data();
    const projectId = String(task.projectId || "").trim();
    if (!projectId || !projects.has(projectId)) continue;
    if (!String(task.visibility || "").trim()) {
      visibilityRepairs += 1;
      operations.push((batch) => batch.update(taskDoc.ref, {
        visibility: "project",
        updatedAt: FieldValue.serverTimestamp(),
      }));
    }
    const assigneeIds = unique([
      ...(Array.isArray(task.assigneeIds) ? task.assigneeIds : []),
      task.assigneeId,
    ]);
    const grant = projectGrants.get(projectId) || { memberIds: [], userIds: [], emails: [] };
    for (const assigneeId of assigneeIds) {
      const member = members.get(assigneeId);
      if (!member) continue;
      grant.memberIds.push(member.id);
      grant.userIds.push(member.userId);
      grant.emails.push(member.email);
    }
    projectGrants.set(projectId, grant);
  }

  let projectRepairs = 0;
  for (const [projectId, rawGrant] of projectGrants) {
    const grant = {
      memberIds: unique(rawGrant.memberIds),
      userIds: unique(rawGrant.userIds),
      emails: unique(rawGrant.emails),
    };
    if (!grant.memberIds.length) continue;
    projectRepairs += 1;
    operations.push((batch) => batch.update(projects.get(projectId).ref, {
      teamMemberIds: FieldValue.arrayUnion(...grant.memberIds),
      ...(grant.userIds.length ? { visibleToUserIds: FieldValue.arrayUnion(...grant.userIds) } : {}),
      ...(grant.emails.length ? { visibleToEmails: FieldValue.arrayUnion(...grant.emails) } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }));
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    workspaceId,
    tasksScanned: tasksSnapshot.size,
    projectsScanned: projectsSnapshot.size,
    visibilityRepairs,
    projectsReceivingAssigneeAccess: projectRepairs,
    writes: operations.length,
  }, null, 2));
  if (!apply) return;
  await commitInChunks(db, operations);
  console.log(`updated=${operations.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
