/**
 * Migrate War Room + work_item_messages → native Collab collections.
 *
 * Dry-run by default. Pass --apply to write.
 * Idempotent via `legacy.warRoomChatId` / `legacy.workItemId` / message id reuse.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 *
 * Usage:
 *   npx tsx scripts/migrateCollab.ts
 *   npx tsx scripts/migrateCollab.ts --apply
 */
import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const BATCH = 400;

type Counts = Record<string, { source: number; written: number; skipped: number }>;

function loadCredential() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (raw) return cert(JSON.parse(raw));
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (clientEmail && privateKey) {
    return cert({
      projectId: firebaseConfig.projectId,
      clientEmail,
      privateKey,
    });
  }
  throw new Error(
    "Missing FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY",
  );
}

function iso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function emptyMentions() {
  return {
    userIds: [] as string[],
    agentIds: [] as string[],
    itemIds: [] as string[],
    projectIds: [] as string[],
    recordRefs: [] as Array<{ tableId: string; id: string }>,
  };
}

function mapMessageKind(messageType: string | undefined): string {
  switch (messageType) {
    case "system":
      return "system";
    case "agent_status":
      return "agent_status";
    case "file":
      return "file";
    case "action_plan":
      return "action_plan";
    case "status_report":
      return "status_report";
    case "widget":
    case "task_reference":
    case "project_reference":
      return "card";
    default:
      return "text";
  }
}

function mapCard(data: Record<string, unknown>) {
  const entityType = String(data.linkedEntityType || "");
  const entityId = String(data.linkedEntityId || "");
  if (!entityId) return null;
  if (entityType === "task" || entityType === "item" || data.messageType === "task_reference") {
    return { type: "item", ref: { id: entityId } };
  }
  if (entityType === "project" || data.messageType === "project_reference") {
    return { type: "project", ref: { id: entityId } };
  }
  return null;
}

async function commitOps(
  db: Firestore,
  ops: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
) {
  if (!APPLY || ops.length === 0) return;
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = db.batch();
    ops.slice(i, i + BATCH).forEach((op) => op(batch));
    await batch.commit();
  }
}

