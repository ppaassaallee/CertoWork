import { motion } from "motion/react";
import { Sparkles, Database, Folder, Workflow, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { usePlatformCapabilities } from "../../lib/capabilities";
import { useNavigate } from "react-router-dom";

export function PlatformHealth() {
  const { capabilities, loading } = usePlatformCapabilities();
  const navigate = useNavigate();

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
          <h1 className="text-2xl font-bold">Platform Health</h1>
          <p className="text-gray-500 text-sm mt-1">Check system capabilities, integrations, and configuration status.</p>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-sm space-y-4">
        {loading ? (
          <div className="text-xs text-gray-400 flex items-center gap-1.5 justify-center py-4">
            <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-black animate-spin" />
            Checking capabilities...
          </div>
        ) : capabilities ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Database */}
            <div className="border border-gray-150 p-3.5 rounded-2xl flex items-start gap-3 bg-neutral-50/50">
              <div className={`p-2 rounded-xl flex-shrink-0 ${capabilities.firebase.configured ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                <Database className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-xs font-bold text-gray-900">Database</span>
                  {capabilities.firebase.configured ? (
                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <XCircle className="w-2.5 h-2.5" /> Missing
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                  {capabilities.firebase.description.replace("Durable cloud database", "Durable database")}
                </p>
              </div>
            </div>

            {/* File Storage */}
            <div className="border border-gray-150 p-3.5 rounded-2xl flex items-start gap-3 bg-neutral-50/50">
              <div className={`p-2 rounded-xl flex-shrink-0 ${capabilities.firebase.configured ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                <Folder className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-xs font-bold text-gray-900">File Storage</span>
                  {capabilities.firebase.configured ? (
                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <XCircle className="w-2.5 h-2.5" /> Missing
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                  Cloud storage for assets and files.
                </p>
              </div>
            </div>

            {/* AI */}
            <div className="border border-gray-150 p-3.5 rounded-2xl flex items-start gap-3 bg-neutral-50/50">
              <div className={`p-2 rounded-xl flex-shrink-0 ${capabilities.activeAIProvider.configured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-xs font-bold text-gray-900">AI Status</span>
                  {capabilities.activeAIProvider.configured ? (
                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <XCircle className="w-2.5 h-2.5" /> Offline-safe
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                  {capabilities.activeAIProvider.description}
                </p>
              </div>
            </div>

            {/* Google Workspace */}
            <div className="border border-gray-150 p-3.5 rounded-2xl flex items-start gap-3 bg-neutral-50/50">
              <div className={`p-2 rounded-xl flex-shrink-0 ${capabilities.googleDrive.configured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                <Folder className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-xs font-bold text-gray-900">Google Workspace</span>
                  {capabilities.googleDrive.configured ? (
                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Configured
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <XCircle className="w-2.5 h-2.5" /> Optional
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                  {capabilities.googleDrive.description}
                </p>
              </div>
            </div>

            {/* CRM */}
            <div className="border border-gray-150 p-3.5 rounded-2xl flex items-start gap-3 bg-neutral-50/50">
              <div className={`p-2 rounded-xl flex-shrink-0 ${capabilities.hubspot.configured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                <Workflow className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-xs font-bold text-gray-900">CRM Webhook</span>
                  {capabilities.hubspot.configured ? (
                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Configured
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <XCircle className="w-2.5 h-2.5" /> Optional
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                  {capabilities.hubspot.description}
                </p>
              </div>
            </div>
            
            {/* Notion */}
            <div className="border border-gray-150 p-3.5 rounded-2xl flex items-start gap-3 bg-neutral-50/50">
              <div className="p-2 rounded-xl flex-shrink-0 bg-amber-50 text-amber-600">
                <Folder className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-xs font-bold text-gray-900">Notion</span>
                  <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <XCircle className="w-2.5 h-2.5" /> Not Connected
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                  Read and sync workspace content.
                </p>
              </div>
            </div>

          </div>
        ) : (
          <div className="text-xs text-red-500">Failed to load platform capabilities status.</div>
        )}
      </div>
    </motion.div>
  );
}
