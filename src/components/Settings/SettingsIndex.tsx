import { motion } from "motion/react";
import { Users, Link as LinkIcon, Shield, Activity, Database, Zap, ChevronRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TextSizeControl } from "../TextSizeControl";

export function SettingsIndex() {
  const navigate = useNavigate();

  const settingsNav = [
    { title: "Workspace Settings", description: "Manage members, roles, and name", icon: Users, path: "/settings/workspace", color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Integrations", description: "Google Workspace, Notion, CRM", icon: LinkIcon, path: "/settings/integrations", color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Certo Work Settings", description: "AI context, models, and permissions", icon: Shield, path: "/settings/boldi", color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Platform Health", description: "System diagnostics and capabilities", icon: Activity, path: "/settings/platform-health", color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Data Management", description: "Export, backups, and integrity", icon: Database, path: "/settings/data", color: "text-slate-600", bg: "bg-slate-50" },
    { title: "Setup & Initialization", description: "Starter templates and reset", icon: Zap, path: "/settings/setup", color: "text-amber-600", bg: "bg-amber-50" }
  ];

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
          <h1 className="text-2xl font-bold">Settings & Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Manage workspace, architecture, and platform configuration.</p>
        </div>
      </header>

      <section className="do-settings-appearance">
        <div>
          <span>Appearance</span>
          <h2>Text size</h2>
          <p>Choose how dense or readable Certo Work feels on this device.</p>
        </div>
        <TextSizeControl />
      </section>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {settingsNav.map((item) => (
          <button key={item.title} onClick={() => navigate(item.path)} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <span className="font-medium text-gray-900 block">{item.title}</span>
                <span className="text-xs text-gray-500 block">{item.description}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
