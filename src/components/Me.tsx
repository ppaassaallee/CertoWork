import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "motion/react";
import { 
  Power, 
  Brain, 
  Activity, 
  ChevronRight,
  TrendingUp,
  Dumbbell,
  Zap,
  Globe,
  Database,
  Link as LinkIcon,
  UserCircle,
  Target,
  Sparkles,
  Award,
  Compass
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePlatformCapabilities } from "../lib/capabilities";

export function Me() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  const { capabilities, loading } = usePlatformCapabilities();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "boldi_profiles", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      }
      setProfileLoading(false);
    }, (error) => {
      console.error("Failed to load user profile:", error);
      setProfileLoading(false);
    });
    return () => unsub();
  }, [user]);

  const connectedCount = capabilities ? Object.values(capabilities).filter((c: any) => c.configured).length : 0;
  const totalCount = capabilities ? Object.keys(capabilities).length : 0;
  const needsSetup = totalCount - connectedCount;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 max-w-2xl mx-auto space-y-6 pb-24"
    >
      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold">Me</h1>
        <p className="text-gray-500 text-sm mt-1">{user?.displayName || "Alejandro"}'s Personal Space</p>
      </header>

      {/* Discrete Platform Status Card */}
      <button 
        onClick={() => navigate('/settings/platform-health')}
        className="w-full bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Platform Status</h3>
            <p className="text-xs text-gray-500">
              {loading ? "Checking status..." : `${connectedCount} connected · ${needsSetup} needs setup`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
          View Health <ChevronRight className="w-4 h-4" />
        </div>
      </button>

      {/* Executive Strategic Profile Section */}
      {!profileLoading && (
        <section className="space-y-3 mt-4">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
            Strategic Profile
          </h2>
          {profile && profile.onboardingStep === "complete" ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Award className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-neutral-900">
                      {profile.assistantName || "Laura"}'s Client: {user?.displayName || "Alejandro"}
                    </h3>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                      Onboarding Verified
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
                      detail: { message: "Laura, show me my full profile.md summary." }
                    }));
                  }}
                  className="text-[10px] font-bold bg-neutral-50 hover:bg-neutral-100 text-neutral-600 px-2.5 py-1.5 rounded-lg border border-neutral-200/40 cursor-pointer"
                >
                  View full profile
                </button>
              </div>

              {/* 5-Year Ambition */}
              {profile.fiveYearAmbition && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                    <Compass className="w-3.5 h-3.5 text-neutral-400" />
                    <span>5-Year Ambition</span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-3 rounded-2xl border border-neutral-100 font-medium italic">
                    "{profile.fiveYearAmbition}"
                  </p>
                </div>
              )}

              {/* Annual Goals */}
              {profile.goals && profile.goals.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                    <Target className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Annual Objectives</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 pl-1">
                    {profile.goals.map((g: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-neutral-600 font-medium">
                        <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold flex items-center justify-center mt-0.5 shrink-0">
                          {idx + 1}
                        </span>
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Focus Areas & Non-Negotiables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100/60">
                {profile.dimensions && profile.dimensions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Active Life Focus Areas
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {profile.dimensions.map((d: string, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md capitalize"
                        >
                          {d.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.nonNegotiables && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Non-Negotiables
                    </span>
                    <p className="text-xs text-neutral-500 truncate" title={profile.nonNegotiables}>
                      {profile.nonNegotiables}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-3xl border border-amber-100/60 p-5 space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500 text-white rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900">
                    Unlock Gazelle Chief-of-Staff
                  </h3>
                  <p className="text-xs text-neutral-600/90 leading-relaxed mt-1">
                    You haven't completed your Gazelle onboarding yet. Start the 5-step setup with Laura to declare your Focus Areas, top 3 annual goals, non-negotiables, and struggles.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-boldi-assistant', {
                    detail: { message: "Laura, let's begin onboarding!" }
                  }));
                }}
                className="w-full bg-neutral-950 hover:bg-neutral-900 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-colors text-center cursor-pointer"
              >
                Begin 5-Step Strategic Onboarding
              </button>
            </div>
          )}
        </section>
      )}

      {/* Profile & Preferences */}
      <section className="space-y-3 mt-8">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Identity</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <button 
            onClick={() => navigate("/settings/boldi")}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 text-gray-600">
                <UserCircle className="w-4 h-4" />
              </div>
              <span className="font-medium text-gray-900">Profile & Preferences</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </section>

      {/* My Operating System */}
      <section className="space-y-3 mt-8">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">My Operating System</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <button onClick={() => navigate("/review/habits")} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
                <Zap className="w-4 h-4" />
              </div>
              <span className="font-medium text-gray-900">Habits</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
          <button onClick={() => navigate("/review/workouts")} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50 text-orange-600">
                <Dumbbell className="w-4 h-4" />
              </div>
              <span className="font-medium text-gray-900">Workouts</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
          <button onClick={() => navigate("/me/metrics")} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-500">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-medium text-gray-900">Health Metrics</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </section>

      {/* Self-Mastery */}
      <section className="space-y-3 mt-8">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Self-Mastery</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <button onClick={() => navigate("/me/self-mastery")} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600">
                <Brain className="w-4 h-4" />
              </div>
              <span className="font-medium text-gray-900">Self-Mastery Hub</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
          <button onClick={() => navigate("/me/analytics")} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="font-medium text-gray-900">Progress & Analytics</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </section>

      {/* Connected Accounts & Data */}
      <section className="space-y-3 mt-8">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">System</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <button onClick={() => navigate("/settings/integrations")} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
                <LinkIcon className="w-4 h-4" />
              </div>
              <span className="font-medium text-gray-950 block">Connected Accounts</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
          
          <button onClick={() => navigate("/settings/data")} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600">
                <Database className="w-4 h-4" />
              </div>
              <span className="font-medium text-gray-950 block">Data & Privacy</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>

          <button onClick={() => logOut()} className="w-full flex items-center justify-between p-4 bg-white hover:bg-red-50 text-red-600 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
                <Power className="w-4 h-4" />
              </div>
              <span className="font-medium text-red-600 block">Sign Out</span>
            </div>
          </button>
        </div>
      </section>
    </motion.div>
  );
}
