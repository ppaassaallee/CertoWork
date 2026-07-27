import { useState } from 'react';
import { Target, FileText, Link as LinkIcon, Paperclip, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HubView({ project, tasks = [] }: { project: any, tasks: any[] }) {
  // Use real tasks marked as milestones
  const realMilestones = tasks.filter(t => t.isMilestone);
  
  // Sort milestones by date (or creation if date missing)
  realMilestones.sort((a, b) => {
     if (a.status === 'done' && b.status !== 'done') return 1;
     if (b.status === 'done' && a.status !== 'done') return -1;
     return (a.dueDate || "") > (b.dueDate || "") ? 1 : -1;
  });

  const [resources] = useState([
    { id: 'r1', title: 'Design Assets', type: 'link', url: 'https://figma.com' },
    { id: 'r2', title: 'API Documentation', type: 'link', url: 'https://swagger.io' },
  ]);

  const [documents] = useState([
    { id: 'd1', title: 'Project Requirements (PRD)', type: 'doc' },
    { id: 'd2', title: 'Marketing Brief', type: 'doc' },
  ]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-2">
       {/* High Level Stats */}
       <div className="mb-4">
         <h2 className="text-xl font-bold text-gray-800">{project?.title} Hub</h2>
         <p className="text-sm text-gray-500">Manage all artifacts, milestones and external links for your project.</p>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-sm hover:shadow-md transition-shadow">
             <Target className="w-8 h-8 mb-4 opacity-80" />
             <h3 className="font-bold text-lg">Milestones</h3>
             <p className="text-indigo-100 text-sm mt-1">{realMilestones.filter(m => m.status === 'done').length} / {realMilestones.length} Completed</p>
          </div>
          <div className="bg-emerald-500 rounded-3xl p-6 text-white shadow-sm hover:shadow-md transition-shadow">
             <FileText className="w-8 h-8 mb-4 opacity-80" />
             <h3 className="font-bold text-lg">Documents</h3>
             <p className="text-emerald-100 text-sm mt-1">{documents.length} Files Attached</p>
          </div>
          <div className="bg-orange-500 rounded-3xl p-6 text-white shadow-sm hover:shadow-md transition-shadow">
             <LinkIcon className="w-8 h-8 mb-4 opacity-80" />
             <h3 className="font-bold text-lg">Resources</h3>
             <p className="text-orange-100 text-sm mt-1">{resources.length} Links & Tools</p>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Milestones */}
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
           <h3 className="text-sm font-bold text-gray-500 tracking-widest uppercase mb-6 flex items-center gap-2"><Target className="w-4 h-4"/> Key Milestones</h3>
           <div className="space-y-4">
              {realMilestones.length === 0 ? (
                 <p className="text-sm text-gray-400">No milestones yet. Mark tasks as milestones.</p>
              ) : realMilestones.map((m, i) => (
                <div key={m.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.status === 'done' ? 'bg-green-100 text-green-600' : 'bg-indigo-600 text-white'}`}>
                      {m.status === 'done' ? <CheckCircle className="w-4 h-4"/> : <span className="text-[10px] font-bold">{i+1}</span>}
                    </div>
                    {i < realMilestones.length - 1 && <div className="w-0.5 h-full bg-gray-100 mt-2"></div>}
                  </div>
                  <div className="pb-4">
                    <Link to={`/work/tasks/${m.id}`} className={`font-semibold hover:text-indigo-600 transition-colors ${m.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{m.title}</Link>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{m.dueDate || 'No Date'}</p>
                  </div>
                </div>
              ))}
           </div>
         </div>

         <div className="space-y-6">
           {/* Documents */}
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
             <h3 className="text-sm font-bold text-gray-500 tracking-widest uppercase mb-6 flex items-center gap-2"><FileText className="w-4 h-4"/> Documents</h3>
             <div className="space-y-3">
                {documents.map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl border border-transparent hover:border-gray-200 cursor-pointer">
                    <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-gray-100 flex justify-center items-center shrink-0">
                      <Paperclip className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                       <p className="font-semibold text-gray-900 text-sm">{d.title}</p>
                       <p className="text-xs text-gray-500">Google Docs</p>
                    </div>
                  </div>
                ))}
             </div>
           </div>
           
           {/* Resources */}
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
             <h3 className="text-sm font-bold text-gray-500 tracking-widest uppercase mb-6 flex items-center gap-2"><LinkIcon className="w-4 h-4"/> Useful Resources</h3>
             <div className="space-y-3">
                {resources.map(r => (
                  <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl border border-transparent hover:border-gray-200">
                    <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-gray-100 flex justify-center items-center shrink-0">
                      <LinkIcon className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                       <p className="font-semibold text-blue-600 text-sm hover:underline">{r.title}</p>
                       <p className="text-xs text-gray-500 truncate max-w-[200px]">{r.url}</p>
                    </div>
                  </a>
                ))}
             </div>
           </div>
         </div>
       </div>
    </div>
  );
}
