import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { InboxRow } from "../../mobile/pages/PhoneInbox";
import type { Signal } from "../signals/types";

const MENTION_KINDS = new Set(["mention", "dm", "reply", "added"]);

export type InboxApprovalInput = {
  id: string;
  title?: string;
  why?: string;
  action?: string;
  type?: string;
  createdAt?: unknown;
  onOpen?: () => void;
  onApprove?: () => void;
  onDecline?: () => void;
};

type CollabNotification = {
  id: string;
  userId?: string;
  workspaceId?: string;
  type?: string;
  kind?: string;
  conversationId?: string;
  messageId?: string;
  preview?: string;
  fromName?: string;
  taskTitle?: string;
  read?: boolean;
  createdAt?: unknown;
};

export type UseInboxRowsArgs = {
  userId?: string | null;
  workspaceId?: string | null;
  approvals?: InboxApprovalInput[];
  signals?: Signal[];
};

export type UseInboxRowsResult = {
  rows: InboxRow[];
  needsActionCount: number;
  unreadDmCount: number;
  markRead: (id: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
};

function notifKind(n: CollabNotification): string {
  return String(n.kind || n.type || "").toLowerCase();
}

function sortByWhenDesc<T extends { when?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const left = String(
      (a.when as { toMillis?: () => number })?.toMillis?.() || a.when || "",
    );
    const right = String(
      (b.when as { toMillis?: () => number })?.toMillis?.() || b.when || "",
    );
    return right.localeCompare(left);
  });
}

/**
 * Subscribes to `user_notifications` and merges optional approvals/signals into inbox rows.
 * Mention-like kinds (mention/dm/reply/added) map to InboxRow kind "mention".
 */
export function useInboxRows({
  userId,
  workspaceId,
  approvals = [],
  signals = [],
}: UseInboxRowsArgs): UseInboxRowsResult {
  const [notifications, setNotifications] = useState<CollabNotification[]>([]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, "user_notifications"),
      where("userId", "==", userId),
      limit(50),
    );
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as CollabNotification,
        );
        setNotifications(
          workspaceId
            ? rows.filter((n) => !n.workspaceId || n.workspaceId === workspaceId)
            : rows,
        );
      },
      () => setNotifications([]),
    );
  }, [userId, workspaceId]);

  const mentionRows: InboxRow[] = useMemo(() => {
    return notifications
      .filter((n) => MENTION_KINDS.has(notifKind(n)))
      .map((n) => {
        const kind = notifKind(n);
        const from = n.fromName || "Someone";
        const label =
          kind === "dm"
            ? `DM from ${from}`
            : kind === "reply"
              ? `Reply from ${from}`
              : kind === "added"
                ? n.taskTitle
                  ? `Added on ${n.taskTitle}`
                  : `Added by ${from}`
                : `Mention from ${from}`;
        return {
          id: n.id,
          title: label,
          subtitle: n.preview || n.taskTitle,
          when: n.createdAt,
          // dm/reply/added map to mention for PhoneInbox segments
          kind: "mention" as const,
          unread: !n.read,
        };
      });
  }, [notifications]);

  const approvalRows: InboxRow[] = useMemo(
    () =>
      approvals.map((a) => ({
        id: `approval-${a.id}`,
        title: a.title || "Approval needed",
        subtitle: a.why || a.action || a.type,
        when: a.createdAt,
        kind: "approval" as const,
        unread: true,
        onOpen: a.onOpen,
        onApprove: a.onApprove,
        onDecline: a.onDecline,
      })),
    [approvals],
  );

  const signalRows: InboxRow[] = useMemo(
    () =>
      signals
        .filter((s) => !s.dismissedAt)
        .map((s) => ({
          id: `signal-${s.id}`,
          title: s.title,
          subtitle: s.body,
          when: s.createdAt,
          kind: "other" as const,
          unread: true,
        })),
    [signals],
  );

  const rows = useMemo(
    () => sortByWhenDesc([...approvalRows, ...signalRows, ...mentionRows]),
    [approvalRows, signalRows, mentionRows],
  );

  const needsActionCount = approvalRows.length + signalRows.length;

  const unreadDmCount = useMemo(
    () =>
      notifications.filter((n) => notifKind(n) === "dm" && !n.read).length,
    [notifications],
  );

  const markRead = useCallback(async (id: string) => {
    await updateDoc(doc(db, "user_notifications", id), { read: true }).catch(
      () => undefined,
    );
  }, []);

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!userId || !conversationId) return;
      const unread = notifications.filter(
        (n) => n.conversationId === conversationId && !n.read,
      );
      if (!unread.length) {
        // Fallback query if local cache is empty
        const q = query(
          collection(db, "user_notifications"),
          where("userId", "==", userId),
          where("conversationId", "==", conversationId),
          limit(50),
        );
        const snap = await getDocs(q).catch(() => null);
        if (!snap?.docs.length) return;
        const batch = writeBatch(db);
        for (const d of snap.docs) {
          if (d.data().read) continue;
          batch.update(d.ref, { read: true });
        }
        await batch.commit().catch(() => undefined);
        return;
      }
      const batch = writeBatch(db);
      for (const n of unread) {
        batch.update(doc(db, "user_notifications", n.id), { read: true });
      }
      await batch.commit().catch(() => undefined);
    },
    [notifications, userId],
  );

  return {
    rows,
    needsActionCount,
    unreadDmCount,
    markRead,
    markConversationRead,
  };
}
