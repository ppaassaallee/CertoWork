import { useState, useEffect } from "react";
import { Brain, BellOff } from "lucide-react";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

interface ClarityResetTriggerProps {
  workspaceId: string;
}

export function ClarityResetTrigger({ workspaceId }: ClarityResetTriggerProps) {
  const { user } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    checkTriggers();
  }, [user, workspaceId]);

  const checkTriggers = async () => {
    if (!user) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Fetch preferences
      const qPref = query(collection(db, "daily_clarity_preferences"), where("userId", "==", user.uid));
      const prefSnap = await getDocs(qPref);
      
      let prefData: any = null;
      if (prefSnap.empty) {
        // If no preference yet, show invite by default
        prefData = {
          userId: user.uid,
          autoShowEnabled: true,
          skippedDates: [],
          remindLaterDate: null
        };
      } else {
        prefData = prefSnap.docs[0].data();
        prefData.id = prefSnap.docs[0].id;
      }
      setPreferences(prefData);

      // Check autoShowEnabled
      if (prefData.autoShowEnabled === false) {
        setShowInvite(false);
        setLoading(false);
        return;
      }

      // Check skipped today
      const skippedArr = prefData.skippedDates || [];
      if (skippedArr.includes(todayStr)) {
        setShowInvite(false);
        setLoading(false);
        return;
      }

      // Check Remind Later time
      if (prefData.remindLaterDate) {
        const remindTime = new Date(prefData.remindLaterDate).getTime();
        const now = Date.now();
        if (now < remindTime) {
          // Hasn't expired yet
          setShowInvite(false);
          setLoading(false);
          return;
        }
      }

      // 2. Check if a completed reset session exists for today
      const qSession = query(
        collection(db, "mental_clarity_sessions"),
        where("userId", "==", user.uid),
        where("status", "==", "completed")
      );
      const sessionSnap = await getDocs(qSession);
      const completedToday = sessionSnap.docs.some(docSnap => {
        const d = docSnap.data();
        if (!d.completedAt) return false;
        
        let compDateStr = "";
        if (d.completedAt?.toDate) {
          compDateStr = d.completedAt.toDate().toISOString().split('T')[0];
        } else {
          compDateStr = new Date(d.completedAt).toISOString().split('T')[0];
        }
        return compDateStr === todayStr;
      });

      if (completedToday) {
        setShowInvite(false);
      } else {
        setShowInvite(true);
      }

    } catch (e) {
      console.error("Error evaluating clarity reset trigger conditions:", e);
    } finally {
      setLoading(false);
    }
  };

  const startReset = () => {
    setShowInvite(false);
    window.dispatchEvent(new CustomEvent('open-clarity-reset'));
  };

  const skipToday = async () => {
    if (!user || !preferences?.id) {
      setShowInvite(false);
      return;
    }
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const skipped = preferences.skippedDates || [];
      if (!skipped.includes(todayStr)) {
        skipped.push(todayStr);
      }
      await updateDoc(doc(db, "daily_clarity_preferences", preferences.id), {
        skippedDates: skipped,
        updatedAt: serverTimestamp()
      });
      setShowInvite(false);
    } catch (e) {
      console.error(e);
      setShowInvite(false);
    }
  };

  const remindLater = async () => {
    if (!user || !preferences?.id) {
      setShowInvite(false);
      return;
    }
    try {
      const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await updateDoc(doc(db, "daily_clarity_preferences", preferences.id), {
        remindLaterDate: oneHourLater,
        updatedAt: serverTimestamp()
      });
      setShowInvite(false);
    } catch (e) {
      console.error(e);
      setShowInvite(false);
    }
  };

  const dontShowAutomatically = async () => {
    if (!user || !preferences?.id) {
      setShowInvite(false);
      return;
    }
    try {
      await updateDoc(doc(db, "daily_clarity_preferences", preferences.id), {
        autoShowEnabled: false,
        updatedAt: serverTimestamp()
      });
      setShowInvite(false);
    } catch (e) {
      console.error(e);
      setShowInvite(false);
    }
  };

  if (loading || !showInvite) return null;

  return (
    <div className="bg-amber-50/70 border border-amber-200/60 rounded-3xl p-5 mb-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all animate-fade-in">
      <div className="flex items-center gap-3.5">
        <div className="p-3 bg-amber-500/10 text-amber-700 rounded-2xl">
          <Brain className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-neutral-800">Should we reorganize your mind today?</h3>
          <p className="text-xs text-neutral-500">Start your day with a 10-minute Clarity Reset (Pending, Decisions, Ideas, and Let Go).</p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 shrink-0">
        <button 
          onClick={startReset}
          className="bg-black hover:bg-neutral-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          Start Reset
        </button>
        <button 
          onClick={skipToday}
          className="bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all"
        >
          Skip today
        </button>
        <button 
          onClick={remindLater}
          className="bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all"
        >
          Later
        </button>
        <button 
          onClick={dontShowAutomatically}
          className="text-neutral-400 hover:text-neutral-600 font-bold text-xs px-2 py-2 flex items-center gap-1 transition-all"
          title="Don't show automatically"
        >
          <BellOff className="w-3.5 h-3.5" /> Don't show auto
        </button>
      </div>
    </div>
  );
}
