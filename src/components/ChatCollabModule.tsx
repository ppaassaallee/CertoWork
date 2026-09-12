import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Folder, Loader2, MessageSquare, Search, ShieldCheck, Sparkles, Tag, Users } from "./ui/Icon";
import { ProductSwitcher } from "./ProductSwitcher";
import { CertoMark } from "./CertoMark";
import { useAuth } from "../lib/AuthContext";
import {
  collabProjectIdFromLocation,
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
  const selectedProjectId = collabProjectIdFromLocation(location.pathname, location.search);
  const openedFor = useRef("");
  const roomsSyncedFor = useRef("");

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
  const projectSignature = projectList
    .map((project) => `${project.id}:${project.name}`)
    .sort()
    .join("|");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const key = `${user?.uid || ""}:${workspace?.id || ""}`;
      const alreadyOpen = openedFor.current === key && Boolean(key);
      if (!alreadyOpen) {
        setLoading(true);
        setError("");
      }
      try {
        const nextStatus = alreadyOpen ? null : await loadCollabStatus();
        if (cancelled) return;
        if (nextStatus) setStatus(nextStatus);
        const configured = alreadyOpen || isConfiguredCollab(nextStatus);
        if (!configured) return;
        if (!user?.email || !workspace) {
          setError("Sign in with an email to open Chat Collab.");
          return;
        }
        const token = await user.getIdToken();
        const identity = {
          token,
          userId: user.uid,
          workspaceId: workspace.id,
          email: user.email,
          displayName: user.displayName || workspaceName || "Certo Work",
          company: workspaceName || "",
        };
        if (!alreadyOpen) {
          const desk = await openCollabDesk({
            ...identity,
            projectId: selectedProjectId,
          });
          if (cancelled) return;
          if (desk.error && !desk.url) {
            setError(desk.error);
            return;
          }
          openedFor.current = key;
          setEmbedUrl(COLLAB_DESK);
          setLoading(false);
        }
        if (roomsSyncedFor.current === projectSignature) return;
        await syncCollabRooms({
          ...identity,
          projectId: selectedProjectId,
          projects: projectList,
        });
        if (cancelled) return;
        roomsSyncedFor.current = projectSignature;
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
  }, [projectList, projectSignature, selectedProjectId, user, workspace, workspaceName]);

  const configured = isConfiguredCollab(status);
  const selectedProject = projectList.find((project) => project.id === selectedProjectId);
  const visibleRooms = projectList.slice(0, 5);

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
                onClick={() => navigate(`/collab/project/${encodeURIComponent(project.id)}`)}
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
            <span>Private to workspace members with access. Project rooms sync automatically.</span>
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
                Switch Work and Collab in the rail. Each Certo Work project gets a
                room in the desk. There is no collab subdomain.
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
              <button className="do-collab-back" onClick={() => navigate("/home")} type="button">
                {t("productBackToWork")}
              </button>
            </div>
          )}
          {configured && embedUrl && (
            <iframe
              allow="clipboard-read; clipboard-write; microphone; camera"
              className="do-collab-frame"
              data-testid="chat-collab-frame"
              src={embedUrl}
              title="Chat Collab"
            />
          )}
        </main>
      </div>
    </div>
  );
}
