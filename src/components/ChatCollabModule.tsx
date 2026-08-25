import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquare, Search } from "./ui/Icon";
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
  type CollabChannel,
  type CollabRoom,
  type CollabStatus,
} from "../lib/collabClient";
import { partitionCollabDesk, type CollabDeskItem } from "../lib/collabRooms";
import { timeAgo } from "../lib/workspaceDisplay";
import { t } from "../lib/i18n";

type ProjectRef = { id: string; name: string };

type Props = {
  workspaceName?: string;
  projects?: ProjectRef[];
};

function asDeskItems(rooms: CollabRoom[], channels: CollabChannel[]): CollabDeskItem[] {
  return [
    ...rooms.map((room) => ({
      id: room.projectId,
      projectId: room.projectId,
      name: room.name,
      kind: "project" as const,
      url: room.url,
      lastActivityAt: Number(room.lastActivityAt || 0),
    })),
    ...channels.map((channel) => ({
      id: String(channel.id || channel.inboxId || channel.name),
      name: channel.name,
      kind: "channel" as const,
      url: channel.url,
      lastActivityAt: Number(channel.lastActivityAt || 0),
    })),
  ];
}

export function ChatCollabModule({ workspaceName, projects = [] }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, workspace } = useAuth();
  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [rooms, setRooms] = useState<CollabRoom[]>([]);
  const [channels, setChannels] = useState<CollabChannel[]>([]);
  const [roomQuery, setRoomQuery] = useState("");
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
        if (roomsSyncedFor.current === projectSignature) {
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
        setChannels(nextRooms.channels || []);
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
  const desk = useMemo(
    () => partitionCollabDesk(asDeskItems(rooms, channels), roomQuery),
    [channels, roomQuery, rooms],
  );

  const openItem = (item: CollabDeskItem) => {
    if (!item.url) return;
    setEmbedUrl(item.url);
    if (item.kind === "project" && item.projectId) {
      navigate(collabProjectPath(item.projectId));
    }
  };

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
        <button className="do-collab-back" onClick={() => navigate("/home")} type="button">
          <ArrowLeft size={14} />
          {t("productBackToWork")}
        </button>
      </header>
      <div className="do-collab-body">
        <aside className="do-collab-nav" data-testid="collab-rooms-collapse">
          <label className="do-collab-search">
            <Search size={14} />
            <input
              aria-label="Search project rooms"
              data-testid="collab-room-search"
              onChange={(event) => setRoomQuery(event.target.value)}
              placeholder="Find a project room"
              type="search"
              value={roomQuery}
            />
          </label>
          <div className="do-collab-nav-scroll">
            <section>
              <h2>Project rooms</h2>
              {desk.projectRooms.length ? (
                <ul>
                  {desk.projectRooms.map((item) => (
                    <li key={item.id}>
                      <button
                        className={item.projectId === selectedProjectId ? "is-active" : ""}
                        data-testid="collab-room-select"
                        onClick={() => openItem(item)}
                        type="button"
                      >
                        <span>{item.name}</span>
                        {item.lastActivityAt ? <small>{timeAgo(item.lastActivityAt)}</small> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{roomQuery.trim() ? "No matching project rooms." : "Project rooms will appear here."}</p>
              )}
            </section>
            <section data-testid="collab-other-channels">
              <h2>Other channels</h2>
              {desk.otherChannels.length ? (
                <ul>
                  {desk.otherChannels.map((item) => (
                    <li key={item.id}>
                      <button onClick={() => openItem(item)} type="button">
                        <span>{item.name}</span>
                        {item.lastActivityAt ? <small>{timeAgo(item.lastActivityAt)}</small> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sessions and non-project channels stay here.</p>
              )}
            </section>
          </div>
        </aside>
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
    </div>
  );
}
