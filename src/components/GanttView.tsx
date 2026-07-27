import { useMemo } from 'react';
import { Link } from 'react-router-dom';

export function GanttView({ tasks, milestones, stages }: { tasks: any[], milestones?: any[], stages: any[] }) {
  const chartTasks = useMemo(() => {
    return tasks.filter(task => task.startDate || task.dueDate).map(task => {
      let startMs = task.startDate ? new Date(task.startDate + 'T00:00:00').getTime() : (task.createdAt?.toDate ? task.createdAt.toDate().getTime() : Date.now());
      let endMs = task.dueDate ? new Date(task.dueDate + 'T00:00:00').getTime() : startMs + (24 * 60 * 60 * 1000); // end of day or next day

      // Swap if needed
      if (endMs < startMs) {
        const temp = endMs;
        endMs = startMs;
        startMs = temp;
      }

      return {
        ...task,
        type: 'task',
        startMs,
        endMs,
        durationDays: Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24))
      };
    });
  }, [tasks]);

  const chartMilestones = useMemo(() => {
    if (!milestones) return [];
    return milestones.filter(m => m.startDate || m.dueDate).map(m => {
       let startMs = m.startDate ? new Date(m.startDate + 'T00:00:00').getTime() : (m.createdAt?.toDate ? m.createdAt.toDate().getTime() : Date.now());
       let endMs = m.dueDate ? new Date(m.dueDate + 'T00:00:00').getTime() : startMs + (24 * 60 * 60 * 1000);
       
       if (endMs < startMs) {
         const temp = endMs;
         endMs = startMs;
         startMs = temp;
       }

       return {
         ...m,
         type: 'milestone',
         startMs,
         endMs,
         durationDays: Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24))
       };
    });
  }, [milestones]);

  const allItems = [...chartMilestones, ...chartTasks].sort((a, b) => a.startMs - b.startMs);

  if (allItems.length === 0) {
    return <div className="text-center py-20 text-gray-500 bg-white rounded-3xl shadow-sm border border-gray-100">No tasks to plot on the timeline.</div>;
  }

  const minStart = allItems[0].startMs;
  const maxEnd = Math.max(...allItems.map(t => t.endMs));
  
  // Create a grid of days
  const paddingMs = 24 * 60 * 60 * 1000; // 1 day padding back and forth
  const chartStart = minStart - paddingMs;
  const chartEnd = maxEnd + paddingMs;
  const chartTotalMs = chartEnd - chartStart;

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm overflow-x-auto">
       <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6">Project Timeline (Gantt)</h2>
       <div className="relative min-w-[800px]">
          {/* Header Axis */}
          <div className="flex border-b border-gray-200 pb-2 mb-4 relative h-8">
            {Array.from({ length: 5 }).map((_, i) => {
               // Plot 5 ticks
               const pct = (i / 4) * 100;
               const d = new Date(chartStart + (chartTotalMs * (i / 4)));
               return (
                  <div key={i} className="absolute text-[10px] font-bold text-gray-400 -translate-x-1/2" style={{ left: `${pct}%` }}>
                     {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
               )
            })}
          </div>

          {/* Rows */}
          <div className="space-y-4">
             {allItems.map((t) => {
                const startPct = ((t.startMs - chartStart) / chartTotalMs) * 100;
                const widthPct = ((t.endMs - t.startMs) / chartTotalMs) * 100;
                const stage = stages.find(s => s.id === t.stageId) || stages[0];
                const isDone = t.status === 'done' || stage?.name?.toLowerCase() === 'done';

                if (t.type === 'milestone') {
                   return (
                      <div key={`m-${t.id}`} className="relative h-12 flex items-center group">
                        <div className="absolute inset-0 border-b border-gray-50 -z-10" />
                        <div 
                           className="absolute flex items-center gap-2"
                           style={{ left: `${startPct}%` }}
                        >
                           <div className="w-5 h-5 bg-amber-500 rounded-sm rotate-45 shadow-sm transform group-hover:scale-125 transition-transform" title={`Milestone: ${t.title}`} />
                           <span className="text-xs font-bold text-gray-700 whitespace-nowrap hidden md:block">{t.title}</span>
                        </div>
                      </div>
                   )
                }

                return (
                   <div key={`t-${t.id}`} className="relative h-12 flex items-center group">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 border-b border-gray-50 -z-10" />
                      
                      {/* Bar */}
                      <Link 
                        to={`/work/tasks/${t.id}`}
                        className={`absolute h-8 rounded-xl flex items-center px-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md overflow-hidden ${isDone ? 'bg-gray-100 opacity-60 text-gray-400 border border-gray-200' : 'bg-indigo-600 text-white'}`}
                        style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 2)}%` }}
                        title={`${t.title} (${t.durationDays} days)`}
                      >
                         <span className="text-xs font-medium truncate">{t.title}</span>
                      </Link>
                   </div>
                )
             })}
          </div>
       </div>
    </div>
  );
}
