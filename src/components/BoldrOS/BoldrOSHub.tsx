import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { BoldrPipeLine } from './BoldrPipeLine';
import { BoldrInitiatives } from './BoldrInitiatives';
import { BoldrBlockers } from './BoldrBlockers';
import { BoldrMBRs } from './BoldrMBRs';
import { BoldrQAView } from './BoldrQAView';
import { BoldrProjectDetails } from './BoldrProjectDetails';
import { Briefcase, Zap, AlertTriangle, BarChart, CheckSquare } from "../ui/Icon";

export function BoldrOSHub() {
  const location = useLocation();

  const navItems = [
    { name: 'Master Pipeline', path: '/boldr', icon: Briefcase },
    { name: 'Workflow Initiatives', path: '/boldr/initiatives', icon: Zap },
    { name: 'QA & Testing', path: '/boldr/qa', icon: CheckSquare },
    { name: 'Risks & Blockers', path: '/boldr/blockers', icon: AlertTriangle },
    { name: 'MBRs & Expansion', path: '/boldr/mbrs', icon: BarChart },
  ];

  return (
    <div className="flex flex-col h-full bg-[#FDFCFB]">
      <header className="p-6 border-b border-gray-200 bg-white sticky top-0 z-10 hidden md:block">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Boldr AI OS</h1>
            <p className="text-sm font-semibold text-gray-400 mt-1 uppercase tracking-widest">
              Execution Operating System
            </p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/boldr')
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </header>
      
      {/* Mobile nav */}
      <div className="md:hidden flex overflow-x-auto p-4 gap-2 border-b border-gray-200 bg-white">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
              location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/boldr')
                ? 'bg-black text-white shadow-sm'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <item.icon className="w-3 h-3" />
            {item.name}
          </Link>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto w-full p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<BoldrPipeLine />} />
            <Route path="/project/:id" element={<BoldrProjectDetails />} />
            <Route path="/initiatives" element={<BoldrInitiatives />} />
            <Route path="/qa" element={<BoldrQAView />} />
            <Route path="/blockers" element={<BoldrBlockers />} />
            <Route path="/mbrs" element={<BoldrMBRs />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
