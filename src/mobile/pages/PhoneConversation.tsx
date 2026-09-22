import { ChevronLeft } from "../../components/ui/Icon";
import { ConversationThread } from "../../features/collab/ConversationThread";
import { useMobileHeader } from "../MobileChromeContext";

export function PhoneConversation({
  conversationId,
  workspaceId,
  userId,
  userName,
  title,
  onBack,
}: {
  conversationId: string;
  workspaceId: string;
  userId: string;
  userName: string;
  title?: string;
  onBack: () => void;
}) {
  const headerTitle = title || "Conversation";
  useMobileHeader({ title: headerTitle });

  return (
    <div className="m-phone-pad" data-testid="phone-conversation" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <button
        type="button"
        className="m-link-back"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          border: "none",
          background: "transparent",
          color: "#2547C4",
          padding: 0,
          marginBottom: 8,
          fontSize: 14,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={18} /> Inbox
      </button>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ConversationThread
          compact={false}
          conversationId={conversationId}
          userId={userId}
          userName={userName}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}
