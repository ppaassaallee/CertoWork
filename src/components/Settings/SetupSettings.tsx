import { useState } from "react";
import { motion } from "motion/react";
import { Zap, ArrowLeft } from "../ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useNavigate } from "react-router-dom";

export function SetupSettings() {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateStarterSystem = async () => {
    if (!user || !workspace) return;
    setIsCreating(true);
    try {
      await addDoc(collection(db, "playbooks"), {
         userId: user.uid,
         workspaceId: workspace.id,
         title: "Inbox Triage Playbook",
         slug: "inbox-triage",
         description: "Processes raw inbox items into review candidates.",
         status: "active",
         triggerType: "manual",
         steps: ["Read inbox", "Ask the configured AI provider to categorize", "Output candidates"],
         version: "1.0",
         createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "skills"), {
         userId: user.uid,
         workspaceId: workspace.id,
         title: "Information Extraction",
         slug: "info-extraction",
         category: "Processing",
         description: "Extracts action items and context from unstructured text.",
         whenToUse: "When processing notes or capture items.",
         version: "1.0",
         status: "active",
         createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "system_context"), {
         userId: user.uid,
         workspaceId: workspace.id,
         title: "Alejandro's Core Rules",
         content: "1. Always output actionable tasks. 2. Ask before deleting large amounts of data.",
         createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "tool_permissions"), {
         userId: user.uid,
         workspaceId: workspace.id,
         title: "Gmail Automation",
         content: "Can read. Can draft. Cannot send without explicit approval.",
         createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "scheduled_tasks"), {
         userId: user.uid,
         workspaceId: workspace.id,
         title: "Daily Shutdown",
         content: "Runs every day at 18:00 to clear the inbox.",
         createdAt: serverTimestamp()
      });

      alert("Starter system created successfully!");
    } catch(e) {
      console.error(e);
      alert("Failed to create starter system.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateStarterContext = async () => {
    if (!user || !workspace) return;
    if (!confirm("Are you sure you want to load the starter system context?")) return;
    
    setIsCreating(true);
    try {
      const contexts = [
        { title: "About Alejandro", type: "system_rule", content: "Alejandro is the CEO of Boldr. He values asynchronous communication, clear ownership, and measurable outcomes. He prefers short, concise updates over long narratives. He reads on Notion and Slack." },
        { title: "Delegation Rules", type: "system_rule", content: "When delegating tasks, ensure there is a clear Definition of Done, a specific owner (only one), and a mutually agreed due date." },
        { title: "Meeting Rules", type: "system_rule", content: "No meeting without an agenda. Meetings should end 5 minutes early. Always capture decisions and next steps in the central system." }
      ];

      for (const item of contexts) {
        await addDoc(collection(db, "knowledge_items"), {
          userId: user.uid,
          workspaceId: workspace.id,
          title: item.title,
          type: item.type,
          summary: "System generated starter context",
          body: item.content,
          aiReadable: true,
          aiUsageScope: "all",
          sensitivity: "internal",
          status: "active",
          createdAt: serverTimestamp()
        });
      }
      alert("Starter system context created in Knowledge Base.");
    } catch (e) {
      console.error(e);
      alert("Failed to create starter context.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 max-w-2xl mx-auto space-y-6 pb-24"
    >
      <header className="mb-6 mt-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Setup & Initialization</h1>
          <p className="text-gray-500 text-sm mt-1">Configure starter templates and system rules.</p>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        <button 
          disabled={isCreating}
          onClick={handleCreateStarterSystem} 
          className="w-full flex items-center px-4 py-4 hover:bg-gray-50 transition-colors disabled:opacity-50 text-left gap-3"
        >
           <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
              <Zap className="w-4 h-4 text-gray-600" />
           </div>
           <div className="flex-1">
             <span className="font-medium block text-gray-900">Create Starter System</span>
             <span className="text-xs text-gray-500 block">Initializes playbooks, skills, and permissions</span>
           </div>
        </button>
        
        <button 
          disabled={isCreating}
          onClick={handleCreateStarterContext} 
          className="w-full flex items-center px-4 py-4 hover:bg-gray-50 transition-colors disabled:opacity-50 text-left gap-3"
        >
           <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
              <Zap className="w-4 h-4 text-gray-600" />
           </div>
           <div className="flex-1">
             <span className="font-medium block text-gray-900">Create Starter System Context</span>
             <span className="text-xs text-gray-500 block">Initializes system rules and contexts in Knowledge Base</span>
           </div>
        </button>
      </div>
    </motion.div>
  );
}
