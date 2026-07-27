import { motion } from "motion/react";
import { ChevronRight, CheckSquare, Folders, HelpCircle, BrainCircuit, BookOpen, Users, Brain, MessageSquare, Briefcase } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { ClarityResetTrigger } from "./ClarityResetTrigger";

export function Work() {
  const { user, workspace } = useAuth();
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [stakeholderCount, setStakeholderCount] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !workspace) return;
    
    // Tasks logic
    const qTasks = query(collection(db, "tasks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("status", "==", "open"));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTaskCount(snapshot.size);
    }, (error) => console.error('Work Tasks error:', error.message));

    // Stakeholders logic
    const qStakeholders = query(collection(db, "stakeholders"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id));
    const unsubStakeholders = onSnapshot(qStakeholders, (snapshot) => {
      setStakeholderCount(snapshot.size);
    }, (error) => console.error('Work Stakeholders error:', error.message));

    return () => {
      unsubTasks();
      unsubStakeholders();
    };
  }, [user, workspace]);

  const sections = [
    { title: "Action Board", count: taskCount !== null ? `${taskCount} open tasks` : "Loading...", icon: CheckSquare, color: "text-indigo-600", bg: "bg-indigo-50", implemented: true, path: "/work/tasks" },
    { title: "Projects & Deals", count: "Portfolio control", icon: Folders, color: "text-purple-600", bg: "bg-purple-50", implemented: true, path: "/work/projects" },
    { title: "Agent Workspace", count: "Interactive multi-agent cockpit", icon: MessageSquare, color: "text-rose-600", bg: "bg-rose-50", implemented: true, path: "/work/warroom" },
    { title: "Stakeholders", count: stakeholderCount !== null ? `${stakeholderCount} active` : "Loading...", icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", implemented: true, path: "/work/stakeholders" },
    { title: "Playbooks", count: "Operational SOPs", icon: HelpCircle, color: "text-teal-600", bg: "bg-teal-50", implemented: true, path: "/capture/documents?tab=playbooks" },
    { title: "Knowledge Base", count: "Resource docs", icon: BookOpen, color: "text-orange-600", bg: "bg-orange-50", implemented: true, path: "/capture/documents?tab=documents" },
    { title: "Skills Library", count: "Custom competencies", icon: BrainCircuit, color: "text-amber-600", bg: "bg-amber-50", implemented: true, path: "/capture/documents?tab=skills" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-24"
    >
      {/* Horizontal Nav Chips on Mobile */}
      <div className="flex md:hidden gap-1 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none border-b border-b-gray-100">
        <button onClick={() => navigate("/work/tasks")} className="px-3 py-1.5 bg-black text-white rounded-full text-xs font-semibold whitespace-nowrap">Action Board</button>
        <button onClick={() => navigate("/work/projects")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Projects</button>
        <button onClick={() => navigate("/work")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Operations</button>
        <button onClick={() => navigate("/capture/documents")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Documents Hub</button>
        <button onClick={() => navigate("/work/warroom")} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold whitespace-nowrap">Agent Workspace</button>
      </div>

      <header className="flex justify-between items-center border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight flex items-center gap-2">
            <Briefcase className="w-8 h-8 text-black" /> Work
          </h1>
          <p className="text-gray-500 text-sm mt-1">Operational core, workflows, SOPs, and delivery cockpits.</p>
        </div>
        <button
           onClick={() => window.dispatchEvent(new CustomEvent('open-clarity-reset'))}
           className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm shrink-0"
           title="Start 10-Minute Mental Clarity Reset"
        >
           <Brain className="w-3.5 h-3.5 animate-pulse" />
           10-Min Reset
        </button>
      </header>

      <ClarityResetTrigger workspaceId={workspace?.id || ""} />

      {/* Grid of Work Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
        {sections.map((section) => (
          <button 
            key={section.title}
            disabled={!section.implemented}
            onClick={() => section.implemented && navigate(section.path!)}
            title={section.implemented ? "View " + section.title : "Not Implemented"}
            className={`flex items-center justify-between p-4 bg-white border border-gray-150 rounded-2xl transition-all text-left ${section.implemented ? 'hover:border-gray-300 hover:shadow-sm cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${section.bg}`}>
                <section.icon className={`w-5 h-5 ${section.color}`} />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">{section.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{section.count}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
