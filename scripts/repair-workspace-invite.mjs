/** Narrow repair: restore a previously accepted, still-active Boldr invitation. */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const email = String(process.env.INVITEE_EMAIL || "").trim().toLowerCase();
if (!email || !email.includes("@")) throw new Error("INVITEE_EMAIL is required");
const applet = JSON.parse(readFileSync(new URL("../firebase-applet-config.json", import.meta.url), "utf8"));
const config = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
initializeApp({ projectId: applet.projectId });
const db = getFirestore(config.firestore.database);
const account = await getAuth().getUserByEmail(email);
const [workspaces, invites] = await Promise.all([
  db.collection("workspaces").get(),
  db.collection("agent_invites").where("emailLower", "==", email).get(),
]);
const targets = workspaces.docs.filter((doc) =>
  String(doc.data().name || "").toLowerCase() === "boldr ai workspace");
if (targets.length !== 1) throw new Error("Expected exactly one Boldr AI Workspace");
const workspaceRef = targets[0].ref;
const accepted = invites.docs.some((doc) => {
  const row = doc.data();
  return row.workspaceId === workspaceRef.id && row.inviteType === "workspace_member" &&
    row.status === "accepted" && row.acceptedBy === account.uid && row.role === "admin";
});
if (!accepted) throw new Error("Matching accepted admin invitation not found; no changes made");

const result = await db.runTransaction(async (tx) => {
  const memberRef = db.doc(`workspace_members/${workspaceRef.id}_${account.uid}`);
  const [workspaceSnap, memberSnap] = await Promise.all([tx.get(workspaceRef), tx.get(memberRef)]);
  const workspace = workspaceSnap.data();
  const member = memberSnap.data();
  if (!workspace || !member || member.userId !== account.uid ||
    member.emailLower !== email || member.workspaceId !== workspaceRef.id ||
    member.status !== "active" || member.role !== "admin") {
    throw new Error("Active admin membership no longer matches; no changes made");
  }
  const members = (workspace.members || []).map((value) => String(value).toLowerCase());
  const roles = { ...(workspace.roles || {}) };
  if (members.includes(email) && roles[email] === "admin") return "already-consistent";
  tx.update(workspaceRef, {
    members: [...new Set([...members, email])],
    roles: { ...roles, [email]: "admin" },
    updatedAt: FieldValue.serverTimestamp(),
  });
  return "repaired";
});
console.log(JSON.stringify({ result, mode: "targeted-repair", changedOnlyWorkspaceAccessIndex: true }));
