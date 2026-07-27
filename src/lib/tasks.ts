import { doc, runTransaction, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "./firebase";
import { getNextOccurrence } from "./recurrence-utils";
import { Task } from "../types";

export async function setTaskStatus(task: any, newStatus: string) {
  if (!task.id) return;
  if (task.status === newStatus) return;

  // If completing a Routine Task, use the specialized transaction
  if (newStatus === "done" && (task.isRoutineTask || task.recurrence)) {
    return completeRecurringTask(task.id);
  }

  // Regular task completion/reopening
  await updateDoc(doc(db, "tasks", task.id), {
    status: newStatus,
    completedAt: newStatus === "done" ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp()
  });
}

// Helper to handle completion with transactions to ensure idempotency and next occurrence creation
export async function completeRecurringTask(taskId: string) {
  return runTransaction(db, async (transaction) => {
    const taskRef = doc(db, "tasks", taskId);
    const taskSnap = await transaction.get(taskRef);
    
    if (!taskSnap.exists()) throw new Error("Task does not exist");
    const task = { id: taskSnap.id, ...taskSnap.data() } as Task;
    
    // Idempotency: skip if already done
    if (task.status === 'done') return;

    // 1. Mark current task completed
    transaction.update(taskRef, {
      status: 'done',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2. Determine if we should create a next occurrence
    // We support both the old "recurrence" string and the new Routine Task structure
    const isRoutine = !!task.isRoutineTask;
    const recurrenceStatus = task.recurrenceStatus || 'active';
    
    if (isRoutine && recurrenceStatus !== 'active') return;
    if (!isRoutine && !task.recurrence) return;

    // 3. Compute Next Occurrence Date N
    let N: string | null = null;
    
    if (isRoutine) {
      N = getNextOccurrence(
        task.recurrenceAnchorDate || (task.createdAt?.toDate ? task.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        task.occurrenceDate || task.dueDate || null,
        new Date(), // completion date
        {
          type: task.recurrenceType || 'none',
          interval: task.recurrenceInterval || 1,
          unit: task.recurrenceUnit || 'days'
        }
      );
    } else if (task.recurrence) {
      // Legacy support for basic recurrence string
      N = calculateNextDateLegacy(task.recurrence, task.dueDate || null);
    }

    if (!N) return;

    // 4. Duplicate prevention using deterministic ID: routine_{seriesId}_{N}
    const seriesId = task.recurringSeriesId || task.id; // use original ID if no seriesId
    const nextTaskId = `routine_${seriesId}_${N}`;
    const nextTaskRef = doc(db, "tasks", nextTaskId);
    const nextTaskSnap = await transaction.get(nextTaskRef);
    
    if (nextTaskSnap.exists()) {
       transaction.update(taskRef, { nextOccurrenceAt: N });
       return;
    }

    // 5. Create next task occurrence
    const newTaskData: any = {
      userId: task.userId,
      workspaceId: task.workspaceId,
      title: task.title,
      description: task.description || "",
      status: "open",
      itemType: task.itemType || "task",
      categoryId: task.categoryId || null,
      categoryIds: task.categoryIds || [],
      stakeholderIds: task.stakeholderIds || [],
      projectId: task.projectId || null,
      parentId: task.parentId || null,
      milestoneId: task.milestoneId || null,
      stageId: task.stageId || "capture",
      globalStageId: task.globalStageId || "next",
      priority: task.priority !== undefined ? task.priority : null,
      occurrenceDate: N,
      dueDate: N,
      isOneThing: false,
      completedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: task.createdBy,
      
      // Inherit/Setup Routine Fields
      isRoutineTask: true,
      recurrenceType: task.recurrenceType || 'daily',
      recurrenceInterval: task.recurrenceInterval || 1,
      recurrenceUnit: task.recurrenceUnit || 'days',
      recurrenceAnchorDate: task.recurrenceAnchorDate || (task.createdAt?.toDate ? task.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      recurrenceStatus: 'active',
      recurringSeriesId: seriesId,
      previousOccurrenceId: task.id,
      createdFromOccurrenceId: task.id
    };

    if (task.recurrence) newTaskData.recurrence = task.recurrence;

    transaction.set(nextTaskRef, newTaskData);
    
    // 6. Update current task with next occurrence info
    transaction.update(taskRef, { nextOccurrenceAt: N });
  });
}

function calculateNextDateLegacy(recurrence: string, currentDateStr: string | null): string | null {
  if (!recurrence) return null;
  const lower = recurrence.toLowerCase().trim();
  const baseDate = currentDateStr ? new Date(currentDateStr + 'T00:00:00') : new Date();
  if (isNaN(baseDate.getTime())) return null;

  const customMatch = lower.match(/^(?:every\s+)?(\d+)\s+(day|week|month|year)s?/i);
  if (customMatch) {
    const amount = parseInt(customMatch[1], 10);
    const unit = customMatch[2];
    if (unit === 'day') baseDate.setDate(baseDate.getDate() + amount);
    else if (unit === 'week') baseDate.setDate(baseDate.getDate() + (amount * 7));
    else if (unit === 'month') baseDate.setMonth(baseDate.getMonth() + amount);
    else if (unit === 'year') baseDate.setFullYear(baseDate.getFullYear() + amount);
  } else if (lower.includes('daily') || lower === 'day') baseDate.setDate(baseDate.getDate() + 1);
  else if (lower.includes('biweekly') || lower.includes('bi-weekly')) baseDate.setDate(baseDate.getDate() + 14);
  else if (lower.includes('weekly') || lower.includes('week')) baseDate.setDate(baseDate.getDate() + 7);
  else if (lower.includes('monthly') || lower.includes('month')) baseDate.setMonth(baseDate.getMonth() + 1);
  else if (lower.includes('yearly') || lower.includes('year')) baseDate.setFullYear(baseDate.getFullYear() + 1);
  else if (lower.includes('weekday')) {
    do { baseDate.setDate(baseDate.getDate() + 1); } while (baseDate.getDay() === 0 || baseDate.getDay() === 6);
  } else baseDate.setDate(baseDate.getDate() + 7);

  return baseDate.toISOString().split('T')[0];
}

export async function toggleTaskStatus(task: any) {
  if (!task.id) return;
  const newStatus = task.status === "done" ? "open" : "done";
  return setTaskStatus(task, newStatus);
}

// Helper needed since it was used in previous code
async function updateDoc(ref: any, data: any) {
  const { updateDoc: fbUpdateDoc } = await import("firebase/firestore");
  return fbUpdateDoc(ref, data);
}
