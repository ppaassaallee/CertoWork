import { motion } from "motion/react";
import { Workflow, Folder, Calendar, Cloud, Mic, MessageSquare, ChevronRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlatformCapabilities } from "../../lib/capabilities";

export function Integrations() {
  const navigate = useNavigate();
  const { capabilities, loading } = usePlatformCapabilities();
  const voiceAvailable =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const integrationsList = [
    {
      title: "Google Workspace",
      description: "Docs, Sheets, Drive",
      icon: Cloud,
      connected: capabilities?.googleDrive.configured,
      path: null
    },
    {
      title: "Notion",
      description: "Pages & Databases",
      icon: Folder,
      connected: false,
      path: "/settings/integrations/notion",
      planned: true
    },
    {
      title: "HubSpot / CRM",
      description: "Webhook ingestion",
      icon: Workflow,
      connected: capabilities?.hubspot.configured,
      path: null
    },
    {
      title: "Calendar",
      description: "Gazelle calendar records",
      icon: Calendar,
      connected: true,
      path: "/today/agenda",
      internal: true
    },
    {
      title: "Voice / STT",
      description: "On-device browser speech capture",
      icon: Mic,
      connected: voiceAvailable,
      path: "/boldi",
      internal: true
    },
    {
      title: "Email / SMS",
      description: "External delivery",
      icon: MessageSquare,
      connected: false,
      path: null
    }
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
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-gray-500 text-sm mt-1">Connect third-party apps and services.</p>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {integrationsList.map((item) => (
          <button 
            key={item.title} 
            onClick={() => item.path && navigate(item.path)} 
            className={`w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors ${!item.path ? "cursor-default hover:bg-white" : ""}`}
          >
            <div className="flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-50 border border-gray-100`}>
                <item.icon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <span className="font-medium text-gray-900 block">{item.title}</span>
                <span className="text-xs text-gray-500 block">{item.description}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                loading
                  ? "text-gray-500 bg-gray-100"
                  : item.connected
                    ? "text-emerald-600 bg-emerald-50"
                    : item.planned
                      ? "text-amber-600 bg-amber-50"
                      : "text-gray-500 bg-gray-100"
              }`}>
                {loading
                  ? "Checking"
                  : item.connected
                    ? item.internal
                      ? "Available"
                      : "Configured"
                    : item.planned
                      ? "Planned"
                      : "Not connected"}
              </span>
              {item.path && <ChevronRight className="w-4 h-4 text-gray-300" />}
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
