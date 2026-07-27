import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { CheckSquare, ArrowLeft, Inbox, Calendar, Activity, Power, Brain } from "lucide-react";

export function DailyShutdown() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 max-w-2xl mx-auto space-y-6 pb-24"
    >
      <header className="mb-6 mt-4 flex items-center gap-3">
        <Link to="/" className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Daily Shutdown</h1>
          <p className="text-gray-500 text-sm mt-1">Close out your day</p>
        </div>
      </header>

      <section className="space-y-4">
        {/* Mental Clarity Reset */}
        <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-5 flex items-center gap-4">
           <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
             <Brain className="w-5 h-5 text-amber-600 animate-pulse" />
           </div>
           <div className="flex-1 text-left">
             <h3 className="font-semibold text-neutral-900">Mental Clarity Reset</h3>
             <p className="text-xs text-neutral-500">Unload and let go of remaining mental loops</p>
           </div>
           <button 
             onClick={() => window.dispatchEvent(new CustomEvent('open-clarity-reset'))}
             className="bg-amber-500 text-black font-extrabold px-3 py-1.5 rounded-lg text-sm hover:bg-amber-600 cursor-pointer transition-colors"
           >
             Start Reset
           </button>
        </div>

        {/* Captures */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
           <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
             <Inbox className="w-5 h-5 text-blue-600" />
           </div>
           <div className="flex-1 text-left">
             <h3 className="font-semibold text-gray-900">Process Captures</h3>
             <p className="text-xs text-gray-500">Structured by AI</p>
           </div>
           <Link to="/" className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200">Go to Today</Link>
        </div>

        {/* Review */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
           <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
             <CheckSquare className="w-5 h-5 text-amber-600" />
           </div>
           <div className="flex-1 text-left">
             <h3 className="font-semibold text-gray-900">Clear Review Queue</h3>
             <p className="text-xs text-gray-500">Approve AI candidates</p>
           </div>
           <Link to="/review" className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200">Review</Link>
        </div>

        {/* Tomorrow */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 opacity-50 cursor-not-allowed">
           <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
             <Calendar className="w-5 h-5 text-indigo-600" />
           </div>
           <div className="flex-1 text-left">
             <h3 className="font-semibold text-gray-900">Plan Tomorrow</h3>
             <p className="text-xs text-gray-500">Pick ONE Thing</p>
           </div>
           <button disabled className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium">Pending Data</button>
        </div>

        {/* Health */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 opacity-50 cursor-not-allowed">
           <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
             <Activity className="w-5 h-5 text-red-600" />
           </div>
           <div className="flex-1 text-left">
             <h3 className="font-semibold text-gray-900">Health Minimums</h3>
             <p className="text-xs text-gray-500">Check off health goals</p>
           </div>
           <button disabled className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium">Pending Data</button>
        </div>
      </section>

      <button className="w-full text-white bg-black rounded-2xl py-4 font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
        <Power className="w-4 h-4" /> Shutdown Complete
      </button>

    </motion.div>
  );
}
