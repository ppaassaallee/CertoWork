import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, CornerDownRight } from "./ui/Icon";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { setTaskStatus } from "../lib/tasks";
import { Link } from "react-router-dom";

export function ProjectMilestonesView({ 
  project, 
  tasks, 
  milestones, 
  user, 
  workspace,
  canCreateMilestone = true,
  canCreateTask = true,
  canUpdateTask = true
}: { 
  project: any, 
  tasks: any[], 
  milestones: any[], 
  user: any, 
  workspace: any,
  canCreateMilestone?: boolean,
  canCreateTask?: boolean,
  canUpdateTask?: boolean
}) {
  const [newTitle, setNewTitle] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const parentTasks = tasks.filter(t => !t.parentId);
  
  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (!canCreateMilestone) {
      alert("You do not have permission to create milestones in this workspace.");
      return;
    }
    try {
      await addDoc(collection(db, "milestones"), {
        userId: user.uid,
        workspaceId: workspace.id,
        projectId: project.id,
        title: newTitle.trim(),
        status: "not_started",
        order: milestones.length,
        createdAt: serverTimestamp(),
      });
      setNewTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (taskId: string, status: string) => {
    if (!canUpdateTask) {
      alert("You do not have permission to update tasks in this workspace.");
      return;
    }
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const isDone = status === "done";
      await setTaskStatus(task, isDone ? "open" : "done");
    }
  };

  const getSubtasks = (parentId: string) => tasks.filter(t => t.parentId === parentId);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Milestones</h2>
        
        <div className="space-y-4">
          {milestones.map(milestone => {
            const milestoneTasks = parentTasks.filter(t => t.milestoneId === milestone.id);
            const isExpanded = expandedId === milestone.id;
            const completedCount = milestoneTasks.filter(t => t.status === "done").length;
            const totalCount = milestoneTasks.length;
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            
            return (
              <div key={milestone.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white hover:border-gray-300 transition-colors">
                <div 
                  className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : milestone.id)}
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{milestone.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-medium">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{milestone.status}</span>
                        {milestone.dueDate && <span>Due: {milestone.dueDate}</span>}
                        <span>{completedCount} / {totalCount} tasks</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-100 rounded-full h-2 hidden sm:block">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-10 text-right">{progress}%</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <div className="space-y-3">
                      {milestoneTasks.map(task => {
                        const subtasks = getSubtasks(task.id);
                        return (
                          <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm hover:border-gray-300 transition-all">
                            <div className="flex items-start gap-3">
                              <input 
                                type="checkbox"
                                checked={task.status === "done"}
                                onChange={() => handleToggleTask(task.id, task.status)}
                                className="mt-1 w-4 h-4 rounded border-gray-300 accent-black cursor-pointer"
                              />
                              <div className="flex-1">
                                <Link to={`/work/tasks/${task.id}`} className={`font-medium text-sm block hover:text-indigo-600 transition-colors ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                  {task.title}
                                </Link>
                                
                                {subtasks.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {subtasks.map(sub => (
                                      <div key={sub.id} className="flex items-center gap-2 pl-2 border-l border-gray-100">
                                        <CornerDownRight className="w-3 h-3 text-gray-300" />
                                        <input 
                                          type="checkbox"
                                          checked={sub.status === "done"}
                                          onChange={() => handleToggleTask(sub.id, sub.status)}
                                          className="w-3 h-3 rounded border-gray-300 accent-black cursor-pointer"
                                        />
                                        <Link to={`/work/tasks/${sub.id}`} className={`text-xs hover:text-indigo-600 transition-colors ${sub.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                                          {sub.title}
                                        </Link>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      <form 
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!canCreateTask) {
                            alert("You do not have permission to create tasks in this workspace.");
                            return;
                          }
                          const el = e.currentTarget.elements.namedItem("newTaskTitle") as HTMLInputElement;
                          if (el.value.trim()) {
                            await addDoc(collection(db, "tasks"), {
                              userId: user.uid,
                              workspaceId: workspace.id,
                              projectId: project.id,
                              milestoneId: milestone.id,
                              title: el.value.trim(),
                              status: "open",
                              createdAt: serverTimestamp()
                            });
                            el.value = "";
                          }
                        }}
                        className="mt-2"
                      >
                        <input 
                          name="newTaskTitle"
                          type="text"
                          placeholder="+ Add task to milestone..."
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 transition-colors shadow-sm"
                        />
                      </form>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {milestones.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-2xl">
               No milestones yet. Milestones help break your project into phases.
            </div>
          )}

          <form onSubmit={handleCreateMilestone} className="flex items-center gap-2">
            <input 
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New milestone title..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
            />
            <button type="submit" disabled={!newTitle.trim()} className="bg-black text-white px-4 py-2.5 flex items-center gap-2 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-gray-900 transition-colors">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>
      </div>
      
      {/* Unassigned tasks section */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Unassigned Tasks</h2>
        <div className="space-y-3">
          {parentTasks.filter(t => !t.milestoneId).map(task => (
            <div key={task.id} className="flex items-start gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
               <input 
                  type="checkbox"
                  checked={task.status === "done"}
                  onChange={() => handleToggleTask(task.id, task.status)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 accent-black cursor-pointer"
               />
               <div>
                  <Link to={`/work/tasks/${task.id}`} className={`font-medium text-sm block hover:text-indigo-600 transition-colors ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {task.title}
                  </Link>
               </div>
            </div>
          ))}
          {parentTasks.filter(t => !t.milestoneId).length === 0 && (
            <p className="text-sm text-gray-400">All tasks are assigned to milestones.</p>
          )}
        </div>
      </div>
    </div>
  );
}
