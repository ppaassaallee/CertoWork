import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export interface UndoAction {
  id: string;
  description: string;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

interface UndoContextType {
  pushAction: (action: UndoAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  history: UndoAction[];
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export function UndoProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<UndoAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const pushAction = useCallback((action: UndoAction) => {
    setHistory((prev) => {
      // If we are not at the end of the history, we branch off and lose the forward history
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(action);
      // Keep a max of 20 elements
      if (newHistory.length > 20) {
        newHistory.shift();
      }
      return newHistory;
    });
    setCurrentIndex((prev) => Math.min(prev + 1, 19));
  }, [currentIndex]);

  const undo = useCallback(async () => {
    if (currentIndex >= 0) {
      const action = history[currentIndex];
      try {
        await action.undo();
        setCurrentIndex((prev) => prev - 1);
      } catch (e) {
        console.error("Undo failed", e);
        alert("Failed to undo: " + action.description);
      }
    }
  }, [currentIndex, history]);

  const redo = useCallback(async () => {
    if (currentIndex < history.length - 1) {
      const action = history[currentIndex + 1];
      try {
        await action.redo();
        setCurrentIndex((prev) => prev + 1);
      } catch (e) {
        console.error("Redo failed", e);
        alert("Failed to redo: " + action.description);
      }
    }
  }, [currentIndex, history]);

  // Global hotkeys for Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <UndoContext.Provider value={{ pushAction, undo, redo, canUndo: currentIndex >= 0, canRedo: currentIndex < history.length - 1, history }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const context = useContext(UndoContext);
  if (context === undefined) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
}
