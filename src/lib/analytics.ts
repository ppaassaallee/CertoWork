import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export const computeAnalytics = async (userId: string, workspaceId: string, days: number = 30) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    const getNormP = (p: any): number => {
        if (p === undefined || p === null) return 4;
        if (typeof p === 'number') return p;
        const clean = String(p).toUpperCase().replace('P', '').trim();
        const num = parseInt(clean, 10);
        return isNaN(num) ? 4 : num;
    };

    // Helper to fetch data
    const fetchCollection = async (collName: string, filters: any[] = []) => {
        let q = query(collection(db, collName), where("userId", "==", userId), where("workspaceId", "==", workspaceId), ...filters);
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    };

    const [tasks, habits, workoutLogs, reviewItems, projects] = await Promise.all([
        fetchCollection("tasks"),
        fetchCollection("habit_logs", [where("date", ">=", start.toISOString().split('T')[0])]),
        fetchCollection("workout_logs", [where("date", ">=", start.toISOString().split('T')[0])]),
        fetchCollection("review_candidates"),
        fetchCollection("projects"),
    ]);

    //--- Metrics Logic ---
    
    // 1. ONE Thing
    const oneThingTasks = tasks.filter(t => t.isOneThing);
    const completedOneThings = oneThingTasks.filter(t => t.status === 'done');
    const oneThingCompletion = oneThingTasks.length ? (completedOneThings.length / oneThingTasks.length) : 0;
    
    // Consistency for ONE task over days
    const daysOneThingSet = new Set(oneThingTasks.map(t => t.createdAt?.toDate().toISOString().split('T')[0])).size;
    const daysOneThingCompleted = new Set(completedOneThings.map(t => t.completedAt?.toDate().toISOString().split('T')[0])).size;

    // 2. Execution Quality / Priority Breakdown
    const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'killed' || t.status === 'delegated');
    const p1p2 = completedTasks.filter(t => getNormP(t.priority) <= 2);
    const executionQuality = completedTasks.length ? (p1p2.length / completedTasks.length) : 0;
    
    // 3. Busywork / Kill / Delegate
    const p3p4 = completedTasks.filter(t => getNormP(t.priority) >= 3);
    const busyworkRatio = completedTasks.length ? (p3p4.length / completedTasks.length) : 0;
    
    // 4. Review Health
    const pendingReviews = reviewItems.filter(r => r.status === 'pending');
    const oldestReview = pendingReviews.sort((a,b) => a.createdAt.toDate() - b.createdAt.toDate())[0];
    const oldestReviewAgeDays = oldestReview ? (end.getTime() - oldestReview.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24) : 0;

    // 5. Flow Health
    const createdInPeriod = tasks.filter(t => t.createdAt.toDate() >= start);
    // ClosedItems = completed + killed + delegated
    const closedInPeriod = tasks.filter(t => (t.status === 'done' || t.status === 'killed' || t.status === 'delegated') && t.completedAt?.toDate() >= start);
    const flowRatio = createdInPeriod.length ? (closedInPeriod.length / createdInPeriod.length) : 1;

    // 6. Project Momentum
    const projectMomentum = projects.map(p => {
        const projectTasks = tasks.filter(t => t.projectId === p.id);
        const activeTasks = projectTasks.filter(t => t.updatedAt?.toDate() >= start);
        return {
            title: p.title,
            isMoving: activeTasks.length > 0
        };
    });

    // 7. Focus Score
    const top3Tasks = tasks.filter(t => getNormP(t.priority) === 1);
    const completedTop3 = top3Tasks.filter(t => t.status === 'done');
    const top3Completion = top3Tasks.length ? (completedTop3.length / top3Tasks.length) : 0;

    const reviewHealth = Math.max(0, Math.min(1, 1 - oldestReviewAgeDays / 7));
    const busyworkControl = 1 - busyworkRatio;

    const focusScore = Math.round((oneThingCompletion * 0.3 + top3Completion * 0.2 + executionQuality * 0.2 + reviewHealth * 0.15 + busyworkControl * 0.15) * 100);

    // 8. Habit/Workout (Stubs)
    const habitConsistency = habits.length ? (habits.filter(h => h.status === 'done').length / habits.length) : null;
    const workoutConsistency = workoutLogs.length ? (workoutLogs.length / (days * 0.5)) : null; // simplified plan approximation

    return {
        focusScore,
        oneThingConsistency: daysOneThingSet ? Math.round((daysOneThingCompleted / daysOneThingSet) * 100) : null,
        executionQuality: Math.round(executionQuality * 100),
        busyworkRatio: Math.round(busyworkRatio * 100),
        reviewHealth: { score: Math.round(reviewHealth * 100), oldestAge: Math.round(oldestReviewAgeDays), pendingCount: pendingReviews.length },
        flowRatio: Math.round(flowRatio * 100),
        createdCount: createdInPeriod.length,
        completedCount: closedInPeriod.length,
        projectMomentum,
        habitConsistency,
        workoutConsistency,
        tasksByPriority: {
            P1: completedTasks.filter(t => getNormP(t.priority) === 1).length,
            P2: completedTasks.filter(t => getNormP(t.priority) === 2).length,
            P3: completedTasks.filter(t => getNormP(t.priority) === 3).length,
            P4: completedTasks.filter(t => getNormP(t.priority) === 4).length,
        }
    };
};
