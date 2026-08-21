import { useUndo } from '../lib/UndoContext';
import { Undo2, Redo2 } from "./ui/Icon";
import { motion, AnimatePresence } from 'motion/react';

export function GlobalUndoRedo() {
  const { undo, redo, canUndo, canRedo } = useUndo();

  if (!canUndo && !canRedo) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-24 md:bottom-8 right-8 z-50 flex bg-white border border-gray-200 shadow-lg rounded-full overflow-hidden"
      >
        <button 
          onClick={undo}
          disabled={!canUndo}
          className="p-3 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white transition-colors"
          title="Undo (Cmd/Ctrl + Z)"
        >
          <Undo2 className="w-5 h-5" />
        </button>
        <div className="w-[1px] bg-gray-200 h-11" />
        <button 
          onClick={redo}
          disabled={!canRedo}
          className="p-3 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white transition-colors"
          title="Redo (Cmd/Ctrl + Shift + Z)"
        >
          <Redo2 className="w-5 h-5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
