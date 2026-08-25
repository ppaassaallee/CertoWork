import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquare } from "./ui/Icon";
import { ProductSwitcher } from "./ProductSwitcher";
import { useAuth } from "../lib/AuthContext";
import { isConfiguredCollab } from "../lib/collabModule";
import { loadCollabStatus, startCollabSso, type CollabStatus } from "../lib/collabClient";
import { t } from "../lib/i18n";

type Props = {
  workspaceName?: string;
};

export function ChatCollabModule({ workspaceName }: Props) {
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
        });
        if (cancelled) return;
        if (!sso.url) {
          setError(sso.error || "Chat Collab could not sign you in.");
          return;
        }
        setEmbedUrl(sso.url);
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
  }, [user, workspace, workspaceName]);

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
            <h1>Chat Collab is ready to mount</h1>
            <p>
              This module opens your Chatwoot desk beside Certo Work. Project
              management stays on Certo Work. Add the Chatwoot origin, platform
              token, and account id as Cloudflare secrets, then reopen Chat Collab.
            </p>
            <ul>
              <li><code>CHATWOOT_URL</code> — public Chatwoot origin, e.g. https://collab.certo.work</li>
              <li><code>CHATWOOT_PLATFORM_TOKEN</code> — Platform App access token</li>
              <li><code>CHATWOOT_ACCOUNT_ID</code> — Chatwoot account for this workspace</li>
            </ul>
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
