import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../../lib/firebase";
import {
  CLIENTS_COLLECTION,
  PORTAL_EVENTS_COLLECTION,
  PORTAL_MEMBERS_COLLECTION,
  PROJECT_UPDATES_COLLECTION,
  slugifyClientName,
} from "../../lib/clientPortal/collections";
import {
  DEFAULT_PORTAL_SETTINGS,
  type PortalSettings,
} from "../../lib/clientPortal/types";

type Props = {
  workspaceId: string;
  project: Record<string, unknown>;
  userId: string;
  onOpenPreview?: (clientId: string) => void;
};

export function ClientPortalTab({ workspaceId, project, userId, onOpenPreview }: Props) {
  const clientId = String(project.clientId || "");
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [notice, setNotice] = useState("");
  const [draftTitle, setDraftTitle] = useState("Weekly update");
  const [draftSummary, setDraftSummary] = useState("");
  const live = Boolean(clientId);

  const statusLabel = useMemo(() => {
    if (!clientId) return "Off";
    return live ? "Live" : "Off";
  }, [clientId, live]);

  const ensureClient = async () => {
    const name = String(project.clientEntity || project.client || project.title || "Client");
    const id = clientId || `${workspaceId}_${slugifyClientName(name)}`;
    await setDoc(
      doc(db, CLIENTS_COLLECTION, id),
      {
        id,
        workspaceId,
        name,
        slug: slugifyClientName(name),
        locale: "es",
        projectIds: [String(project.id)],
        portalEnabled: true,
        settings: DEFAULT_PORTAL_SETTINGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    await updateDoc(doc(db, "projects", String(project.id)), { clientId: id });
    setNotice(`Client linked: ${name}`);
    return id;
  };

  const saveSettings = async (next: PortalSettings) => {
    setSettings(next);
    const id = clientId || (await ensureClient());
    await updateDoc(doc(db, CLIENTS_COLLECTION, id), {
      settings: next,
      updatedAt: new Date().toISOString(),
    });
  };

  const invite = async () => {
    const id = clientId || (await ensureClient());
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    const memberId = `invite_${email.replace(/[^a-z0-9]+/g, "_")}`;
    await setDoc(
      doc(db, PORTAL_MEMBERS_COLLECTION, memberId),
      {
        uid: memberId,
        email,
        name: inviteName || email,
        workspaceId,
        clientIds: [id],
        role: "approver",
        locale: "es",
        status: "invited",
        invitedBy: userId,
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
    setNotice(`Invitation prepared for ${email}. Magic link via portal login.`);
    setInviteEmail("");
  };

  const publishDraft = async () => {
    const id = clientId || (await ensureClient());
    const updateRef = await addDoc(collection(db, PROJECT_UPDATES_COLLECTION), {
      workspaceId,
      projectId: String(project.id),
      clientId: id,
      period: {
        from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
      },
      title: draftTitle,
      summary: draftSummary || "Progress this week.",
      done: [],
      next: [],
      needsClient: [],
      status: "draft",
      source: "manual",
      authorUid: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const fn = httpsCallable(getFunctions(app, "us-central1"), "publishPortalUpdate");
    await fn({ updateId: updateRef.id });
    setNotice("Update published to the client portal.");
  };

  const toggle = (key: keyof PortalSettings, value: boolean) => {
    void saveSettings({ ...settings, [key]: value } as PortalSettings);
  };

  return (
    <div className="cp-team-portal" style={{ display: "grid", gap: 14, padding: 8 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Client portal</h2>
          <span className="cp-pill">{statusLabel}{clientId ? ` · ${clientId}` : ""}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="cp-btn ghost" onClick={() => void ensureClient()} type="button">
            Enable / link client
          </button>
          <button
            className="cp-btn ghost"
            disabled={!clientId}
            onClick={() => onOpenPreview?.(clientId)}
            type="button"
          >
            Preview as contact
          </button>
          <button className="cp-btn" onClick={() => void publishDraft()} type="button">
            Publish update
          </button>
        </div>
      </header>

      {notice ? <p className="cp-muted">{notice}</p> : null}

      <section className="cp-card">
        <h3 style={{ marginTop: 0 }}>This week's update</h3>
        <input
          onChange={(e) => setDraftTitle(e.target.value)}
          style={{ width: "100%", marginBottom: 8, padding: 8 }}
          value={draftTitle}
        />
        <textarea
          onChange={(e) => setDraftSummary(e.target.value)}
          placeholder="Summary (≤ 3 sentences)"
          rows={3}
          style={{ width: "100%", padding: 8 }}
          value={draftSummary}
        />
        <p className="cp-muted">
          Publishing requires PM/admin. Odysseus Friday draft uses the Client weekly update routine.
        </p>
      </section>

      <section className="cp-card">
        <h3 style={{ marginTop: 0 }}>What the client sees</h3>
        {(
          [
            ["updates", "Weekly updates"],
            ["timeline", "Timeline"],
            ["clientVisibleItems", "Client-visible items"],
            ["requests", "Requests"],
            ["documents", "Documents (Client folder)"],
            ["invoices", "Invoices"],
            ["askOdysseus", "Odysseus for the client"],
            ["costDetail", "Hours and cost detail"],
            ["csatAfterCheckpoint", "CSAT after checkpoints"],
          ] as Array<[keyof PortalSettings, string]>
        ).map(([key, label]) => (
          <label key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input
              checked={Boolean(settings[key])}
              onChange={(e) => toggle(key, e.target.checked)}
              type="checkbox"
            />
            {label}
          </label>
        ))}
      </section>

      <section className="cp-card">
        <h3 style={{ marginTop: 0 }}>Contacts</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Name"
            value={inviteName}
          />
          <input
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email"
            type="email"
            value={inviteEmail}
          />
          <button className="cp-btn" onClick={() => void invite()} type="button">
            Invite contact
          </button>
        </div>
      </section>

      <ClientActivity clientId={clientId} />
    </div>
  );
}

function ClientActivity({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!clientId) return;
    void import("firebase/firestore").then(async ({ collection, getDocs, limit, orderBy, query, where }) => {
      const snap = await getDocs(
        query(
          collection(db, PORTAL_EVENTS_COLLECTION),
          where("clientId", "==", clientId),
          orderBy("at", "desc"),
          limit(20),
        ),
      ).catch(() => null);
      setRows(snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
    });
  }, [clientId]);

  return (
    <section className="cp-card">
      <h3 style={{ marginTop: 0 }}>Client activity (7 days)</h3>
      {rows.length === 0 ? <p className="cp-muted">No portal events yet.</p> : null}
      {rows.map((row) => (
        <div key={String(row.id)} className="cp-muted" style={{ marginBottom: 4 }}>
          {String(row.at || "").slice(0, 16)} · {String(row.kind)} · {String(row.refId || "")}
        </div>
      ))}
    </section>
  );
}
