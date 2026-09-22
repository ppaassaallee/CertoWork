/**
 * Bridge between War Room UI types and Collab conversation collections.
 * Keeps WarRoom.tsx field usage stable while reading/writing the new model.
 */
import type {
  WarRoomChat,
  WarRoomMessage,
  WarRoomParticipant,
  WarRoomThread,
} from "../../components/warroom/types";
import type { Conversation, ConversationMessage, ConversationParticipant } from "./types";
import {
  CONVERSATIONS,
  CONVERSATION_MESSAGES,
  CONVERSATION_PARTICIPANTS,
  CONVERSATION_THREADS,
} from "./collections";

export {
  CONVERSATIONS as WR_CHATS,
  CONVERSATION_PARTICIPANTS as WR_PARTICIPANTS,
  CONVERSATION_MESSAGES as WR_MESSAGES,
  CONVERSATION_THREADS as WR_THREADS,
};

export function conversationToWarRoomChat(c: Conversation): WarRoomChat {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    title: c.title,
    description: c.description,
    type: (c.type === "external" || c.type === "item_thread" || c.type === "record_thread"
      ? "group"
      : c.type) as WarRoomChat["type"],
    linkedProjectId: c.anchor?.type === "project" ? c.anchor.id : undefined,
    status: c.status,
    createdBy: c.createdBy,
    isPrivate: c.isPrivate,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    deletedAt: c.deletedAt,
  };
}

export function participantToWarRoom(p: ConversationParticipant): WarRoomParticipant {
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    chatId: p.conversationId,
    participantType: p.kind === "agent" ? "agent" : "user",
    userId: p.userId,
    agentId: p.agentId,
    displayName: p.displayName,
    avatarUrl: p.avatar,
    roleInChat: p.roleInChat,
    status: p.status,
    joinedAt: p.joinedAt,
    addedBy: p.addedBy,
    createdAt: p.joinedAt,
    updatedAt: p.joinedAt,
  };
}

export function messageToWarRoom(m: ConversationMessage): WarRoomMessage {
  const cardType = m.card?.type;
  let messageType: WarRoomMessage["messageType"] = "text";
  if (m.kind === "system") messageType = "system";
  else if (m.kind === "agent_status") messageType = "agent_status";
  else if (m.kind === "file") messageType = "file";
  else if (m.kind === "action_plan") messageType = "action_plan";
  else if (m.kind === "status_report") messageType = "status_report";
  else if (cardType === "item") messageType = "task_reference";
  else if (cardType === "project") messageType = "project_reference";
  else if (m.kind === "card") messageType = "widget";

  return {
    id: m.id,
    workspaceId: m.workspaceId,
    chatId: m.conversationId,
    threadId: m.threadId || undefined,
    senderType: m.senderType === "odysseus" || m.senderType === "guest" ? "system" : (m.senderType as WarRoomMessage["senderType"]),
    senderUserId: m.senderType === "user" ? m.senderId : undefined,
    senderAgentId: m.senderType === "agent" ? m.senderId : undefined,
    messageType,
    content: m.text,
    mentionsUserIds: m.mentions?.userIds || [],
    mentionsAgentIds: m.mentions?.agentIds || [],
    linkedFileIds: (m.attachments || []).map((a) => a.id),
    linkedEntityType: cardType === "item" ? "task" : cardType === "project" ? "project" : undefined,
    linkedEntityId: m.card?.ref?.id ? String(m.card.ref.id) : undefined,
    modelProvider: m.model?.provider,
    modelName: m.model?.name,
    tokenUsage: m.model?.tokens,
    costEstimate: m.model?.cost,
    status: m.status === "sending" ? "sending" : m.status === "failed" ? "failed" : m.status === "deleted" ? "deleted" : "sent",
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    deletedAt: m.deletedAt,
  };
}

export function warRoomChatWrite(
  chat: Partial<WarRoomChat> & { workspaceId: string; title: string; type: WarRoomChat["type"]; createdBy: string },
  nowIso: string,
) {
  return {
    workspaceId: chat.workspaceId,
    type: chat.type,
    title: chat.title,
    description: chat.description || null,
    anchor: chat.linkedProjectId
      ? { type: "project" as const, id: chat.linkedProjectId, label: chat.title }
      : null,
    participantIds: [] as string[],
    agentIds: [] as string[],
    guestIds: [] as string[],
    isPrivate: Boolean(chat.isPrivate),
    status: chat.status || "active",
    lastMessageAt: null,
    messageCount: 0,
    pinnedMessageIds: [] as string[],
    createdBy: chat.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
    legacy: { warRoomChatId: chat.id },
  };
}

