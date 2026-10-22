/** Read-only invite diagnosis. Never prints email, tokens, document IDs, or user names. */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = String(process.env.INVITEE_EMAIL || "").trim().toLowerCase();
if (!email || !email.includes("@")) throw new Error("INVITEE_EMAIL is required");
const applet = JSON.parse(readFileSync(new URL("../firebase-applet-config.json", import.meta.url), "utf8"));
const config = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
initializeApp({ projectId: applet.projectId });
const db = getFirestore(config.firestore.database);
const account = await getAuth().getUserByEmail(email).catch((error) => {
  if (error?.code === "auth/user-not-found") return null;
  throw error;
});
const [workspaces, members, invites] = await Promise.all([
  db.collection("workspaces").get(),
  db.collection("workspace_members").where("emailLower", "==", email).get(),
  db.collection("agent_invites").where("emailLower", "==", email).get(),
]);
const target = workspaces.docs.filter((doc) => /boldr ai workspace/i.test(String(doc.data().name || "")));
const rows = target.map((doc) => {
  const data = doc.data();
  const scopedMembers = members.docs.filter((row) => row.data().workspaceId === doc.id);
  const scopedInvites = invites.docs.filter((row) => row.data().workspaceId === doc.id);
  const active = account ? scopedMembers.find((row) => row.id === `${doc.id}_${account.uid}`) : null;
  return {
    targetFound: true,
    listedInWorkspace: (data.members || []).some((value) => String(value).toLowerCase() === email),
    workspaceRole: Object.entries(data.roles || {}).find(([key]) => key.toLowerCase() === email)?.[1] || null,
    activeMembershipStatus: active?.data().status || null,
    pendingMembershipStatuses: scopedMembers.filter((row) => row.id !== active?.id).map((row) => row.data().status),
    invitationStatuses: scopedInvites.map((row) => ({
      status: row.data().status || null,
      inviteType: row.data().inviteType || null,
      expiresAt: row.data().expiresAt?.toDate?.()?.toISOString() || null,
      acceptedByMatchesAccount: Boolean(account && row.data().acceptedBy === account.uid),
    })),
  };
});
console.log(JSON.stringify({
  mode: "read-only", targetCount: rows.length,
  authAccountExists: Boolean(account),
  authEmailVerified: account?.emailVerified ?? null,
  rows,
}, null, 2));
