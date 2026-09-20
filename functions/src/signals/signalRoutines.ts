import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

async function ensureSignal(
  db: ReturnType<typeof getFirestore>,
  workspaceId: string,
  data: Record<string, unknown>,
) {
  const entityKey = String(data.entityKey || "");
  const kind = String(data.kind || "");
  const existing = await db
    .collection("signals")
    .doc(workspaceId)
    .collection("items")
    .where("entityKey", "==", entityKey)
    .where("kind", "==", kind)
    .limit(5)
    .get();
  const open = existing.docs.find((d) => !d.data().dismissedAt);
  if (open) return;
  await db.collection("signals").doc(workspaceId).collection("items").add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    dismissedAt: null,
    snoozedUntil: null,
  });
}

/** Hourly + morning signal producers (due-today, blocked, approvals, overdue invoices). */
export const signalRoutinesTick = onSchedule(
  { schedule: "every 60 minutes", region: "us-central1" },
  async () => {
    const db = getFirestore();
    const hour = new Date().getUTCHours();
    const workspaces = await db.collection("workspaces").limit(50).get();

    for (const ws of workspaces.docs) {
      const workspaceId = ws.id;

      // Blocked projects with no owner (hourly)
      try {
        const projects = await db
          .collection("projects")
          .where("workspaceId", "==", workspaceId)
          .limit(100)
          .get();
        for (const p of projects.docs) {
          const d = p.data() as {
            status?: string;
            health?: string;
            assigneeId?: string;
            ownerId?: string;
            name?: string;
            blockedSince?: { toDate?: () => Date };
          };
          const blocked =
            String(d.status || "").toLowerCase().includes("block") ||
            String(d.health || "").toLowerCase() === "red";
          if (!blocked) continue;
          if (d.assigneeId || d.ownerId) continue;
          await ensureSignal(db, workspaceId, {
            uid: "workspace",
            workspaceId,
            kind: "risk",
            title: `${d.name || "Project"} is blocked with no owner`,
            body: "Assign an owner or clear the blocker.",
            severity: "bad",
            entityKey: `project-blocked-${p.id}`,
            actions: [
              { label: "Open", type: "open", payload: { projectId: p.id } },
              { label: "Dismiss", type: "dismiss" },
            ],
          });
        }
      } catch {
        /* skip workspace */
      }

      // Approvals waiting > 4h (hourly) — best-effort from review_candidates
      try {
        const reviews = await db
          .collection("review_candidates")
          .where("workspaceId", "==", workspaceId)
          .limit(40)
          .get();
        const cutoff = Date.now() - 4 * 60 * 60 * 1000;
        for (const r of reviews.docs) {
          const d = r.data() as {
            status?: string;
            createdAt?: { toMillis?: () => number };
            title?: string;
            assigneeUid?: string;
          };
          if (d.status && d.status !== "pending") continue;
          const created = d.createdAt?.toMillis?.() || 0;
          if (created && created > cutoff) continue;
          await ensureSignal(db, workspaceId, {
            uid: d.assigneeUid || "workspace",
            workspaceId,
            kind: "approval",
            title: "Approval waiting over 4 hours",
            body: d.title || "An approval needs a decision.",
            severity: "warn",
            entityKey: `approval-${r.id}`,
            actions: [
              { label: "Open", type: "open", payload: { reviewId: r.id } },
              { label: "Dismiss", type: "dismiss" },
            ],
          });
        }
      } catch {
        /* optional */
      }

      // Due-today commitments at ~07:15 UTC window
      if (hour === 7) {
        try {
          const dateKey = new Date().toISOString().slice(0, 10);
          const tasks = await db
            .collection("tasks")
            .where("workspaceId", "==", workspaceId)
            .where("dueDate", "==", dateKey)
            .limit(40)
            .get();
          for (const t of tasks.docs) {
            const d = t.data() as {
              title?: string;
              assigneeId?: string;
              clientFacing?: boolean;
            };
            if (!d.clientFacing) continue;
            await ensureSignal(db, workspaceId, {
              uid: d.assigneeId || "workspace",
              workspaceId,
              kind: "send",
              title: "Due today — draft a stakeholder email",
              body: d.title || "Commitment due today",
              severity: "info",
              entityKey: `due-today-${t.id}`,
              actions: [
                { label: "Draft email", type: "draft-email", payload: { taskId: t.id } },
                { label: "Dismiss", type: "dismiss" },
              ],
            });
          }
        } catch {
          /* optional */
        }
      }

      // Overdue invoices at 08:00 for billing-flagged users
      if (hour === 8) {
        try {
          const invoices = await db
            .collection("invoices")
            .where("workspaceId", "==", workspaceId)
            .where("status", "in", ["pending", "sent", "overdue"])
            .limit(80)
            .get();
          const byClient = new Map<string, { count: number; sum: number; clientId: string }>();
          const today = new Date().toISOString().slice(0, 10);
          for (const inv of invoices.docs) {
            const d = inv.data() as {
              dueDate?: string;
              amount?: number;
              clientId?: string;
              status?: string;
            };
            const overdue = d.status === "overdue" || (d.dueDate && d.dueDate < today);
            if (!overdue) continue;
            const key = d.clientId || "unknown";
            const cur = byClient.get(key) || { count: 0, sum: 0, clientId: key };
            cur.count += 1;
            cur.sum += Number(d.amount) || 0;
            byClient.set(key, cur);
          }
          for (const [clientId, agg] of byClient) {
            await ensureSignal(db, workspaceId, {
              uid: "workspace",
              workspaceId,
              kind: "billing",
              title: `${agg.count} overdue invoice${agg.count === 1 ? "" : "s"}`,
              body: `$${agg.sum.toLocaleString()} outstanding for client ${clientId}`,
              severity: "bad",
              entityKey: `billing-overdue-${clientId}`,
              actions: [
                { label: "Send reminders", type: "send-reminder", payload: { clientId } },
                { label: "Snooze 7 days", type: "snooze" },
              ],
            });
          }
        } catch {
          /* billing may be empty */
        }
      }
    }
  },
);
