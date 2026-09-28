import type { Firestore } from "firebase-admin/firestore";
import {
  parseStrict,
  portalMetaZ,
  portalSettingsZ,
  projectViewZ,
  timelineViewZ,
} from "./schemas";
import { CLIENTS, portalDoc, portalMeta } from "./paths";

const DEFAULT_SETTINGS = {
  updates: true,
  timeline: true,
  clientVisibleItems: true,
  requests: true,
  documents: true,
  invoices: true,
  teamContactIds: [] as string[],
  askOdysseus: true,
  costDetail: false,
  csatAfterCheckpoint: true,
  autoPublishUpdates: false,
  brand: { name: "Client portal" },
};

function str(v: unknown, fb = "") {
  return v == null ? fb : String(v);
}

function num(v: unknown, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

export async function loadClientSettings(db: Firestore, clientId: string) {
  const snap = await db.doc(`${CLIENTS}/${clientId}`).get();
  if (!snap.exists) return { client: null as Record<string, unknown> | null, settings: DEFAULT_SETTINGS };
  const client = { id: snap.id, ...snap.data() } as Record<string, unknown>;
  const raw = (client.settings as Record<string, unknown>) || {};
  const settings = parseStrict(portalSettingsZ, {
    ...DEFAULT_SETTINGS,
    ...raw,
    brand: { ...DEFAULT_SETTINGS.brand, ...((raw.brand as object) || {}) },
    teamContactIds: Array.isArray(raw.teamContactIds)
      ? (raw.teamContactIds as string[])
      : DEFAULT_SETTINGS.teamContactIds,
  });
  return { client, settings };
}

/** Builds ProjectView + TimelineView; writes only enabled sections. */
export async function projectProject(db: Firestore, projectId: string) {
  const projectSnap = await db.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) return { ok: false as const, reason: "missing-project" };
  const project = { id: projectSnap.id, ...projectSnap.data() } as Record<string, unknown>;
  const clientId = str(project.clientId);
  if (!clientId) return { ok: false as const, reason: "no-clientId" };

  const { client, settings } = await loadClientSettings(db, clientId);
  if (!client || client.portalEnabled === false) {
    return { ok: false as const, reason: "portal-off" };
  }

  const milestonesSnap = await db
    .collection("milestones")
    .where("projectId", "==", projectId)
    .limit(100)
    .get();
  const milestones = milestonesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));

  const tasksSnap = await db
    .collection("tasks")
    .where("projectId", "==", projectId)
    .where("clientVisible", "==", true)
    .limit(200)
    .get()
    .catch(() => null);
  const openRequests = (tasksSnap?.docs || []).filter((d) => {
    const t = d.data();
    return Boolean(t.ticketStatus || t.requesterEmail);
  }).length;

  const docsSnap = await db
    .collection("attachments")
    .where("projectId", "==", projectId)
    .where("clientFolder", "==", true)
    .limit(100)
    .get()
    .catch(() => null);
  const docCount = docsSnap?.size ?? 0;

  const invoicesSnap = await db
    .collection("invoice_documents")
    .where("projectId", "==", projectId)
    .limit(100)
    .get()
    .catch(() => null);
  let pending = 0;
  let overdue = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const d of invoicesSnap?.docs || []) {
    const inv = d.data();
    if (inv.revoked) continue;
    const pay = String(inv.paymentStatus || inv.status || "");
    if (pay === "overdue" || (inv.dueDate && String(inv.dueDate) < today && pay !== "paid")) {
      overdue += 1;
    } else if (pay !== "paid" && pay !== "void") {
      pending += 1;
    }
  }

  const pmName = str(project.projectManager || project.owner, "PM");
  const view = parseStrict(projectViewZ, {
    id: projectId,
    name: str(project.title || project.name, "Project"),
    code: project.projectKey || project.key ? str(project.projectKey || project.key) : undefined,
    health: project.health ? str(project.health) : undefined,
    stage: project.stage ? str(project.stage) : undefined,
    phase: project.phase ? str(project.phase) : undefined,
    progressPct:
      project.progressPct != null
        ? num(project.progressPct)
        : project.progress != null
          ? num(project.progress)
          : undefined,
    nextCheckpoint: project.phase
      ? { title: str(project.phase), status: "current" as const }
      : undefined,
    pm: { name: pmName },
    team: [],
    lastUpdateAt: project.updatedAt ? str(project.updatedAt) : undefined,
    openRequests,
    docCount,
    invoiceSummary: { pending, overdue },
    visibility: settings,
  });

  const batch = db.batch();
  if (settings.updates || settings.timeline || settings.clientVisibleItems || settings.requests || settings.documents || settings.invoices) {
    batch.set(db.doc(portalDoc(clientId, "projects", projectId)), view, { merge: true });
  } else {
    batch.delete(db.doc(portalDoc(clientId, "projects", projectId)));
  }

  if (settings.timeline) {
    const items = [];
    if (project.stage) {
      items.push({
        id: `stage-${str(project.stage)}`,
        title: str(project.stage),
        kind: "stage" as const,
        status: "current" as const,
      });
    }
    if (project.phase) {
      items.push({
        id: `checkpoint-${str(project.phase)}`,
        title: str(project.phase),
        kind: "checkpoint" as const,
        status: "current" as const,
      });
    }
    for (const m of milestones) {
      const statusRaw = str(m.status).toLowerCase();
      items.push({
        id: str(m.id),
        title: str(m.title || m.name, "Milestone"),
        date: m.dueDate || m.date ? str(m.dueDate || m.date) : undefined,
        kind: "milestone" as const,
        status:
          statusRaw === "done" || statusRaw === "completed"
            ? ("done" as const)
            : ("upcoming" as const),
      });
    }
    const timeline = parseStrict(timelineViewZ, { projectId, items });
    batch.set(db.doc(portalDoc(clientId, "timeline", projectId)), timeline, { merge: true });
  } else {
    batch.delete(db.doc(portalDoc(clientId, "timeline", projectId)));
  }

  await batch.commit();
  await refreshPortalMeta(db, clientId);
  return { ok: true as const, clientId, view };
}

export async function refreshPortalMeta(db: Firestore, clientId: string) {
  const { client, settings } = await loadClientSettings(db, clientId);
  if (!client) return;
  const [projects, approvals, items, invoices, documents, threads] = await Promise.all([
    db.collection(`client_portal/${clientId}/projects`).get().catch(() => null),
    db.collection(`client_portal/${clientId}/approvals`).where("status", "==", "pending").get().catch(() => null),
    db.collection(`client_portal/${clientId}/items`).get().catch(() => null),
    db.collection(`client_portal/${clientId}/invoices`).get().catch(() => null),
    db.collection(`client_portal/${clientId}/documents`).get().catch(() => null),
    db.collection(`client_portal/${clientId}/threads`).get().catch(() => null),
  ]);
  const meta = parseStrict(portalMetaZ, {
    brand: settings.brand,
    nav: {
      home: approvals?.size ?? 0,
      projects: projects?.size ?? 0,
      requests: (items?.docs || []).filter((d) => d.data().kind === "request").length,
      invoices: invoices?.size ?? 0,
      documents: documents?.size ?? 0,
      messages: threads?.size ?? 0,
      approvals: approvals?.size ?? 0,
    },
    locale: client.locale === "en" ? "en" : "es",
  });
  await db.doc(portalMeta(clientId)).set(meta, { merge: true });
}
