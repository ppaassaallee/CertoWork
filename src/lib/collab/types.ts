import { z } from "zod";

export const CONVERSATIONS = "conversations";
export const CONVERSATION_PARTICIPANTS = "conversation_participants";
export const CONVERSATION_MESSAGES = "conversation_messages";
export const CONVERSATION_THREADS = "conversation_threads";
export const CONVERSATION_TYPING = "conversation_typing";
export const PRESENCE = "presence";
export const GUESTS = "guests";

export type ConversationType =
  | "project_room"
  | "item_thread"
  | "record_thread"
  | "group"
  | "dm"
  | "agent_room"
  | "external";

export type ConversationAnchorType =
  | "project"
  | "task"
  | "record"
  | "invoice"
  | "note";

export type ConversationAnchor = {
  type: ConversationAnchorType;
  id: string;
  tableId?: string;
  label: string;
};

export type Conversation = {
  id: string;
  workspaceId: string;
  type: ConversationType;
  title: string;
  description?: string;
  emoji?: string;
  anchor?: ConversationAnchor | null;
  participantIds: string[];
  agentIds: string[];
  guestIds: string[];
  isPrivate: boolean;
  status: "active" | "archived";
  lastMessageAt?: string | null;
  lastMessagePreview?: string;
  lastMessageBy?: string;
  messageCount: number;
  pinnedMessageIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  legacy?: { warRoomChatId?: string; workItemId?: string };
};

export type ParticipantKind = "user" | "agent" | "guest";

export type ConversationParticipant = {
  id: string;
  workspaceId: string;
  conversationId: string;
  kind: ParticipantKind;
  userId?: string;
  agentId?: string;
  guestId?: string;
  displayName: string;
  avatar?: string;
  roleInChat?: "owner" | "member" | "viewer";
  status: "active" | "removed";
  muted?: boolean;
  lastReadAt?: string | null;
  unreadCount: number;
  joinedAt: string;
  addedBy: string;
};

export type MessageKind =
  | "text"
  | "system"
  | "agent_status"
  | "file"
  | "card"
  | "action_plan"
  | "status_report";

export type MessageSenderType =
  | "user"
  | "agent"
  | "guest"
  | "system"
  | "odysseus";

export type MessageCardType =
  | "item"
  | "project"
  | "record"
  | "invoice"
  | "approval"
  | "signal"
  | "brief"
  | "action_items";

export type MessageCard = {
  type: MessageCardType;
  ref: Record<string, unknown>;
};

export type MessageMentions = {
  userIds: string[];
  agentIds: string[];
  itemIds: string[];
  projectIds: string[];
  recordRefs: Array<{ tableId: string; id: string }>;
};

export type MessageAttachment = {
  id: string;
  name: string;
  url: string;
  mime: string;
  size: number;
  storagePath: string;
};

export type ConversationMessage = {
  id: string;
  workspaceId: string;
  conversationId: string;
  threadId?: string | null;
  senderType: MessageSenderType;
  senderId: string;
  senderName: string;
  kind: MessageKind;
  text: string;
  mentions: MessageMentions;
  attachments: MessageAttachment[];
  card?: MessageCard | null;
  reactions: Record<string, string[]>;
  visibility: "internal" | "external";
  channel: "app" | "email" | "portal" | "whatsapp" | "routine" | "system";
  editedAt?: string | null;
  deletedAt?: string | null;
  status: "sent" | "failed" | "deleted" | "sending";
  replyCount: number;
  model?: { provider: string; name: string; tokens?: number; cost?: number } | null;
  searchText: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationThread = {
  id: string;
  workspaceId: string;
  conversationId: string;
  rootMessageId: string;
  title?: string;
  status: "active" | "resolved";
  participantIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PresenceDoc = {
  uid: string;
  workspaceId: string;
  lastSeenAt: string;
  activeConversationId?: string | null;
};

export type TypingDoc = {
  conversationId: string;
  uid: string;
  at: string;
};

/** External guest invited into a conversation (portal / /c/:token). */
export type Guest = {
  id: string;
  workspaceId: string;
  email?: string | null;
  name: string;
  /** Invite token used for `/c/:token` lookup (hashed in production later). */
  token?: string;
  status: "active" | "revoked" | "expired";
  conversationIds: string[];
  lastSeenAt?: string | null;
  createdBy: string;
  createdAt: string;
};

export const conversationTypeSchema = z.enum([
  "project_room",
  "item_thread",
  "record_thread",
  "group",
  "dm",
  "agent_room",
  "external",
]);

export const conversationAnchorSchema = z.object({
  type: z.enum(["project", "task", "record", "invoice", "note"]),
  id: z.string().min(1),
  tableId: z.string().optional(),
  label: z.string(),
});

export const conversationSchema = z.object({
  id: z.string(),
  workspaceId: z.string().min(1),
  type: conversationTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  emoji: z.string().optional(),
  anchor: conversationAnchorSchema.nullable().optional(),
  participantIds: z.array(z.string()),
  agentIds: z.array(z.string()),
  guestIds: z.array(z.string()),
  isPrivate: z.boolean(),
  status: z.enum(["active", "archived"]),
  lastMessageAt: z.string().nullable().optional(),
  lastMessagePreview: z.string().optional(),
  lastMessageBy: z.string().optional(),
  messageCount: z.number().int().nonnegative(),
  pinnedMessageIds: z.array(z.string()),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  legacy: z
    .object({
      warRoomChatId: z.string().optional(),
      workItemId: z.string().optional(),
    })
    .optional(),
});

export const messageMentionsSchema = z.object({
  userIds: z.array(z.string()),
  agentIds: z.array(z.string()),
  itemIds: z.array(z.string()),
  projectIds: z.array(z.string()),
  recordRefs: z.array(z.object({ tableId: z.string(), id: z.string() })),
});

export const conversationMessageSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  conversationId: z.string(),
  threadId: z.string().nullable().optional(),
  senderType: z.enum(["user", "agent", "guest", "system", "odysseus"]),
  senderId: z.string(),
  senderName: z.string(),
  kind: z.enum([
    "text",
    "system",
    "agent_status",
    "file",
    "card",
    "action_plan",
    "status_report",
  ]),
  text: z.string(),
  mentions: messageMentionsSchema,
  attachments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      url: z.string(),
      mime: z.string(),
      size: z.number(),
      storagePath: z.string(),
    }),
  ),
  card: z
    .object({
      type: z.enum([
        "item",
        "project",
        "record",
        "invoice",
        "approval",
        "signal",
        "brief",
        "action_items",
      ]),
      ref: z.record(z.unknown()),
    })
    .nullable()
    .optional(),
  reactions: z.record(z.array(z.string())),
  visibility: z.enum(["internal", "external"]),
  channel: z.enum(["app", "email", "portal", "whatsapp", "routine", "system"]),
  editedAt: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  status: z.enum(["sent", "failed", "deleted", "sending"]),
  replyCount: z.number().int().nonnegative(),
  model: z
    .object({
      provider: z.string(),
      name: z.string(),
      tokens: z.number().optional(),
      cost: z.number().optional(),
    })
    .nullable()
    .optional(),
  searchText: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function emptyMentions(): MessageMentions {
  return {
    userIds: [],
    agentIds: [],
    itemIds: [],
    projectIds: [],
    recordRefs: [],
  };
}

export function participantDocId(conversationId: string, subjectId: string) {
  return `${conversationId}_${subjectId}`;
}

export function presenceDocId(workspaceId: string, uid: string) {
  return `${workspaceId}_${uid}`;
}

export function typingDocId(conversationId: string, uid: string) {
  return `${conversationId}_${uid}`;
}
