import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from "../ui/Icon";

// Shell to constrain and style the full-screen notebook experience
export function NotebookShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9F8F6] flex flex-col w-full text-slate-800">
      {children}
    </div>
  );
}

// Action bar that stays sticky at the top or bottom
export function NotebookActionBar({ children, sticky = 'top' }: { children: React.ReactNode, sticky?: 'top' | 'bottom' }) {
  return (
    <div className={`
      w-full bg-white/90 backdrop-blur-md border-slate-200 z-30 px-6 py-4 flex items-center justify-between shadow-sm
      ${sticky === 'top' ? 'sticky top-0 border-b' : 'sticky bottom-0 border-t'}
    `}>
      {children}
    </div>
  );
}

// The notebook page container that centers the content
export function NotebookPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-8 relative">
      {children}
    </div>
  );
}

// Ribbon navigation for sections
export function NotebookRibbon({ tabs, activeTab, onTabChange }: { tabs: { id: string; label: string; icon?: React.ReactNode }[], activeTab: string, onTabChange: (id: string) => void }) {
  return (
    <div className="w-full lg:w-64 shrink-0 mt-4">
      <div className="sticky top-24 flex flex-col gap-2">
        <div className="text-xs font-mono text-slate-400 font-bold uppercase tracking-widest px-4 mb-2">Notebook Sections</div>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left group
              ${activeTab === tab.id ? 'bg-white shadow-sm border border-slate-200 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'}
            `}
          >
            {tab.icon && <span className={`${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Reusable Section 
export function NotebookSection({ id, children, className = "" }: { id?: string, children: React.ReactNode, className?: string }) {
  return (
    <section id={id} className={`w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6 ${className}`}>
      {children}
    </section>
  );
}

// Section Header
export function NotebookSectionHeader({ title, subtitle, action }: { title: string, subtitle?: string, action?: React.ReactNode }) {
  return (
    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
      <div>
        <h3 className="font-serif text-2xl font-bold text-slate-800 tracking-tight" style={{ fontFamily: '"Caveat", cursive' }}>{title}</h3>
        {subtitle && <p className="text-xs font-mono font-medium tracking-widest uppercase text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Callout component for explanations
export function NotebookCallout({ 
  title, 
  description, 
  variant = 'info',
  isDismissible = true
}: { 
  title: string, 
  description: string, 
  variant?: 'info' | 'action' | 'warning',
  targetSection?: string,
  isDismissible?: boolean
}) {
  const [collapsed, setCollapsed] = useState(false);
  
  if (collapsed && isDismissible) return null;

  const bgStyles = {
    info: 'bg-indigo-50/50 border-indigo-100 text-indigo-900',
    action: 'bg-emerald-50/50 border-emerald-100 text-emerald-900',
    warning: 'bg-amber-50/50 border-amber-100 text-amber-900'
  };

  const iconStyles = {
    info: <AlertCircle className="w-5 h-5 text-indigo-400" />,
    action: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-400" />
  };

  return (
    <div className={`p-4 rounded-2xl border ${bgStyles[variant]} flex items-start gap-3 my-4 mx-6`}>
      <div className="shrink-0 mt-0.5">{iconStyles[variant]}</div>
      <div className="flex-1">
        <h4 className="text-sm font-bold mb-1">{title}</h4>
        <p className="text-sm opacity-80 leading-relaxed font-sans">{description}</p>
      </div>
      {isDismissible && (
         <button onClick={() => setCollapsed(true)} className="opacity-50 hover:opacity-100 p-1">
           <AlertCircle className="w-4 h-4 opacity-0" /> {/* Spacer */}
           <span className="sr-only">Dismiss</span>
         </button>
      )}
    </div>
  );
}

// A standard text field or area for the notebook
export function NotebookField({ label, placeholder, value, onChange, type = 'text', rows = 3, className = "" }: { label?: string, placeholder?: string, value: string, onChange: (val: string) => void, type?: 'text' | 'textarea', rows?: number, className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest pl-1">{label}</label>}
      {type === 'textarea' ? (
        <textarea 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 font-sans leading-relaxed text-slate-800 transition-all resize-y"
          style={{
            backgroundImage: "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)",
            backgroundSize: "100% 28px",
            lineHeight: "28px"
          }}
        />
      ) : (
        <input 
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 font-sans text-slate-800 transition-all"
        />
      )}
    </div>
  );
}

// Empty state
export function NotebookEmptyState({ title, description, icon, action }: { title: string, description: string, icon?: React.ReactNode, action?: React.ReactNode }) {
  return (
    <div className="py-12 px-6 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/30 m-6">
      {icon && <div className="text-slate-300 mb-4">{icon}</div>}
      <h4 className="text-sm font-bold text-slate-700 mb-2">{title}</h4>
      <p className="text-sm text-slate-400 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
