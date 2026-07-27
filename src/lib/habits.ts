
import { collection, query, where, doc, addDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Habit } from "../types";

export const getHabitsQuery = (userId: string, workspaceId: string) => {
  return query(
    collection(db, "habits"),
    where("userId", "==", userId),
    where("workspaceId", "==", workspaceId)
  );
};

export const getHabitLogsQuery = (userId: string, workspaceId: string, date: string) => {
  return query(
    collection(db, "habit_logs"),
    where("userId", "==", userId),
    where("workspaceId", "==", workspaceId),
    where("date", "==", date)
  );
};

export const logHabit = async (userId: string, workspaceId: string, habitId: string, date: string, status: 'done' | 'skipped' | 'partial') => {
  const logId = `${habitId}_${date}`;
  const logRef = doc(db, "habit_logs", logId);
  
  await setDoc(logRef, {
    userId,
    workspaceId,
    habitId,
    date,
    status,
    completedAt: status === 'done' ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const deleteHabitLog = async (habitId: string, date: string) => {
  const logId = `${habitId}_${date}`;
  const logRef = doc(db, "habit_logs", logId);
  await deleteDoc(logRef);
};

export interface StarterHabitDefinition {
  title: string;
  description: string;
  type: Habit['type'];
  cadenceType: Habit['cadenceType'];
  daysOfWeek?: number[];
  minimumVersion: string;
  idealVersion: string;
  identityStatement: string;
  color: string;
  icon: string;
}

export const STARTER_HABITS_LIST: StarterHabitDefinition[] = [
  {
    title: "Wake up at target time",
    description: "Rise at your targeted wake-up time to win the morning.",
    type: "personal",
    cadenceType: "daily",
    minimumVersion: "Out of bed by target hour",
    idealVersion: "Wake up without snooze, do morning ritual",
    identityStatement: "I am a disciplined morning person.",
    color: "#f59e0b", // Yellow/Amber
    icon: "Sunrise"
  },
  {
    title: "Drink water",
    description: "Stay fully hydrated throughout the day.",
    type: "health",
    cadenceType: "daily",
    minimumVersion: "Drink 1 glass (250ml) in the morning",
    idealVersion: "Drink 3 liters of water before shutdown",
    identityStatement: "I am someone who values high physical energy and vitality.",
    color: "#0ea5e9", // Sky
    icon: "Droplets"
  },
  {
    title: "Read 10 pages",
    description: "Incremental continuous learning and focus expansion.",
    type: "learning",
    cadenceType: "daily",
    minimumVersion: "Read 1 page of a non-fiction book",
    idealVersion: "Read 15 minutes or 10 complete pages",
    identityStatement: "I am an avid lifelong reader and thinker.",
    color: "#a855f7", // Purple
    icon: "BookOpen"
  },
  {
    title: "Eat fruit / protein",
    description: "Prioritize nutrient-dense whole foods and muscle recovery.",
    type: "health",
    cadenceType: "daily",
    minimumVersion: "Add one serving of clean protein to breakfast",
    idealVersion: "Maintain targeted macros, high protein intake",
    identityStatement: "I feed my body exactly what it needs to perform.",
    color: "#10b981", // Emerald
    icon: "Apple"
  },
  {
    title: "No smoking / no alcohol / no sugar",
    description: "Avoid toxic triggers and stay clear-headed.",
    type: "recovery",
    cadenceType: "daily",
    minimumVersion: "Zero added refined sugar today",
    idealVersion: "No alcohol, no tobacco/nicotine, completely clean",
    identityStatement: "I protect my brain chemistry and physical health.",
    color: "#f43f5e", // Rose
    icon: "Ban"
  },
  {
    title: "Training / workout",
    description: "Strenuous physical challenge and conditioning.",
    type: "fitness",
    cadenceType: "weekly",
    daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    minimumVersion: "10 minute bodyweight warm-up or stretch",
    idealVersion: "Full 45-60 minute structured workout session",
    identityStatement: "I build strength, endurance, and longevity.",
    color: "#ea580c", // Orange
    icon: "Dumbbell"
  },
  {
    title: "Walking",
    description: "Active recovery and mental clarity in motion.",
    type: "health",
    cadenceType: "daily",
    minimumVersion: "Walk outside for 5 minutes",
    idealVersion: "Hit 10,000 steps or 30 minutes in nature",
    identityStatement: "I design space for motion and quiet contemplation.",
    color: "#06b6d4", // Cyan
    icon: "Footprints"
  },
  {
    title: "Sleep by target time",
    description: "Protect winddown window and recovery cycles.",
    type: "recovery",
    cadenceType: "daily",
    minimumVersion: "In bed with screens off by target hour",
    idealVersion: "Full 8-hour sleep tracking, deep winddown ritual",
    identityStatement: "I understand that recovery is the fuel of execution.",
    color: "#6366f1", // Indigo
    icon: "Moon"
  },
  {
    title: "Daily shutdown",
    description: "Close out the day, clear inbox, and plan tomorrow's 2+8.",
    type: "system",
    cadenceType: "workdays",
    minimumVersion: "Write down 2 Must Dos for tomorrow",
    idealVersion: "Zero inbox, shutdown system review, lock workspace",
    identityStatement: "I end my day with complete closure and plan with precision.",
    color: "#475569", // Slate
    icon: "CheckSquare"
  },
  {
    title: "Weekly review",
    description: "Full review of project backlog, inbox triage, and Perfect Week blueprint.",
    type: "system",
    cadenceType: "weekly",
    daysOfWeek: [5], // Friday
    minimumVersion: "15 minute lookahead calendar inspection",
    idealVersion: "Full COD weekly audit and Perfect Week blueprint setup",
    identityStatement: "I operate as a master designer of my time.",
    color: "#1e293b", // Deep Slate
    icon: "CalendarRange"
  },
  {
    title: "Family block",
    description: "Undivided, distraction-free quality time with loved ones.",
    type: "family",
    cadenceType: "weekly",
    daysOfWeek: [6, 0], // Saturday, Sunday
    minimumVersion: "One phone-free conversation with family",
    idealVersion: "Dedicated shared activity, completely disconnected from work",
    identityStatement: "I protect the relationships that support my existence.",
    color: "#ec4899", // Pink
    icon: "Heart"
  },
  {
    title: "Knowledge capture",
    description: "Collect insights, highlights, books or tools.",
    type: "learning",
    cadenceType: "daily",
    minimumVersion: "Capture one task or learning item",
    idealVersion: "Triaged notes, continuous capture log sync",
    identityStatement: "I turn daily noise into structured leverage.",
    color: "#eab308", // Golden
    icon: "Database"
  }
];

export const createStarterHabits = async (
  userId: string, 
  workspaceId: string, 
  selectedHabits: StarterHabitDefinition[] = STARTER_HABITS_LIST
) => {
  const startDateStr = new Date().toISOString().split('T')[0];

  for (const h of selectedHabits) {
    const habitData: Omit<Habit, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      workspaceId,
      title: h.title,
      description: h.description,
      type: h.type,
      status: "active",
      cadenceType: h.cadenceType,
      daysOfWeek: h.daysOfWeek || null,
      startDate: startDateStr,
      minimumVersion: h.minimumVersion,
      idealVersion: h.idealVersion,
      identityStatement: h.identityStatement,
      color: h.color,
      icon: h.icon,
      priority: 2,
      calendarVisible: true,
      createdBy: userId,
    } as any;

    await addDoc(collection(db, "habits"), {
      ...habitData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
};
