
import { collection, query, where, doc, updateDoc, addDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase";
import { WorkoutPlan } from "../types";

export const getFitnessProfileQuery = (userId: string, workspaceId: string) => {
  return query(
    collection(db, "fitness_profiles"),
    where("userId", "==", userId),
    where("workspaceId", "==", workspaceId),
    limit(1)
  );
};

export const getWorkoutPlansQuery = (userId: string, workspaceId: string) => {
    return query(
        collection(db, "workout_plans"),
        where("userId", "==", userId),
        where("workspaceId", "==", workspaceId)
    );
};

export const getTodayWorkoutQuery = (userId: string, workspaceId: string, date: string) => {
  return query(
    collection(db, "workout_sessions"),
    where("userId", "==", userId),
    where("workspaceId", "==", workspaceId),
    where("date", "==", date)
  );
};

export const getWeeklyWorkoutsQuery = (userId: string, workspaceId: string, start: string, end: string) => {
    return query(
        collection(db, "workout_sessions"),
        where("userId", "==", userId),
        where("workspaceId", "==", workspaceId),
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "asc")
    );
};

// This would be triggered by AI service but we implement the logic to create records
export const createWorkoutSessionsFromPlan = async (_userId: string, _workspaceId: string, _planId: string, _plan: WorkoutPlan) => {
    // Logic to expand weeklyStructure into 4 weeks of sessions
    // ...
};

export const logWorkout = async (userId: string, workspaceId: string, sessionId: string, status: 'completed' | 'skipped' | 'partial', duration: number, effort: number) => {
    const sessionRef = doc(db, "workout_sessions", sessionId);
    await updateDoc(sessionRef, { status, updatedAt: serverTimestamp() });
    
    await addDoc(collection(db, "workout_logs"), {
        userId,
        workspaceId,
        workoutSessionId: sessionId,
        date: new Date().toISOString().split('T')[0],
        status,
        durationMinutes: duration,
        perceivedEffort: effort,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};
