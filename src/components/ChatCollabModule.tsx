import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquare } from "./ui/Icon";
import { ProductSwitcher } from "./ProductSwitcher";
import { useAuth } from "../lib/AuthContext";
import {
  collabProjectIdFromLocation,
  collabProjectPath,
  isConfiguredCollab,
} from "../lib/collabModule";
import { loadCollabStatus, startCollabSso, type CollabRoom, type CollabStatus } from "../lib/collabClient";
import { t } from "../lib/i18n";

type ProjectRef = { id: string; name: string };

type Props = {
  workspaceName?: string;
  projects?: ProjectRef[];
};

export function ChatCollabModule({ workspaceName, projects = [] }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, workspace } = useAuth();
  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [rooms, setRooms] = useState<CollabRoom[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const selectedProjectId = collabProjectIdFromLocation(location.pathname, location.search);

  const projectList = useMemo(
    () =>
      projects
        .map((project) => ({ id: String(project.id || "").trim(), name: String(project.name || "Project").trim() || "Project" }))
        .filter((project) => project.id),
    [projects],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const nextStatus = await loadCollabStatus();
        if (cancelled) return;
        setStatus(nextStatus);
        if (!isConfiguredCollab(nextStatus)) {
          return;
        }
        if (!user?.email || !workspace) {
          setError("Sign in with an email to open Chat Collab.");
          return;
        }
        const token = await user.getIdToken();
        const sso = await startCollabSso({
          token,
          userId: user.uid,
          workspaceId: workspace.id,
          email: user.email,
          displayName: user.displayName || workspaceName || "Certo Work",
          projectId: selectedProjectId,
          projects: projectList,
        });
        if (cancelled) return;
        if (!sso.url) {
          setError(sso.error || "Chat Collab could not sign you in.");
          return;
        }
        setRooms(sso.rooms || []);
        setEmbedUrl(sso.url);
        if (sso.roomUrl) {
          window.setTimeout(() => {
            if (!cancelled) setEmbedUrl(sso.roomUrl || "");
          }, 1800);
        }
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
  }, [user, workspace, workspaceName, selectedProjectId, projectList]);

  const configured = isConfiguredCollab(status);

  return (
    <div className="do-collab-shell" data-testid="chat-collab-module">
      <header className="do-collab-rail">
        <ProductSwitcher product="collab" />
        <span className="do-collab-rail-copy">
          <MessageSquare size={14} />
          <strong>{t("productCollab")}</strong>
          <small>{workspaceName || "Certo Work"}</small>
        </span>
        {rooms.length > 0 && (
          <label className="do-collab-room-picker">
            <span>Project room</span>
            <select
              data-testid="collab-room-select"
              onChange={(event) => navigate(collabProjectPath(event.target.value))}
              value={selectedProjectId || rooms[0]?.projectId || ""}
            >
              {rooms.map((room) => (
                <option key={room.projectId} value={room.projectId}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="do-collab-back" onClick={() => navigate("/home")} type="button">
          <ArrowLeft size={14} />
          {t("productBackToWork")}
        </button>
      </header>
      <main className="do-collab-stage">
        {loading && (
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
        {!loading && configured && error && (
          <div className="do-collab-state" role="alert">
            <h1>Chat Collab could not open</h1>
            <p>{error}</p>
            <button className="do-collab-back" onClick={() => navigate("/home")} type="button">
              {t("productBackToWork")}
            </button>
          </div>
        )}
        {!loading && configured && embedUrl && (
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
  );
}
