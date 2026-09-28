import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { CLIENTS_COLLECTION, CLIENT_STATS_COLLECTION } from "../../lib/clientPortal/collections";
import { DEFAULT_PORTAL_SETTINGS, type Client } from "../../lib/clientPortal/types";
import { slugifyClientName } from "../../lib/clientPortal/collections";
import { doc, setDoc } from "firebase/firestore";

export function ClientsHome({ workspaceId }: { workspaceId: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    void getDocs(
      query(collection(db, CLIENTS_COLLECTION), where("workspaceId", "==", workspaceId), limit(100)),
    ).then((snap) =>
      setClients(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, "id">) }))),
    );
  }, [workspaceId]);

  const create = async () => {
    if (!name.trim()) return;
    const id = `${workspaceId}_${slugifyClientName(name)}`;
    const row: Client = {
      id,
      workspaceId,
      name: name.trim(),
      slug: slugifyClientName(name),
      locale: "es",
      projectIds: [],
      portalEnabled: true,
      settings: DEFAULT_PORTAL_SETTINGS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, CLIENTS_COLLECTION, id), row, { merge: true });
    setClients((prev) => [...prev, row]);
    setName("");
  };

  return (
    <div style={{ padding: 20, display: "grid", gap: 12, maxWidth: 960 }}>
      <h1 style={{ margin: 0 }}>Clients</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <input onChange={(e) => setName(e.target.value)} placeholder="New client name" value={name} />
        <button onClick={() => void create()} type="button">
          New client
        </button>
      </div>
      {clients.map((c) => (
        <Link key={c.id} to={`/clients/${c.id}`} style={{ padding: 12, border: "1px solid #e6e8ee", borderRadius: 10 }}>
          <strong>{c.name}</strong>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {c.projectIds?.length || 0} projects · portal {c.portalEnabled ? "on" : "off"}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ClientDetailPage({ clientId, workspaceId }: { clientId: string; workspaceId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void import("firebase/firestore").then(async ({ doc, getDoc }) => {
      const snap = await getDoc(doc(db, CLIENTS_COLLECTION, clientId));
      if (snap.exists()) setClient({ id: snap.id, ...(snap.data() as Omit<Client, "id">) });
      const day = new Date().toISOString().slice(0, 10);
      const st = await getDoc(doc(db, CLIENT_STATS_COLLECTION, clientId, "days", day));
      if (st.exists()) setStats(st.data() as Record<string, unknown>);
    });
  }, [clientId]);

  if (!client) return <div style={{ padding: 20 }}>Loading client…</div>;

  return (
    <div style={{ padding: 20, display: "grid", gap: 14, maxWidth: 960 }}>
      <Link to="/clients">← Clients</Link>
      <h1 style={{ margin: 0 }}>{client.name}</h1>
      <section style={{ border: "1px solid #e6e8ee", borderRadius: 12, padding: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Insights · Client health</h2>
        <p style={{ color: "#6b7280" }}>
          Workspace {workspaceId}. Portal engagement and approval turnaround are computed nightly into{" "}
          <code>client_stats/{clientId}/days/…</code>.
        </p>
        <ul>
          <li>Views / downloads / replies (week): {String(stats?.engagement || "—")}</li>
          <li>Approval turnaround (median days): {String(stats?.approvalMedianDays || "—")}</li>
          <li>Open requests / SLA: {String(stats?.requests || "—")}</li>
          <li>CSAT trend: {String(stats?.csat || "—")}</li>
          <li>Invoice status: {String(stats?.invoices || "—")}</li>
          <li>Ask themes: {String(stats?.askThemes || "—")}</li>
        </ul>
      </section>
      <section style={{ border: "1px solid #e6e8ee", borderRadius: 12, padding: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Projects</h2>
        {(client.projectIds || []).map((pid) => (
          <div key={pid}>{pid}</div>
        ))}
      </section>
    </div>
  );
}
