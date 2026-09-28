/**
 * Dry-run by default. Pass --apply to write.
 *
 * Creates clients from distinct client/clientEntity values, sets projects.clientId,
 * archives project_status_shares into project_updates, flags ticket tasks clientVisible,
 * and prepares portal_members invitations from Collab guests (status invited, not sent).
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");

function slugify(name: string) {
  return String(name || "client")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "client";
}

async function main() {
  if (!getApps().length) initializeApp();
  const db = getFirestore();
  const counts = {
    clients: 0,
    projectsLinked: 0,
    updatesArchived: 0,
    tasksFlagged: 0,
    guestsLinked: 0,
  };

  const projectsSnap = await db.collection("projects").limit(2000).get();
  const byKey = new Map<string, { workspaceId: string; name: string; projectIds: string[] }>();

  for (const doc of projectsSnap.docs) {
    const p = doc.data();
    const workspaceId = String(p.workspaceId || "");
    const name = String(p.clientEntity || p.client || "").trim();
    if (!workspaceId || !name) continue;
    const key = `${workspaceId}::${name.toLowerCase()}`;
    const row = byKey.get(key) || { workspaceId, name, projectIds: [] };
    row.projectIds.push(doc.id);
    byKey.set(key, row);
  }

  for (const [, row] of byKey) {
    const clientId = `${row.workspaceId}_${slugify(row.name)}`;
    counts.clients += 1;
    if (apply) {
      await db.doc(`clients/${clientId}`).set(
        {
          id: clientId,
          workspaceId: row.workspaceId,
          name: row.name,
          slug: slugify(row.name),
          locale: "es",
          projectIds: row.projectIds,
          portalEnabled: false,
          settings: {
            updates: true,
            timeline: true,
            clientVisibleItems: true,
            requests: true,
            documents: true,
            invoices: true,
            teamContactIds: [],
            askOdysseus: true,
            costDetail: false,
            csatAfterCheckpoint: true,
            brand: { name: row.name },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      for (const projectId of row.projectIds) {
        await db.doc(`projects/${projectId}`).set({ clientId }, { merge: true });
        counts.projectsLinked += 1;
      }
    } else {
      counts.projectsLinked += row.projectIds.length;
    }
  }

  const shares = await db.collection("project_status_shares").limit(1000).get().catch(() => null);
  for (const doc of shares?.docs || []) {
    const s = doc.data();
    counts.updatesArchived += 1;
    if (!apply) continue;
    const projectId = String(s.projectId || "");
    const project = projectId ? (await db.doc(`projects/${projectId}`).get()).data() : null;
    const clientId = String(project?.clientId || "");
    if (!clientId) continue;
    await db.doc(`project_updates/legacy_${doc.id}`).set(
      {
        id: `legacy_${doc.id}`,
        workspaceId: s.workspaceId || project?.workspaceId,
        projectId,
        clientId,
        period: { from: "", to: String(s.createdAt || "") },
        title: s.title || "Legacy status share",
        summary: s.summary || s.narrative || "",
        done: [],
        next: [],
        needsClient: [],
        status: "archived",
        source: "manual",
        authorUid: s.createdBy || "migration",
        publishedAt: s.createdAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  const tasks = await db.collection("tasks").where("requesterEmail", "!=", null).limit(1000).get().catch(() => null);
  for (const doc of tasks?.docs || []) {
    const t = doc.data();
    if (!t.requesterEmail) continue;
    counts.tasksFlagged += 1;
    if (apply) {
      await doc.ref.set({ clientVisible: true }, { merge: true });
    }
  }

  const guests = await db.collection("guests").limit(1000).get().catch(() => null);
  for (const doc of guests?.docs || []) {
    const g = doc.data();
    const email = String(g.email || "").toLowerCase();
    if (!email) continue;
    counts.guestsLinked += 1;
    if (!apply) continue;
    const memberId = `invite_${email.replace(/[^a-z0-9]+/g, "_")}`;
    await db.doc(`portal_members/${memberId}`).set(
      {
        uid: memberId,
        email,
        name: g.name || email,
        workspaceId: g.workspaceId || "",
        clientIds: [],
        role: "viewer",
        locale: "es",
        status: "invited",
        invitedBy: g.createdBy || "migration",
        invitedAt: new Date().toISOString(),
        notificationPrefs: {
          updates: true,
          approvals: true,
          requests: true,
          invoices: true,
          digest: "immediate",
        },
      },
      { merge: true },
    );
  }

  console.log(JSON.stringify({ dryRun: !apply, counts }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