async function migrateWarRooms(db: Firestore, counts: Counts) {
  const chats = await db.collection("war_room_chats").get();
  counts.war_room_chats = { source: chats.size, written: 0, skipped: 0 };
  counts.war_room_participants = { source: 0, written: 0, skipped: 0 };
  counts.war_room_messages = { source: 0, written: 0, skipped: 0 };
  counts.war_room_threads = { source: 0, written: 0, skipped: 0 };
  counts.war_room_files = { source: 0, written: 0, skipped: 0 };

  const chatOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  const partOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  const msgOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  const threadOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

  const filesByChat = new Map<string, QueryDocumentSnapshot[]>();
  const filesSnap = await db.collection("war_room_files").get();
  counts.war_room_files.source = filesSnap.size;
  for (const f of filesSnap.docs) {
    const chatId = String(f.data().chatId || "");
    if (!filesByChat.has(chatId)) filesByChat.set(chatId, []);
    filesByChat.get(chatId)!.push(f);
  }

  for (const chatDoc of chats.docs) {
    const chat = chatDoc.data();
    const conversationId = chatDoc.id;
    const existing = await db.collection("conversations").doc(conversationId).get();
    if (existing.exists && existing.data()?.legacy?.warRoomChatId === chatDoc.id) {
      counts.war_room_chats.skipped += 1;
    } else {
      const participantsSnap = await db
        .collection("war_room_participants")
        .where("chatId", "==", chatDoc.id)
        .get();
      counts.war_room_participants.source += participantsSnap.size;

      const participantIds: string[] = [];
      const agentIds: string[] = [];
      for (const p of participantsSnap.docs) {
        const pd = p.data();
        if (pd.participantType === "agent" && pd.agentId) {
          agentIds.push(String(pd.agentId));
        } else if (pd.userId) {
          participantIds.push(String(pd.userId));
        }
      }

      const type = String(chat.type || "group") as
        | "project_room"
        | "dm"
        | "group"
        | "agent_room";
      const anchor =
        type === "project_room" && chat.linkedProjectId
          ? {
              type: "project" as const,
              id: String(chat.linkedProjectId),
              label: String(chat.title || "Project"),
            }
          : null;

      const convData = {
        workspaceId: String(chat.workspaceId || ""),
        type,
        title: String(chat.title || "Chat").slice(0, 120),
        description: chat.description || undefined,
        anchor,
        participantIds: Array.from(new Set(participantIds)),
        agentIds: Array.from(new Set(agentIds)),
        guestIds: [],
        isPrivate: Boolean(chat.isPrivate),
        status: chat.status === "archived" ? "archived" : "active",
        lastMessageAt: null,
        messageCount: 0,
        pinnedMessageIds: [],
        createdBy: String(chat.createdBy || ""),
        createdAt: iso(chat.createdAt),
        updatedAt: iso(chat.updatedAt),
        deletedAt: chat.deletedAt ? iso(chat.deletedAt) : null,
        legacy: { warRoomChatId: chatDoc.id },
      };

      chatOps.push((batch) => {
        batch.set(db.collection("conversations").doc(conversationId), convData, { merge: true });
      });
      counts.war_room_chats.written += 1;

      for (const p of participantsSnap.docs) {
        const pd = p.data();
        const subjectId = String(pd.userId || pd.agentId || p.id);
        const partId = `${conversationId}_${subjectId}`;
        const existingPart = await db.collection("conversation_participants").doc(partId).get();
        if (existingPart.exists) {
          counts.war_room_participants.skipped += 1;
          continue;
        }
        partOps.push((batch) => {
          batch.set(db.collection("conversation_participants").doc(partId), {
            id: partId,
            workspaceId: String(chat.workspaceId || ""),
            conversationId,
            kind: pd.participantType === "agent" ? "agent" : "user",
            userId: pd.userId || undefined,
            agentId: pd.agentId || undefined,
            displayName: String(pd.displayName || subjectId),
            avatar: pd.avatarUrl || undefined,
            roleInChat: pd.roleInChat === "owner" ? "owner" : "member",
            status: pd.status === "removed" ? "removed" : "active",
            unreadCount: 0,
            joinedAt: iso(pd.joinedAt || pd.createdAt),
            addedBy: String(pd.addedBy || chat.createdBy || ""),
          });
        });
        counts.war_room_participants.written += 1;
      }
    }

    // Messages (always check per-id idempotency)
    const messagesSnap = await db
      .collection("war_room_messages")
      .where("chatId", "==", chatDoc.id)
      .get();
    counts.war_room_messages.source += messagesSnap.size;

    const chatFiles = filesByChat.get(chatDoc.id) || [];
    const attachmentsByMessage = new Map<
      string,
      Array<{ id: string; name: string; url: string; mime: string; size: number; storagePath: string }>
    >();
    for (const f of chatFiles) {
      const fd = f.data();
      const linkedIds: string[] = Array.isArray(fd.linkedMessageIds)
        ? fd.linkedMessageIds
        : [];
      // Files referenced from messages via linkedFileIds — attach to all messages that list them later.
      void linkedIds;
    }

    for (const msg of messagesSnap.docs) {
      const existingMsg = await db.collection("conversation_messages").doc(msg.id).get();
      if (existingMsg.exists) {
        counts.war_room_messages.skipped += 1;
        continue;
      }
      const md = msg.data();
      const mentions = emptyMentions();
      mentions.userIds = Array.isArray(md.mentionsUserIds)
        ? md.mentionsUserIds.map(String)
        : [];
      mentions.agentIds = Array.isArray(md.mentionsAgentIds)
        ? md.mentionsAgentIds.map(String)
        : [];

      const linkedFileIds: string[] = Array.isArray(md.linkedFileIds)
        ? md.linkedFileIds.map(String)
        : [];
      const attachments = linkedFileIds
        .map((fid) => {
          const f = chatFiles.find((x) => x.id === fid);
          if (!f) return null;
          const fd = f.data();
          return {
            id: f.id,
            name: String(fd.title || "file"),
            url: String(fd.url || ""),
            mime: String(fd.mime || "application/octet-stream"),
            size: Number(fd.size || 0),
            storagePath: String(fd.storagePath || ""),
          };
        })
        .filter(Boolean) as Array<{
        id: string;
        name: string;
        url: string;
        mime: string;
        size: number;
        storagePath: string;
      }>;
      if (attachments.length) counts.war_room_files.written += attachments.length;

      const senderType =
        md.senderType === "agent"
          ? "agent"
          : md.senderType === "system"
            ? "system"
            : "user";
      const senderId = String(
        md.senderUserId || md.senderAgentId || md.senderId || "system",
      );
      const text = String(md.content || md.text || "");

      msgOps.push((batch) => {
        batch.set(db.collection("conversation_messages").doc(msg.id), {
          workspaceId: String(md.workspaceId || chat.workspaceId || ""),
          conversationId,
          threadId: md.threadId || null,
          senderType,
          senderId,
          senderName: senderId,
          kind: mapMessageKind(String(md.messageType || "text")),
          text,
          mentions,
          attachments,
          card: mapCard(md as Record<string, unknown>),
          reactions: {},
          visibility: "internal",
          channel: "app",
          editedAt: null,
          deletedAt: md.deletedAt ? iso(md.deletedAt) : null,
          status: md.status === "deleted" ? "deleted" : md.status === "failed" ? "failed" : "sent",
          replyCount: 0,
          model:
            md.modelProvider || md.modelName
              ? {
                  provider: String(md.modelProvider || ""),
                  name: String(md.modelName || ""),
                  tokens: md.tokenUsage ? Number(md.tokenUsage) : undefined,
                  cost: md.costEstimate ? Number(md.costEstimate) : undefined,
                }
              : null,
          searchText: text.toLowerCase(),
          createdAt: iso(md.createdAt),
          updatedAt: iso(md.updatedAt),
        });
      });
      counts.war_room_messages.written += 1;
    }

    const threadsSnap = await db
      .collection("war_room_threads")
      .where("chatId", "==", chatDoc.id)
      .get();
    counts.war_room_threads.source += threadsSnap.size;
    for (const t of threadsSnap.docs) {
      const existingT = await db.collection("conversation_threads").doc(t.id).get();
      if (existingT.exists) {
        counts.war_room_threads.skipped += 1;
        continue;
      }
      const td = t.data();
      threadOps.push((batch) => {
        batch.set(db.collection("conversation_threads").doc(t.id), {
          workspaceId: String(td.workspaceId || chat.workspaceId || ""),
          conversationId,
          rootMessageId: String(td.parentMessageId || ""),
          title: td.title || undefined,
          status: td.status === "resolved" ? "resolved" : "active",
          participantIds: [],
          createdBy: String(td.createdBy || ""),
          createdAt: iso(td.createdAt),
          updatedAt: iso(td.updatedAt),
        });
      });
      counts.war_room_threads.written += 1;
    }
  }

  await commitOps(db, chatOps);
  await commitOps(db, partOps);
  await commitOps(db, msgOps);
  await commitOps(db, threadOps);
}

