import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquare } from "./ui/Icon";
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
  startCollabSso,
  syncCollabRooms,
  type CollabRoom,
  type CollabStatus,
} from "../lib/collabClient";
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
  const [roomsOpen, setRoomsOpen] = useState(false);
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
          const sso = await startCollabSso({
            ...identity,
            projectId: selectedProjectId,
          });
          if (cancelled) return;
          if (!sso.url) {
            setError(sso.error || "Chat Collab could not sign you in.");
            return;
          }
          openedFor.current = key;
          setEmbedUrl(sso.url);
          setLoading(false);
        }
        if (!projectList.length || roomsSyncedFor.current === projectSignature) {
          const selected = rooms.find((room) => room.projectId === selectedProjectId);
          if (selected?.url) setEmbedUrl(selected.url);
          return;
        }
        const nextRooms = await syncCollabRooms({
          ...identity,
          projectId: selectedProjectId,
          projects: projectList,
        });
        if (cancelled) return;
        roomsSyncedFor.current = projectSignature;
        if (nextRooms.rooms?.length) setRooms(nextRooms.rooms);
        const selected = nextRooms.rooms?.find((room) => room.projectId === selectedProjectId);
        if (selected?.url) setEmbedUrl(selected.url);
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
  const selectedRoom =
    rooms.find((room) => room.projectId === selectedProjectId) || rooms[0] || null;

  return (
    <div className="do-collab-shell" data-testid="chat-collab-module">
      <header className="do-collab-rail">
        <CertoMark className="do-collab-logo" size={28} />
        <ProductSwitcher product="collab" />
        <span className="do-collab-rail-copy">
          <MessageSquare size={14} />
          <strong>{t("productCollab")}</strong>
          <small>{workspaceName || "Certo Work"}</small>
        </span>
        {rooms.length > 0 && (
          <details
            className="do-collab-rooms"
            data-testid="collab-rooms-collapse"
            onToggle={(event) => setRoomsOpen((event.target as HTMLDetailsElement).open)}
            open={roomsOpen}
          >
            <summary>
              Project rooms
              <small>{selectedRoom?.name || `${rooms.length} rooms`}</small>
            </summary>
            <label className="do-collab-room-picker">
              <span>Open room</span>
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
          </details>
        )}
        <button className="do-collab-back" onClick={() => navigate("/home")} type="button">
          <ArrowLeft size={14} />
          {t("productBackToWork")}
        </button>
      </header>
      <main className="do-collab-stage">
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
  );
}
