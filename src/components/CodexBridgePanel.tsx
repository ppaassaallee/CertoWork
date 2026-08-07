import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import {
  buildCodexHandoffBrief,
  codexEventTaskPatch,
  createHandoffCode,
  deliveryEvidenceDocument,
  isExecutableWorkItem,
  serializeCodexWorkItem,
  type CodexBridgeEvent,
  type CodexConnection,
  type CodexSyncMode,
} from "../lib/codexBridge";

const CODEX_PLUGIN_URL =
  "codex://plugins/delivereeos-bridge?marketplacePath=%2FUsers%2Falejandropascual%2F.agents%2Fplugins%2Fmarketplace.json";
const CONNECTION_COLLECTION = "integration_configs";
const DELIVERY_AUDIT_COLLECTION = "delivery_reviews";
// A standalone Codex MCP client cannot reuse the browser's private Sites
// session. Keep sync explicitly pending until revocable machine access exists.
const REMOTE_MCP_READY = false;

function projectTitle(project: any) {
  return project?.title || project?.name || "Untitled project";
}

function eventLabel(event: CodexBridgeEvent) {
  if (event.kind === "work_item_completed") return "Completed in Codex";
  if (event.kind === "work_item_progress") return "Progress from Codex";
  if (event.kind === "work_item_claimed") return "Claimed by Codex";
  if (event.kind === "project_gap") return "Gap found by Codex";
  return "Codex update";
}

