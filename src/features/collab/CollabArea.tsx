import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Sparkles } from "../../components/ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { conversationService, type Conversation } from "../../lib/collab";
import { t } from "../../lib/i18n";
import { useCollabEnabled } from "../flags/featureUserFlags";
import { CollabContextPane } from "./CollabContextPane";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";

type Props = {
  workspaceName?: string;
  workspaceId?: string;
  userId?: string;
  userName?: string;
  projectId?: string;
  onOpenOdysseus?: () => void;
};

/** Native Collab desk. Flag-off shows coming soon until Phase B surfaces land. */
export function CollabArea({
  workspaceName,
  workspaceId: workspaceIdProp,
  userId: userIdProp,
  userName: userNameProp,
  projectId: _projectId,
  onOpenOdysseus,
}: Props) {
  const enabled = useCollabEnabled();
  const { user, workspace } = useAuth();

  const workspaceId = workspaceIdProp || workspace?.id || "";
  const userId = userIdProp || user?.uid || "";
  const userName =
    userNameProp ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "You";
  const label = workspaceName || workspace?.name;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [odysseusMode, setOdysseusMode] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  const loadList = useCallback(async () => {
    if (!workspaceId || !userId) {
      setConversations([]);
      return;
    }
    setLoadingList(true);
    try {
      const list = await conversationService.listForUser(userId, workspaceId);
      setConversations(list);
    } catch {
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  }, [userId, workspaceId]);

  useEffect(() => {
    if (!enabled) return;
    void loadList();
  }, [enabled, loadList]);

  const onSelect = (id: string) => {
    setOdysseusMode(false);
    setSelectedId(id);
    const found = conversations.find((c) => c.id === id) || null;
    setActiveConversation(found);
  };

  const onSelectOdysseus = () => {
    setSelectedId(null);
    setActiveConversation(null);
    setOdysseusMode(true);
  };

  if (!enabled) {
    return (
      <div className="do-collab-area" data-testid="collab-area-coming-soon">
        <div className="do-collab-coming-soon">
          <MessageSquare size={28} />
          <h1>Collab</h1>
          <p>
            Native conversations for projects, items, and your team are rolling out.
            {label ? ` (${label})` : ""} Enable the Collab flag in Labs to try early builds. Item
            comments keep working until then.
          </p>
          <p className="do-collab-coming-soon-hint">{t("productBackToWork")}: use the sidebar Home.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="do-collab-area do-collab-desk" data-testid="collab-area">
      <ConversationList
        conversations={conversations}
        loading={loadingList}
        selectedId={selectedId}
        odysseusSelected={odysseusMode}
        userId={userId}
        onSelect={onSelect}
        onSelectOdysseus={onSelectOdysseus}
        onRefresh={() => void loadList()}
      />

      {odysseusMode ? (
        <div className="do-collab-thread do-collab-odysseus-panel" data-testid="collab-odysseus-panel">
          <header className="do-collab-thread-header">
            <div className="do-collab-thread-header-text">
              <h2>Odysseus</h2>
              <p className="do-collab-muted">AI strategist for this workspace</p>
            </div>
          </header>
          <div className="do-collab-thread-empty">
            <Sparkles size={28} />
            <h2>Opens existing Odysseus chat</h2>
            <p>
              The native Odysseus panel already lives in the workspace chrome. Use it from the
              sidebar or header — this row is a Collab entry point stub.
            </p>
            {onOpenOdysseus ? (
              <button type="button" className="do-collab-btn-primary" onClick={onOpenOdysseus}>
                Open Odysseus
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <ConversationThread
          workspaceId={workspaceId}
          userId={userId}
          userName={userName}
          conversationId={selectedId}
          onConversationReady={setActiveConversation}
        />
      )}

      <CollabContextPane
        conversation={odysseusMode ? null : activeConversation}
        collapsed={contextCollapsed}
        onToggle={() => setContextCollapsed((v) => !v)}
        onOpenOdysseus={onOpenOdysseus}
      />
    </div>
  );
}