export function warRoomParticipantWrite(
  part: {
    workspaceId: string;
    chatId: string;
    participantType: "user" | "agent";
    userId?: string;
    agentId?: string;
    displayName: string;
    roleInChat?: string;
    addedBy: string;
    avatarUrl?: string;
  },
  nowIso: string,
) {
  const subjectId = part.userId || part.agentId || "unknown";
  return {
    id: `${part.chatId}_${subjectId}`,
    workspaceId: part.workspaceId,
    conversationId: part.chatId,
    kind: part.participantType === "agent" ? ("agent" as const) : ("user" as const),
    userId: part.userId,
    agentId: part.agentId,
    displayName: part.displayName,
    avatar: part.avatarUrl,
    roleInChat: (part.roleInChat === "owner" ? "owner" : "member") as "owner" | "member",
    status: "active" as const,
    unreadCount: 0,
    joinedAt: nowIso,
    addedBy: part.addedBy,
  };
}

export function warRoomMessageWrite(
  msg: {
    workspaceId: string;
    chatId: string;
    threadId?: string;
    senderType: "user" | "agent" | "system" | "odysseus";
    senderUserId?: string;
    senderAgentId?: string;
    senderName?: string;
    messageType?: string;
    content: string;
    mentionsUserIds?: string[];
    mentionsAgentIds?: string[];
    linkedEntityType?: string;
    linkedEntityId?: string;
    status?: string;
  },
  nowIso: string,
) {
  const senderId =
    msg.senderUserId || msg.senderAgentId || (msg.senderType === "system" ? "system" : "unknown");
  let kind: ConversationMessage["kind"] = "text";
  if (msg.messageType === "system") kind = "system";
  else if (msg.messageType === "agent_status") kind = "agent_status";
  else if (msg.messageType === "action_plan") kind = "action_plan";
  else if (msg.messageType === "status_report") kind = "status_report";
  else if (msg.messageType === "file") kind = "file";
  else if (msg.messageType === "task_reference" || msg.messageType === "project_reference") kind = "card";

  let card: ConversationMessage["card"] = null;
  if (msg.linkedEntityId) {
    if (msg.linkedEntityType === "project" || msg.messageType === "project_reference") {
      card = { type: "project", ref: { id: msg.linkedEntityId } };
    } else {
      card = { type: "item", ref: { id: msg.linkedEntityId } };
    }
  }

  return {
    workspaceId: msg.workspaceId,
    conversationId: msg.chatId,
    threadId: msg.threadId || null,
    senderType: msg.senderType === "odysseus" ? ("odysseus" as const) : msg.senderType,
    senderId,
    senderName: msg.senderName || senderId,
    kind,
    text: msg.content,
    mentions: {
      userIds: msg.mentionsUserIds || [],
      agentIds: msg.mentionsAgentIds || [],
      itemIds: [],
      projectIds: [],
      recordRefs: [],
    },
    attachments: [],
    card,
    reactions: {},
    visibility: "internal" as const,
    channel: "app" as const,
    status: (msg.status === "failed" ? "failed" : "sent") as "sent" | "failed",
    replyCount: 0,
    model: null,
    searchText: msg.content.toLowerCase(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function snapConversation(id: string, data: Record<string, unknown>): WarRoomChat {
  return conversationToWarRoomChat({ id, ...(data as Omit<Conversation, "id">) });
}

export function snapParticipant(id: string, data: Record<string, unknown>): WarRoomParticipant {
  // Support both old (chatId) and new (conversationId) shapes during transition.
  const conversationId = String(data.conversationId || data.chatId || "");
  const kind = (data.kind || data.participantType || "user") as string;
  return participantToWarRoom({
    id,
    workspaceId: String(data.workspaceId || ""),
    conversationId,
    kind: kind === "agent" ? "agent" : "user",
    userId: data.userId as string | undefined,
    agentId: data.agentId as string | undefined,
    displayName: String(data.displayName || ""),
    avatar: (data.avatar || data.avatarUrl) as string | undefined,
    roleInChat: data.roleInChat as ConversationParticipant["roleInChat"],
    status: data.status === "removed" ? "removed" : "active",
    unreadCount: Number(data.unreadCount || 0),
    joinedAt: String(data.joinedAt || data.createdAt || ""),
    addedBy: String(data.addedBy || ""),
  });
}

export function snapMessage(id: string, data: Record<string, unknown>): WarRoomMessage {
  // New shape has text/conversationId/kind; old has content/chatId/messageType.
  if (data.text != null || data.conversationId != null) {
    return messageToWarRoom({ id, ...(data as Omit<ConversationMessage, "id">) });
  }
  return { id, ...(data as Omit<WarRoomMessage, "id">) };
}

export type { WarRoomThread };
