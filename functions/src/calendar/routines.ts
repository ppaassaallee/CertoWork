import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * Fallback routines when the app routines engine is not used for Daily Plan.
 * Opt-in via dayPlanSettings/{uid}. Runs every 15 minutes and matches local HH:mm.
 */
export const dailyPlanRoutinesTick = onSchedule(
  { schedule: "every 15 minutes", region: "us-central1" },
  async () => {
    const db = getFirestore();
    const snap = await db.collection("dayPlanSettings").get();
    const now = new Date();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as {
        enabled?: { dailyPlan?: boolean; closeDay?: boolean };
        dailyPlanAt?: string;
        closeDayAt?: string;
        tz?: string;
      };
      const uid = docSnap.id;
      // Simplified window match on UTC HH:mm — store tz on settings for production.
      const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
      if (data.enabled?.dailyPlan && data.dailyPlanAt && near(hhmm, data.dailyPlanAt)) {
        await db.collection("notifications").doc(uid).collection("items").add({
          title: "Your plan for today is ready — review it in My Work",
          kind: "daily_plan",
          createdAt: FieldValue.serverTimestamp(),
          read: false,
        });
      }
      if (data.enabled?.closeDay && data.closeDayAt && near(hhmm, data.closeDayAt)) {
        await db.collection("notifications").doc(uid).collection("items").add({
          title: "Close your day — 2 minutes",
          kind: "close_day",
          createdAt: FieldValue.serverTimestamp(),
          read: false,
        });
      }
      if (data.enabled?.closeDay && near(hhmm, "23:55")) {
        const dateKey = now.toISOString().slice(0, 10);
        const planRef = db.doc(`dayPlans/${uid}_${dateKey}`);
        const plan = await planRef.get();
        if (plan.exists && !plan.data()?.closedAt) {
          await planRef.set(
            {
              closedAt: FieldValue.serverTimestamp(),
              autoClosed: true,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      }
    }
  },
);

function near(now: string, target: string) {
  return now === target;
}
