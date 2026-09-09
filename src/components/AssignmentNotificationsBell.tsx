import { useEffect, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";
import { Bell } from "./ui/Icon";
import { db } from "../lib/firebase";

export type UserNotification = {
  id: string;
  type?: string;
  taskId?: string;
  taskTitle?: string;
  workspaceId?: string;
  assignedByName?: string;
  read?: boolean;
  createdAt?: unknown;
};

function sortNotifications(items: UserNotification[]) {
  return [...items].sort((left, right) => {
    const leftAt = String((left as any).createdAt?.toMillis?.() || left.createdAt || "");
    const rightAt = String((right as any).createdAt?.toMillis?.() || right.createdAt || "");
    return rightAt.localeCompare(leftAt);
  });
}

export function AssignmentNotificationsBell({
  userId,
  onOpenTask,
}: {
  userId?: string | null;
  onOpenTask?: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    const q = query(
      collection(db, "user_notifications"),
      where("userId", "==", userId),
      limit(30),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setItems(
          sortNotifications(
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as UserNotification)),
          ).slice(0, 20),
        );
      },
      () => setItems([]),
    );
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  const unread = items.filter((item) => !item.read);
  const markRead = async (notification: UserNotification) => {
    if (notification.read) return;
    await updateDoc(doc(db, "user_notifications", notification.id), { read: true }).catch(
      () => undefined,
    );
  };

  if (!userId) return null;

  return (
    <div className="do-notify-bell" ref={rootRef}>
      <button
        aria-label={unread.length ? `${unread.length} unread assignments` : "Notifications"}
        className={`do-icon-button${unread.length ? " is-attention" : ""}`}
        onClick={() => setOpen((current) => !current)}
        title="Assignments"
        type="button"
      >
        <Bell size={15} />
        {unread.length > 0 && <em className="do-notify-count">{unread.length}</em>}
      </button>
      {open && (
        <div className="do-notify-menu" role="menu">
          <strong>Assigned to you</strong>
          {items.length === 0 && <p className="do-notify-empty">No assignment notifications yet.</p>}
          {items.map((item) => (
            <button
              className={`do-notify-item${!item.read ? " is-unread" : ""}`}
              key={item.id}
              onClick={() => {
                void markRead(item);
                if (item.taskId && onOpenTask) onOpenTask(item.taskId);
                setOpen(false);
              }}
              type="button"
            >
              <span>{item.taskTitle || "Work item"}</span>
              <small>
                {item.type === "task_collaborator"
                  ? item.assignedByName
                    ? `Added as collaborator by ${item.assignedByName}`
                    : "Added as collaborator"
                  : item.assignedByName
                    ? `Assigned by ${item.assignedByName}`
                    : "New assignment"}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
