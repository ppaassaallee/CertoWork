import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowLeft, HardHat } from "./ui/Icon";

export function ShellPage({ title, entityName }: { title: string, entityName: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 max-w-2xl mx-auto space-y-6 pb-24"
    >
      <header className="flex items-center gap-4 py-2">
        <Link to={title.includes('Context') || title.includes('Permission') || title.includes('Review') || title.includes('Scheduled') ? '/me' : '/work'} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <span className="text-gray-400 font-medium text-sm tracking-widest uppercase">{title}</span>
      </header>
      
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-3xl p-8 text-center mt-10">
        <HardHat className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">{title} is under construction</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
          The {title} module provides the foundation for your {entityName} capabilities. 
          This area will provide the necessary tools to track, edit, and create new ones.
        </p>
        <button disabled className="bg-black text-white px-6 py-3 rounded-xl font-medium opacity-50 cursor-not-allowed">
          Create Starter {entityName}
        </button>
      </div>
    </motion.div>
  );
}
