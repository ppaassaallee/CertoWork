import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Folder, Loader2, MessageSquare, Search, ShieldCheck, Sparkles, Tag, Users } from "./ui/Icon";
import { ProductSwitcher } from "./ProductSwitcher";
import { CertoMark } from "./CertoMark";
import { useAuth } from "../lib/AuthContext";
import {
  collabProjectIdFromLocation,
  collabProjectPath,
  isConfiguredCollab,
} from "../lib/collabModule";
import {
  loadCollabStatus,
  openCollabDesk,
  syncCollabRooms,
  type CollabStatus,
} from "../lib/collabClient";
import { t } from "../lib/i18n";

type ProjectRef = { id: string; name: string };

type Props = {
  workspaceName?: string;
  projects?: ProjectRef[];
};

const COLLAB_DESK = "/app";

export function ChatCollabModule({ workspaceName, projects = [] }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, workspace } = useAuth();
  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const selectedProjectId = collabProjectIdFromLocation(location.pathname, location.search);
  const openedFor = useRef("");
  const roomsSyncedFor = useRef("");
  const deskBootstrapped = useRef(false);

  const projectList = useMemo(
    () =>
      projects
        .map((project) => ({
          id: String(project.id || "").trim(),
          name: String(project.name || "Project").trim() || "Project",
        }))
        .filter((project) => project.id),
    [projects],
  );
  const projectSignature = useMemo(
    () =>
      projectList
        .map((project) => `${project.id}:${project.name}`)
        .sort()
        .join("|"),
    [projectList],
  );

  const userId = user?.uid || "";
  const userEmail = user?.email || "";
  const workspaceId = workspace?.id || "";
  const sessionKey = `${userId}:${workspaceId}`;
  const userRef = useRef(user);
  const projectsRef = useRef(projectList);
  userRef.current = user;
  projectsRef.current = projectList;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!sessionKey || !userEmail) {
        setLoading(false);
        setError(userId ? "Sign in with an email to open Chat Collab." : "");
        return;
      }

      const alreadyOpen = openedFor.current === sessionKey && deskBootstrapped.current;
      if (!alreadyOpen) {
        setLoading(true);
        setError("");
      }

      try {
        const nextStatus = await loadCollabStatus();
        if (cancelled) return;
        setStatus(nextStatus);
        if (!isConfiguredCollab(nextStatus)) {
          setError(nextStatus.error || "");
          return;
        }

        const activeUser = userRef.current;
        if (!activeUser) return;
        const token = await activeUser.getIdToken();
        if (cancelled) return;
        const rooms = projectsRef.current;
        const identity = {
          token,
          userId,
          workspaceId,
          email: userEmail,
          displayName: activeUser.displayName || workspaceName || "Certo Work",
          company: workspaceName || "",
        };

        if (!alreadyOpen) {
          const desk = await openCollabDesk({
            ...identity,
            projectId: selectedProjectId,
            projects: rooms,
          });
          if (cancelled) return;
          if (desk.error && !desk.url) {
            setError(desk.error);
            return;
          }
          if (desk.error) setError(desk.error);
          openedFor.current = sessionKey;
          deskBootstrapped.current = true;
          setEmbedUrl(desk.url || COLLAB_DESK);
          setLoading(false);
        }

        const syncKey = `${sessionKey}:${projectSignature}:${selectedProjectId}`;
        if (roomsSyncedFor.current === syncKey) return;
        await syncCollabRooms({
          ...identity,
          projectId: selectedProjectId,
          projects: rooms,
        });
        if (cancelled) return;
        roomsSyncedFor.current = syncKey;
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Chat Collab is unavailable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    sessionKey,
    userEmail,
    userId,
    workspaceId,
    workspaceName,
    selectedProjectId,
    projectSignature,
    retryNonce,
  ]);

  const configured = isConfiguredCollab(status) || Boolean(embedUrl);
  const selectedProject = projectList.find((project) => project.id === selectedProjectId);
  const visibleRooms = projectList.slice(0, 8);

  return (
    <div className="do-collab-shell" data-testid="chat-collab-module">
      <header className="do-collab-rail">
        <span className="do-collab-brand">
          <CertoMark className="do-collab-logo" size={30} />
          <span>
            <strong>Collab Desk</strong>
            <small>{workspaceName || "Certo Work"}</small>
          </span>
        </span>
        <ProductSwitcher product="collab" />
        <label className="do-collab-search">
          <Search size={14} />
          <input aria-label="Search Collab" placeholder="Search conversations..." />
          <kbd>⌘ K</kbd>
        </label>
        <span className="do-collab-rail-copy">
          <Sparkles size={14} />
          <strong>{selectedProject ? selectedProject.name : t("productCollab")}</strong>
          <small>{configured ? "Rooms synced" : "Setup check"}</small>
        </span>
        <button className="do-collab-back" onClick={() => navigate("/home")} type="button">
          <ArrowLeft size={14} />
          {t("productBackToWork")}
        </button>
      </header>
      <div className="do-collab-body">
        <aside className="do-collab-sidebar" aria-label="Collab rooms">
          <section>
            <span className="do-kicker">Desk</span>
            <h2>Team inbox</h2>
            <p>Project rooms, support conversations, and human follow-ups stay in one place.</p>
          </section>
          <div className="do-collab-room-stack">
            <button className={!selectedProjectId ? "is-active" : ""} onClick={() => navigate("/collab")} type="button">
              <span><Tag size={14} /></span>
              <strong>General</strong>
              <small>Workspace room</small>
            </button>
            {visibleRooms.map((project) => (
              <button
                className={project.id === selectedProjectId ? "is-active" : ""}
                key={project.id}
                onClick={() => navigate(collabProjectPath(project.id))}
                type="button"
              >
                <span><Folder size={14} /></span>
                <strong>{project.name}</strong>
                <small>Project room</small>
              </button>
            ))}
          </div>
          <div className="do-collab-sidebar-note">
            <ShieldCheck size={15} />
            <span>Private to workspace members with access. Project rooms sync automatically on certo.work.</span>
          </div>
        </aside>
        <main className="do-collab-stage">
          <div className="do-collab-stage-head">
            <div>
              <span className="do-kicker">{selectedProject ? "Project conversation" : "Workspace conversation"}</span>
              <h1>{selectedProject ? selectedProject.name : "General team desk"}</h1>
            </div>
            <div className="do-collab-stage-pills">
              <span><Users size={13} /> Team</span>
              <span><MessageSquare size={13} /> Live chat</span>
            </div>
          </div>
          {loading && !embedUrl && (
            <div className="do-collab-state">
              <Loader2 className="spin" size={18} />
              <p>Opening Chat Collab…</p>
            </div>
          )}
          {!loading && !configured && (
            <div className="do-collab-state" data-testid="chat-collab-setup">
              <MessageSquare size={22} />
              <h1>Chat Collab opens on certo.work</h1>
              <p>
                {error ||
                  "Wire the private Chatwoot host (ops/chatwoot) with CHATWOOT_URL, CHATWOOT_PLATFORM_TOKEN, and CHATWOOT_ACCOUNT_ID. Do not point at www.chatwoot.com — the Worker proxies /app on certo.work."}
              </p>
              <button className="do-collab-back" onClick={() => navigate("/home")} type="button">
                {t("productBackToWork")}
              </button>
            </div>
          )}
          {!loading && configured && error && !embedUrl && (
            <div className="do-collab-state" role="alert">
              <h1>Chat Collab could not open</h1>
              <p>{error}</p>
              <button
                className="do-collab-back"
                onClick={() => {
                  openedFor.current = "";
                  deskBootstrapped.current = false;
                  roomsSyncedFor.current = "";
                  setEmbedUrl("");
                  setStatus(null);
                  setError("");
                  setLoading(true);
                  setRetryNonce((n) => n + 1);
                }}
                type="button"
              >
                Retry
              </button>
            </div>
          )}
          {configured && embedUrl && (
            <>
              {error ? (
                <p className="do-collab-inline-error" role="status">
                  {error}
                </p>
              ) : null}
              <iframe
                allow="clipboard-read; clipboard-write; microphone; camera"
                className="do-collab-frame"
                data-testid="chat-collab-frame"
                src={embedUrl}
                title="Chat Collab"
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
