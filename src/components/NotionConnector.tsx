import { useNavigate } from "react-router-dom";
import { ChevronLeft, Database, AlertCircle } from "./ui/Icon";
import { motion } from "motion/react";

export function NotionConnector() {
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-black hover:bg-gray-50 transition-colors shadow-sm">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
           <h1 className="text-2xl font-bold font-sans">Notion Integration</h1>
           <p className="text-gray-500 text-sm mt-1">Connect your Notion workspace via MCP</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm text-center mb-8">
         <div className="w-20 h-20 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center mx-auto mb-6">
            <svg viewBox="0 0 100 100" className="w-10 h-10" fill="currentColor">
              <path d="M78.6,21.5c-1.8-1-5.7-0.9-10.2,1.6L24.3,48.5c-4.4,2.5-6.5,6.4-4.8,8.8c1.7,2.4,6.7,2.3,11.2-0.2L74.8,31  C79.2,28.5,80.4,22.5,78.6,21.5z"></path>
              <path d="M85.7,46.2c-0.2-2.9-2.9-6-7.3-8.6L44.8,18.1c-4.4-2.5-8.5-2.6-9.1-0.2c-0.6,2.4,2.6,6.3,7,8.9L76.3,46.2  C80.7,48.8,85.9,49.1,85.7,46.2z"></path>
              <path d="M47.7,85.2c1.8,1,5.6,0.8,10-1.7l44.4-25.5c4.4-2.5,6.5-6.4,4.7-8.8c-1.8-2.4-6.8-2.2-11.2,0.3L51.2,74.9  C46.8,77.5,45.9,84.2,47.7,85.2z"></path>
              <path d="M37.9,56.6c-4.4-2.5-8.5-2.6-9.1-0.2c-0.6,2.4,2.6,6.3,7,8.9l32.5,18.8c4.4,2.5,9.5,2.4,11.3-0.2c1.8-2.6-0.3-6.6-4.7-9.2  L37.9,56.6z"></path>
            </svg>
         </div>
         <h2 className="text-xl font-bold font-sans mb-2">Notion MCP / API Connector</h2>
         <p className="text-gray-500 max-w-sm mx-auto mb-6 text-sm">
           This integration allows Alejandro OS AI agents to consult your Notion pages, tables, and databases securely without duplicating data.
         </p>
         
         <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 px-4 py-2.5 rounded-xl text-sm font-bold w-fit mx-auto border border-amber-200">
           <AlertCircle className="w-4 h-4" />
           Notion connection is planned, but not connected yet.
         </div>
         
         <button disabled className="mt-8 px-6 py-3 bg-black text-white font-bold rounded-xl shadow-sm opacity-50 cursor-not-allowed w-full max-w-xs mx-auto">
           Connect Notion Workspace
         </button>
         <p className="mt-3 text-xs text-gray-400">Waiting for backend MCP implementation.</p>
      </div>

      <div className="space-y-4">
         <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 ml-2">Import Mappings (Placeholder)</h3>
         <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200 border-dashed text-center">
            <Database className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No Notion databases are currently mapped to the Knowledge Base.</p>
         </div>
      </div>
    </motion.div>
  );
}