async function migrateWorkItemMessages(db: Firestore, counts: Counts) {
  const snap = await db.collection("work_item_messages").get();
  counts.work_item_messages = { source: snap.size, written: 0, skipped: 0 };
  counts.item_threads = { source: 0, written: 0, skipped: 0 };
  counts.guests_from_messages = { source: 0, written: 0, skipped: 0 };

  const byItem = new Map<string, QueryDocumentSnapshot[]>();
  for (const doc of snap.docs) {
    const workItemId = String(doc.data().workItemId || "");
    if (!workItemId) continue;
    if (!byItem.has(workItemId)) byItem.set(workItemId, []);
    byItem.get(workItemId)!.push(doc);
  }
  counts.item_threads.source = byItem.size;

  const convOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  const partOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  const msgOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  const guestOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

  for (const [workItemId, messages] of byItem) {
    const conversationId = `task_${workItemId}`;
    const existing = await db.collection("conversations").doc(conversationId).get();
    const first = messages[0].data();
    const workspaceId = String(first.workspaceId || "");

    let taskTitle = workItemId;
    let assigneeId = "";
    let reporterId = "";
    try {
      const task = await db.collection("tasks").doc(workItemId).get();
      if (task.exists) {
        const td = task.data() || {};
        taskTitle = String(td.title || td.name || workItemId);
        assigneeId = String(td.assigneeId || td.ownerId || "");
        reporterId = String(td.reporterId || td.createdBy || td.userId || "");
      }
    } catch {
      /* ignore */
    }

    const participantIds = new Set<string>();
    if (assigneeId) participantIds.add(assigneeId);
    if (reporterId) participantIds.add(reporterId);
    for (const m of messages) {
      const authorId = m.data().authorId;
      if (authorId && m.data().authorRole !== "requester") {
        participantIds.add(String(authorId));
      }
    }

    if (existing.exists && existing.data()?.legacy?.workItemId === workItemId) {
      counts.item_threads.skipped += 1;
    } else {
      convOps.push((batch) => {
        batch.set(
          db.collection("conversations").doc(conversationId),
          {
            workspaceId,
            type: "item_thread",
            title: taskTitle.slice(0, 120),
            anchor: { type: "task", id: workItemId, label: taskTitle },
            participantIds: Array.from(participantIds),
            agentIds: [],
            guestIds: [],
            isPrivate: false,
            status: "active",
            lastMessageAt: null,
            messageCount: 0,
            pinnedMessageIds: [],
            createdBy: reporterId || Array.from(participantIds)[0] || "migration",
            createdAt: iso(first.createdAt),
            updatedAt: iso(first.createdAt),
            legacy: { workItemId },
          },
          { merge: true },
        );
      });
      counts.item_threads.written += 1;

      for (const uid of participantIds) {
        const partId = `${conversationId}_${uid}`;
        partOps.push((batch) => {
          batch.set(
            db.collection("conversation_participants").doc(partId),
            {
              id: partId,
              workspaceId,
              conversationId,
              kind: "user",
              userId: uid,
              displayName: uid,
              roleInChat: "member",
              status: "active",
              unreadCount: 0,
              joinedAt: iso(first.createdAt),
              addedBy: "migration",
            },
            { merge: true },
          );
        });
      }
    }

    for (const m of messages) {
      const existingMsg = await db.collection("conversation_messages").doc(m.id).get();
      if (existingMsg.exists) {
        counts.work_item_messages.skipped += 1;
        continue;
      }
      const md = m.data();
      const isGuest = String(md.authorRole || "") === "requester";
      const visibility =
        String(md.visibility || "public") === "public" ? "external" : "internal";
      const channel = (["app", "email", "portal", "system"].includes(String(md.channel))
        ? String(md.channel)
        : "app") as string;
      const text = String(md.body || md.text || "");
      let senderId = String(md.authorId || md.authorEmail || "unknown");
      let senderType: "user" | "guest" | "system" = isGuest ? "guest" : "user";

      if (isGuest && md.authorEmail) {
        const guestId = `guest_${String(md.authorEmail).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
        senderId = guestId;
        const guestRef = db.collection("guests").doc(guestId);
        const guestExisting = await guestRef.get();
        if (!guestExisting.exists) {
          guestOps.push((batch) => {
            batch.set(guestRef, {
              workspaceId,
              email: String(md.authorEmail),
              name: String(md.authorName || md.authorEmail),
              token: "", // hashed token set when inviting (Step 16)
              status: "active",
              conversationIds: [conversationId],
              createdBy: "migration",
              createdAt: iso(md.createdAt),
            });
          });
          counts.guests_from_messages.written += 1;
        } else {
          counts.guests_from_messages.skipped += 1;
        }
      }

      msgOps.push((batch) => {
        batch.set(db.collection("conversation_messages").doc(m.id), {
          workspaceId,
          conversationId,
          threadId: null,
          senderType,
          senderId,
          senderName: String(md.authorName || senderId),
          kind: "text",
          text,
          mentions: emptyMentions(),
          attachments: [],
          card: null,
          reactions: {},
          visibility,
          channel: channel === "portal" ? "portal" : channel === "email" ? "email" : "app",
          editedAt: null,
          deletedAt: null,
          status: "sent",
          replyCount: 0,
          model: null,
          searchText: text.toLowerCase(),
          createdAt: iso(md.createdAt),
          updatedAt: iso(md.createdAt),
        });
      });
      counts.work_item_messages.written += 1;
    }
  }

  await commitOps(db, convOps);
  await commitOps(db, partOps);
  await commitOps(db, guestOps);
  await commitOps(db, msgOps);
}

async function main() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!getApps().length) {
    initializeApp({
      credential: loadCredential(),
      projectId: firebaseConfig.projectId,
    });
  }
  const db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(firebaseConfig.firestoreDatabaseId)
    : getFirestore();

  console.log(`Collab migration — mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  const counts: Counts = {};
  await migrateWarRooms(db, counts);
  await migrateWorkItemMessages(db, counts);

  console.log("\nCounts:");
  for (const [key, value] of Object.entries(counts)) {
    console.log(
      `  ${key}: source=${value.source} written=${value.written} skipped=${value.skipped}`,
    );
  }

  const docPath = path.join(process.cwd(), "docs/collab/MIGRATION.md");
  const lines = [
    "# Collab migration",
    "",
    `Last run: ${new Date().toISOString()} (${APPLY ? "apply" : "dry-run"})`,
    "",
    "| Collection | Source | Written | Skipped |",
    "|---|---:|---:|---:|",
    ...Object.entries(counts).map(
      ([k, v]) => `| ${k} | ${v.source} | ${v.written} | ${v.skipped} |`,
    ),
    "",
    "## Mapping",
    "",
    "- `war_room_chats` → `conversations` (id preserved; `legacy.warRoomChatId`)",
    "- `war_room_participants` → `conversation_participants`",
    "- `war_room_messages` → `conversation_messages` (id preserved)",
    "- `war_room_threads` → `conversation_threads`",
    "- `war_room_files` → message `attachments[]`",
    "- `work_item_messages` → `item_thread` conversations (`task_{workItemId}`) + messages",
    "- Guest requesters → `guests/{guest_email}` stubs",
    "",
    "Legacy collections are read-only for 30 days, then delete in a follow-up.",
    "",
  ];
  fs.writeFileSync(docPath, lines.join("\n"));
  console.log(`\nWrote ${docPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
