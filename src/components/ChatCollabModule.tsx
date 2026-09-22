import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquare } from "./ui/Icon";
import { ProductSwitcher } from "./ProductSwitcher";
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

/** Same-origin Chatwoot desk — four-pane inbox lives entirely inside /app. */
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
          // Prefer room deep-link when SSO returns one; otherwise the full desk.
          setEmbedUrl(desk.roomUrl || desk.url || COLLAB_DESK);
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

  const retry = () => {
    openedFor.current = "";
    deskBootstrapped.current = false;
    roomsSyncedFor.current = "";
    setEmbedUrl("");
    setStatus(null);
    setError("");
    setLoading(true);
    setRetryNonce((n) => n + 1);
  };

  return (
    <div className="do-collab-shell is-desk" data-testid="chat-collab-module">
      {/* Floating Certo chrome only — Chatwoot owns the four-pane desk. */}
      <div className="do-collab-float" data-testid="chat-collab-float">
        <ProductSwitcher product="collab" />
        <button
          className="do-collab-float-back"
          onClick={() => navigate("/home")}
          type="button"
          title={t("productBackToWork")}
        >
          <ArrowLeft size={14} />
          <span>{t("productBackToWork")}</span>
        </button>
      </div>

      <div className="do-collab-body">
        <main className="do-collab-stage">
          {loading && !embedUrl ? (
            <div className="do-collab-state">
              <Loader2 className="spin" size={18} />
              <p>Opening Chat Collab…</p>
            </div>
          ) : null}
          {!loading && !configured ? (
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
          ) : null}
          {!loading && configured && error && !embedUrl ? (
            <div className="do-collab-state" role="alert">
              <h1>Chat Collab could not open</h1>
              <p>{error}</p>
              <button className="do-collab-back" onClick={retry} type="button">
                Retry
              </button>
            </div>
          ) : null}
          {configured && embedUrl ? (
            <div className="do-collab-frame-wrap">
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
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