function dateLabel(value: any) {
  if (!value) return "Never";
  const date = value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function CodexBridgePanel({
  project,
  tasks,
  documents,
  conversationId,
}: {
  project: any;
  tasks: any[];
  documents: any[];
  conversationId?: string | null;
}) {
  const { user, workspace } = useAuth();
  const [connection, setConnection] = useState<CodexConnection | null>(null);
  const [repositoryRoot, setRepositoryRoot] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [codexTaskReference, setCodexTaskReference] = useState("");
  const [syncMode, setSyncMode] = useState<CodexSyncMode>("completion_and_notes");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [events, setEvents] = useState<CodexBridgeEvent[]>([]);
  const [busy, setBusy] = useState<"link" | "sync" | "event" | "">("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const applyingRef = useRef(new Set<string>());

  const executableItems = useMemo(
    () => tasks.filter((item) => isExecutableWorkItem(item) && !["done", "completed", "cancelled", "archived"].includes(String(item.status || "").toLowerCase())),
    [tasks],
  );

  useEffect(() => {
    if (!user || !workspace) return;
    return onSnapshot(
      query(collection(db, CONNECTION_COLLECTION), where("userId", "==", user.uid)),
      (snapshot) => {
        const match = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as CodexConnection)
          .find((item: any) => item.integrationType === "codex_bridge" && item.workspaceId === workspace.id && item.projectId === project.id && item.status !== "disabled");
        setConnection(match || null);
        if (match) {
          setRepositoryRoot(match.repositoryRoot || "");
          setRepositoryUrl(match.repositoryUrl || "");
          setCodexTaskReference(match.codexTaskReference || "");
          setSyncMode(match.syncMode || "completion_and_notes");
          setSelectedIds(match.workItemIds || []);
        }
      },
    );
  }, [project.id, user, workspace]);

  useEffect(() => {
    if (connection || selectedIds.length || executableItems.length === 0) return;
    setSelectedIds(executableItems.slice(0, 8).map((item) => item.id));
  }, [connection, executableItems, selectedIds.length]);

  const authenticatedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!user || !workspace) throw new Error("Sign in before connecting Codex");
    const token = await user.getIdToken();
    const response = await fetch(path, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The Codex bridge could not complete that request");
    return payload;
  }, [user, workspace]);

  const snapshotPayload = useCallback((nextConnection: CodexConnection) => ({
    userId: user?.uid,
    workspaceId: workspace?.id,
    connectionId: nextConnection.id,
    project: {
      id: project.id,
      title: projectTitle(project),
      key: project.projectKey || project.key || "",
      outcome: project.outcome || project.objective || "",
      status: project.status || "active",
      methodology: project.methodology || "scrum",
      sprintGoal: project.sprintGoal || "",
    },
    conversation: {
      id: conversationId || nextConnection.conversationId || null,
      label: `${projectTitle(project)} delivery conversation`,
    },
    workItems: tasks.map((item, index) => serializeCodexWorkItem(item, nextConnection.workItemIds.includes(item.id), index)),
    documents: documents.slice(0, 30).map((item) => ({
      id: item.id,
      title: item.title || item.name || "Untitled document",
      type: item.docType || item.type || "document",
      summary: String(item.summary || item.description || "").slice(0, 4_000),
      updatedAt: item.updatedAt?.toDate?.().toISOString?.() || null,
    })),
  }), [conversationId, documents, project, tasks, user?.uid, workspace?.id]);

  const syncSnapshot = useCallback(async (nextConnection = connection) => {
    if (!nextConnection || !user || !workspace) return;
    setBusy("sync");
    setNotice("");
    try {
      await authenticatedFetch("/api/codex/snapshot", {
        method: "POST",
        body: JSON.stringify(snapshotPayload(nextConnection)),
      });
      await updateDoc(doc(db, CONNECTION_COLLECTION, nextConnection.id), {
        status: nextConnection.status === "connected" ? "connected" : "ready",
        lastSyncAt: serverTimestamp(),
        lastError: "",
        updatedAt: serverTimestamp(),
      });
      setNotice("Project context and selected work are ready for Codex.");
    } catch (error) {
      await updateDoc(doc(db, CONNECTION_COLLECTION, nextConnection.id), {
        status: "error",
        lastError: error instanceof Error ? error.message : "Bridge unavailable",
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
      setNotice(error instanceof Error ? error.message : "Bridge unavailable");
    } finally {
      setBusy("");
    }
  }, [authenticatedFetch, connection, snapshotPayload, user, workspace]);

  const createConnection = async () => {
    if (!user || !workspace || (!repositoryRoot.trim() && !repositoryUrl.trim())) {
      setNotice("Add the repository folder or URL first.");
      return;
    }
    if (selectedIds.length === 0) {
      setNotice("Choose at least one executable work item for the handoff.");
      return;
    }
    setBusy("link");
    setNotice("");
    const ref = doc(collection(db, CONNECTION_COLLECTION));
    const next: CodexConnection = {
      id: ref.id,
      workspaceId: workspace.id,
      projectId: project.id,
      conversationId: conversationId || null,
      handoffCode: createHandoffCode(),
      repositoryRoot: repositoryRoot.trim(),
      repositoryUrl: repositoryUrl.trim(),
      codexTaskReference: codexTaskReference.trim(),
      syncMode,
      workItemIds: selectedIds,
      status: "ready",
    };
    try {
      await setDoc(ref, {
        ...next,
        integrationType: "codex_bridge",
        userId: user.uid,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await authenticatedFetch("/api/codex/connections/upsert", {
        method: "POST",
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          connection: next,
          projectTitle: projectTitle(project),
        }),
      });
      setConnection(next);
      await syncSnapshot(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Codex link could not be created");
    } finally {
      setBusy("");
    }
  };

  const saveConnection = async () => {
    if (!connection || !user || !workspace) return;
    const next = {
      ...connection,
      repositoryRoot: repositoryRoot.trim(),
      repositoryUrl: repositoryUrl.trim(),
      codexTaskReference: codexTaskReference.trim(),
      syncMode,
      workItemIds: selectedIds,
      conversationId: conversationId || connection.conversationId || null,
    };
    setBusy("sync");
    try {
      await updateDoc(doc(db, CONNECTION_COLLECTION, connection.id), {
        repositoryRoot: next.repositoryRoot,
        repositoryUrl: next.repositoryUrl,
        codexTaskReference: next.codexTaskReference,
        syncMode: next.syncMode,
        workItemIds: next.workItemIds,
        conversationId: next.conversationId,
        updatedAt: serverTimestamp(),
      });
      await authenticatedFetch("/api/codex/connections/upsert", {
        method: "POST",
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          connection: next,
          projectTitle: projectTitle(project),
        }),
      });
      setConnection(next);
      await syncSnapshot(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The link could not be updated");
    } finally {
      setBusy("");
    }
  };

  const disconnectConnection = async () => {
    if (!connection || !user || !workspace || busy) return;
    setBusy("sync");
    setNotice("");
    const disabledConnection = { ...connection, status: "disabled" as const };
    try {
      await authenticatedFetch("/api/codex/connections/upsert", {
        method: "POST",
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          connection: disabledConnection,
          projectTitle: projectTitle(project),
        }),
      });
      await updateDoc(doc(db, CONNECTION_COLLECTION, connection.id), {
        status: "disabled",
        disabledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEvents([]);
      setConnection(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Codex link could not be disconnected");
    } finally {
      setBusy("");
    }
  };

  const loadEvents = useCallback(async () => {
    if (!connection || !user || !workspace) return;
    try {
      const search = new URLSearchParams({
        connectionId: connection.id,
        userId: user.uid,
        workspaceId: workspace.id,
      });
      const payload = await authenticatedFetch(`/api/codex/events?${search.toString()}`);
      setEvents(Array.isArray(payload.events) ? payload.events : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not read Codex updates");
    }
  }, [authenticatedFetch, connection, user, workspace]);

  const acknowledgeEvent = useCallback(async (eventId: string, status: "applied" | "rejected") => {
    if (!connection || !user || !workspace) return;
    await authenticatedFetch("/api/codex/events/acknowledge", {
      method: "POST",
      body: JSON.stringify({
        connectionId: connection.id,
        eventId,
        status,
        userId: user.uid,
        workspaceId: workspace.id,
      }),
    });
  }, [authenticatedFetch, connection, user, workspace]);

  const applyEvent = useCallback(async (event: CodexBridgeEvent) => {
    if (!user || !workspace || !connection || applyingRef.current.has(event.id)) return;
    applyingRef.current.add(event.id);
    setBusy("event");
    try {
      const workItem = tasks.find((item) => item.id === event.workItemId);
      if (["work_item_progress", "work_item_completed", "work_item_claimed"].includes(event.kind)) {
        if (!workItem || workItem.projectId !== project.id) throw new Error("The linked work item is no longer in this project");
        const patch = codexEventTaskPatch(event);
        await updateDoc(doc(db, "tasks", workItem.id), {
          ...patch,
          ...(event.kind === "work_item_completed" ? { completedAt: serverTimestamp() } : {}),
          lastCodexSyncAt: serverTimestamp(),
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });

        const payload = event.payload || {};
        const hasEvidence = event.kind === "work_item_completed" || payload.summary || payload.knowledgeNotes?.length;
        if (hasEvidence) {
          await setDoc(doc(db, "knowledge_items", `codex_${event.id}`), {
            userId: user.uid,
            workspaceId: workspace.id,
            projectId: project.id,
            linkedWorkItemIds: [workItem.id],
            title: `Delivery evidence · ${workItem.key ? `${workItem.key} · ` : ""}${workItem.title}`,
            type: "Delivery Report",
            docType: "DeliveryEvidence",
            status: "active",
            content: deliveryEvidenceDocument(event, workItem, project),
            summary: String(payload.summary || eventLabel(event)).slice(0, 1_000),
            source: "codex",
            sourceType: "codex_bridge",
            sourceId: event.id,
            codexRunId: payload.runId || null,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      } else if (event.kind === "project_gap") {
        const payload = event.payload || {};
        await setDoc(doc(db, "knowledge_items", `codex_${event.id}`), {
          userId: user.uid,
          workspaceId: workspace.id,
          projectId: project.id,
          title: `Codex gap · ${payload.title || "Delivery gap"}`,
          type: "Decision Record",
          docType: "DeliveryGap",
          status: "active",
          content: `# ${payload.title || "Delivery gap"}\n\n${payload.details || payload.summary || ""}\n\nSeverity: ${payload.severity || "medium"}`,
          summary: String(payload.details || payload.summary || "").slice(0, 1_000),
          source: "codex",
          sourceType: "codex_bridge",
          sourceId: event.id,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        for (const suggestion of Array.isArray(payload.suggestedWorkItems) ? payload.suggestedWorkItems.slice(0, 12) : []) {
          await addDoc(collection(db, "review_candidates"), {
            userId: user.uid,
            workspaceId: workspace.id,
            projectId: project.id,
            createdBy: user.uid,
            title: suggestion.title || "Codex suggested work",
            type: "task",
            why: suggestion.reason || payload.details || "Gap found during Codex delivery",
            action: "Create task",
            confidence: "medium",
            proposed: { ...suggestion, projectId: project.id, source: "codex" },
            source: "Codex delivery bridge",
            sourceType: "codex_bridge",
            sourceId: event.id,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await setDoc(doc(db, DELIVERY_AUDIT_COLLECTION, event.id), {
        userId: user.uid,
        workspaceId: workspace.id,
        projectId: project.id,
        type: "codex_delivery_sync",
        connectionId: connection.id,
        workItemId: event.workItemId || null,
        kind: event.kind,
        status: "applied",
        payload: event.payload || {},
        appliedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await updateDoc(doc(db, CONNECTION_COLLECTION, connection.id), {
        status: "connected",
        lastSyncAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await acknowledgeEvent(event.id, "applied");
      setNotice("Codex progress and delivery evidence are now reflected in the project.");
      await loadEvents();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Codex update could not be applied");
    } finally {
      applyingRef.current.delete(event.id);
      setBusy("");
    }
  }, [acknowledgeEvent, connection, loadEvents, project, tasks, user, workspace]);

  useEffect(() => {
    if (!connection) return;
    void loadEvents();
    const timer = window.setInterval(loadEvents, 10_000);
    return () => window.clearInterval(timer);
  }, [connection, loadEvents]);

  useEffect(() => {
    for (const event of events) {
      if (event.status === "authorized" && !applyingRef.current.has(event.id)) void applyEvent(event);
    }
  }, [applyEvent, events]);

  const serializedItems = useMemo(
    () => tasks.map((item, index) => serializeCodexWorkItem(item, selectedIds.includes(item.id), index)),
    [selectedIds, tasks],
  );
  const handoffBrief = connection
    ? buildCodexHandoffBrief({ connection: { ...connection, repositoryRoot, repositoryUrl, syncMode }, project, workItems: serializedItems })
    : "";

  if (!connection) {
    return (
      <div className="do-codex-onboarding">
        <section className="do-codex-intro">
          <div className="do-codex-icon"><Code2 size={18} /></div>
          <div><span className="do-project-card-kicker">CODEX DELIVERY BRIDGE</span><h4>Link this project conversation to real engineering work.</h4><p>Codex receives only the project and PBIs you select. It returns progress, evidence, gaps, and delivery notes to this console—without pretending that a build or deployment happened.</p></div>
        </section>

        {!REMOTE_MCP_READY && <p className="do-codex-readiness"><ShieldCheck size={14} /><span><strong>Secure Codex access still needs activation.</strong> This private Site does not expose its browser session to the standalone Codex MCP client. You can prepare the scoped handoff now; automatic two-way sync remains off until a revocable machine credential or dedicated MCP origin is approved.</span></p>}

        <section className="do-codex-steps">
          <label><span><strong>1</strong> Repository</span><input onChange={(event) => setRepositoryRoot(event.target.value)} placeholder="/path/to/the/repository" value={repositoryRoot} /><input onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="Optional GitHub repository URL" value={repositoryUrl} /></label>
          <div className="do-codex-step"><span><strong>2</strong> Work Codex may receive</span><div className="do-codex-work-list">{executableItems.map((item) => <label key={item.id}><input checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((values) => values.includes(item.id) ? values.filter((id) => id !== item.id) : [...values, item.id])} type="checkbox" /><span><b>{item.key || "PBI"}</b>{item.title || item.name}</span></label>)}{executableItems.length === 0 && <p>Create an executable PBI, story, task, or bug before linking Codex.</p>}</div></div>
          <div className="do-codex-step"><span><strong>3</strong> Update permission</span><label className="do-codex-radio"><input checked={syncMode === "completion_and_notes"} onChange={() => setSyncMode("completion_and_notes")} type="radio" /><span><b>Sync delivery automatically</b><small>Progress, completion, tests, and knowledge notes. Scope changes still wait for review.</small></span></label><label className="do-codex-radio"><input checked={syncMode === "review_every_change"} onChange={() => setSyncMode("review_every_change")} type="radio" /><span><b>Review every update</b><small>Codex sends drafts; you apply each one here.</small></span></label></div>
        </section>

        <button className="do-codex-primary" disabled={busy !== "" || executableItems.length === 0} onClick={createConnection} type="button">{busy === "link" ? <Loader2 className="spin" size={14} /> : <Link2 size={14} />} {REMOTE_MCP_READY ? "Create Codex link" : "Prepare Codex handoff"}</button>
        {notice && <p className="do-codex-notice">{notice}</p>}
      </div>
    );
  }

  const pendingEvents = events.filter((event) => event.status === "pending");
  return (
    <div className="do-codex-connected">
      <section className="do-codex-status-card">
        <div className={`do-codex-status is-${connection.status}`}><span><CheckCircle2 size={15} /></span><div><strong>{REMOTE_MCP_READY && connection.status === "connected" ? "Codex linked" : connection.status === "error" ? "Connection needs attention" : REMOTE_MCP_READY ? "Handoff ready" : "Handoff prepared · sync pending"}</strong><small>{projectTitle(project)} · {selectedIds.length} selected item{selectedIds.length === 1 ? "" : "s"}</small></div></div>
        <div className="do-codex-status-meta"><span>DelivereeOS conversation<b>{connection.conversationId ? connection.conversationId.slice(0, 10) : "Project context"}</b></span><span>Last synchronized<b>{dateLabel(connection.lastSyncAt)}</b></span><span>Handoff code<b>{connection.handoffCode}</b></span></div>
      </section>

      <section className="do-codex-launch">
        <div><span className="do-project-card-kicker">START OR LINK A CODEX TASK</span><h4>One brief carries the project context and reporting contract.</h4><p>{REMOTE_MCP_READY ? "Open the DelivereeOS plugin in Codex, start a task in this repository, then paste the brief. The first tool call links both conversations through this handoff." : "Copy the brief as a manual, scoped handoff. The plugin is installed locally, but automatic calls remain intentionally disabled by the private Site gate until secure machine access is approved."}</p></div>
        <div className="do-codex-launch-actions"><button onClick={async () => { await navigator.clipboard.writeText(handoffBrief); setCopied(true); window.setTimeout(() => setCopied(false), 2_000); }} type="button">{copied ? <Check size={13} /> : <Clipboard size={13} />}{copied ? "Copied" : "Copy launch brief"}</button><a href={CODEX_PLUGIN_URL}><ExternalLink size={13} /> Open plugin in Codex</a></div>
        <details><summary>Preview launch brief</summary><pre>{handoffBrief}</pre></details>
      </section>

      <section className="do-codex-settings">
        <div><label><span>Repository folder</span><input onChange={(event) => setRepositoryRoot(event.target.value)} value={repositoryRoot} /></label><label><span>Repository URL</span><input onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="Optional" value={repositoryUrl} /></label></div>
        <label><span>Codex task URL or ID</span><input onChange={(event) => setCodexTaskReference(event.target.value)} placeholder="Optional—Codex may fill this through the bridge" value={codexTaskReference} /></label>
        <div className="do-codex-setting-foot"><select aria-label="Codex update permission" onChange={(event) => setSyncMode(event.target.value as CodexSyncMode)} value={syncMode}><option value="completion_and_notes">Sync delivery automatically</option><option value="review_every_change">Review every update</option></select><button disabled={busy !== ""} onClick={saveConnection} type="button"><RefreshCw className={busy === "sync" ? "spin" : ""} size={13} /> Sync context</button></div>
      </section>

      <section className="do-codex-work-scope">
        <header><div><span className="do-project-card-kicker">CODEX WORK QUEUE</span><h4>Choose the executable items Codex can claim.</h4></div><small>{selectedIds.length} shared</small></header>
        <div>{executableItems.map((item) => <label key={item.id}><input checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((values) => values.includes(item.id) ? values.filter((id) => id !== item.id) : [...values, item.id])} type="checkbox" /><span><b>{item.key || "Work item"}</b><strong>{item.title || item.name}</strong><small>{item.status || "backlog"}{item.codexStatus ? ` · Codex ${item.codexStatus}` : ""}</small></span></label>)}</div>
        <button disabled={busy !== ""} onClick={saveConnection} type="button"><ArrowRight size={13} /> Send selected work to Codex</button>
      </section>

      <section className="do-codex-activity">
        <header><div><span className="do-project-card-kicker">DELIVERY SIGNALS</span><h4>Progress, evidence, and gaps from Codex.</h4></div><button aria-label="Refresh Codex activity" onClick={loadEvents} type="button"><RefreshCw className={busy === "event" ? "spin" : ""} size={13} /></button></header>
        <div>{events.slice(0, 10).map((event) => { const item = tasks.find((task) => task.id === event.workItemId); return <article key={event.id}><span className={`is-${event.status}`}><Code2 size={12} /></span><div><strong>{eventLabel(event)}</strong><p>{event.payload?.summary || event.payload?.title || item?.title || "Codex reported a delivery update."}</p><small>{item?.key || item?.title || "Project"} · {event.status}</small></div>{event.status === "pending" && <div><button onClick={async () => { await acknowledgeEvent(event.id, "rejected"); await loadEvents(); }} type="button">Ignore</button><button onClick={() => applyEvent(event)} type="button"><ShieldCheck size={12} /> Apply</button></div>}</article>; })}{events.length === 0 && <p className="do-codex-empty">No Codex activity yet. Paste the launch brief into a Codex task to begin.</p>}</div>
      </section>

      {pendingEvents.length > 0 && <p className="do-codex-notice"><ShieldCheck size={12} /> {pendingEvents.length} update{pendingEvents.length === 1 ? " is" : "s are"} waiting for review.</p>}
      {notice && <p className="do-codex-notice">{notice}</p>}
      <button className="do-codex-disconnect" disabled={busy !== ""} onClick={disconnectConnection} type="button"><Unplug size={12} /> Disconnect this project</button>
    </div>
  );
}
