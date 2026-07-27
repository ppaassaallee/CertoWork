import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Database, 
  Download, 
  AlertTriangle, 
  ShieldCheck, 
  Loader2, 
  RefreshCw, 
  Play, 
  CheckCircle, 
  Activity, 
  Clock, 
  AlertOctagon,
  Wrench,
  HelpCircle,
  FileCode
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";

export function DataIntegrity() {
  const { user, workspace } = useAuth();
  const [loading, setLoading] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // States for DB data
  const [auditReport, setAuditReport] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migrationStats, setMigrationStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"health" | "migrations" | "audit_logs" | "indexes">("health");

  useEffect(() => {
    if (!user || !workspace) return;
    initDashboard();
  }, [user, workspace]);

  const initDashboard = async () => {
    setLoading(true);
    await Promise.all([
      runLiveAudit(),
      fetchAuditLogs()
    ]);
    setLoading(false);
  };

  const runLiveAudit = async () => {
    if (!user || !workspace) return;
    setAuditRunning(true);
    try {
      const res = await fetch("/api/data-management/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAuditReport(data);
      } else {
        console.error("Failed to run live audit", await res.text());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuditRunning(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (!workspace) return;
    try {
      const res = await fetch(`/api/data-management/audit-logs?workspaceId=${workspace.id}&limit=40`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    }
  };

  const handleMigration = async (mode: "dry" | "apply") => {
    if (!user || !workspace) return;
    if (mode === "apply" && !confirm("WARNING: This will permanently modify database records to apply schemas, normalize titles, and align workspaceIds. Are you sure?")) {
      return;
    }

    setMigrating(true);
    setMigrationStats(null);
    setMigrationLogs([`Initializing schema migration in [${mode.toUpperCase()}] mode...`]);

    try {
      const res = await fetch("/api/data-management/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          mode
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMigrationStats({
          mode: data.mode,
          scanned: data.recordsScanned,
          changed: data.recordsChanged,
          errorsCount: data.errors.length,
          success: data.status === "success"
        });
        setMigrationLogs(data.logs);
        // Refresh audit after applying migration
        if (mode === "apply") {
          await runLiveAudit();
          await fetchAuditLogs();
        }
      } else {
        const errText = await res.text();
        setMigrationLogs(prev => [...prev, `[ERROR] Migration failed: ${errText}`]);
      }
    } catch (err: any) {
      setMigrationLogs(prev => [...prev, `[ERROR] Connection error: ${err.message}`]);
    } finally {
      setMigrating(false);
    }
  };

  const handleBackupExport = async () => {
    if (!user || !workspace) return;
    setExporting(true);
    try {
      const res = await fetch("/api/data-management/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id
        })
      });

      if (res.ok) {
        const backupData = await res.json();
        const str = JSON.stringify(backupData, null, 2);
        const blob = new Blob([str], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gazelle-workspace-${workspace.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        await runLiveAudit(); // refresh stats
      } else {
        alert("Failed to export workspace data: " + (await res.text()));
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred during workspace backup export.");
    } finally {
      setExporting(false);
    }
  };

  // Indexes documentation block
  const indexDoc = {
    indexes: [
      {
        collection: "tasks",
        fields: "userId ASC, workspaceId ASC, status ASC, createdAt DESC",
        useCase: "Displaying active tasks in Today, List, and Work planners"
      },
      {
        collection: "projects",
        fields: "userId ASC, workspaceId ASC, status ASC, createdAt DESC",
        useCase: "Displaying projects list filtered by status and workspace"
      },
      {
        collection: "audit_logs",
        fields: "workspaceId ASC, createdAt DESC",
        useCase: "Fetching latest audit records for Data Health workspace"
      },
      {
        collection: "migration_runs",
        fields: "userId ASC, workspaceId ASC, completedAt DESC",
        useCase: "Querying latest schema and platform migration runs"
      }
    ]
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-6 max-w-5xl mx-auto space-y-6 pb-24"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-4">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Database Health & Data Management</h1>
            <p className="text-gray-500 text-sm mt-1">
              Multi-workspace isolation metrics, schemas, and live data quality monitoring for <span className="font-semibold text-gray-700">{workspace?.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={runLiveAudit}
            disabled={auditRunning}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl px-4 py-2.5 font-medium text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {auditRunning ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <RefreshCw className="w-4 h-4 text-gray-500" />}
            Refresh Audit
          </button>
          <button 
            onClick={handleBackupExport}
            disabled={exporting}
            className="bg-black hover:bg-gray-800 text-white rounded-xl px-4 py-2.5 font-medium text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin text-white/50" /> : <Download className="w-4 h-4" />}
            Export Workspace
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-24 bg-white border border-gray-100 rounded-2xl">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 font-medium">Running platform diagnostics...</p>
        </div>
      ) : (
        <>
          {/* Key Diagnostics Overview */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total User Records</span>
                <Database className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{auditReport?.totalCount || 0}</div>
              <p className="text-[10px] text-gray-400 mt-1">Across {Object.keys(auditReport?.stats || {}).length} registered collections</p>
            </div>

            <div className={`bg-white rounded-2xl border p-5 shadow-sm ${auditReport?.criticalCount > 0 ? "border-red-200 bg-red-50/10" : "border-gray-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${auditReport?.criticalCount > 0 ? "text-red-500" : "text-gray-400"}`}>
                  Isolation Breaches
                </span>
                <AlertOctagon className={`w-4 h-4 ${auditReport?.criticalCount > 0 ? "text-red-500 animate-pulse" : "text-gray-400"}`} />
              </div>
              <div className={`text-3xl font-bold ${auditReport?.criticalCount > 0 ? "text-red-600" : "text-gray-900"}`}>
                {auditReport?.criticalCount || 0}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Records violating workspace scoping rules</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Audit Warnings</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{auditReport?.issues?.length || 0}</div>
              <p className="text-[10px] text-gray-400 mt-1">Schema, timestamp, reference issues</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Diagnostic Status</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-gray-900 flex items-center gap-1.5 mt-1">
                {auditReport?.criticalCount === 0 ? (
                  <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-semibold">Ready & Secure</span>
                ) : (
                  <span className="text-red-600 bg-red-50 px-2.5 py-1 rounded-full text-xs font-semibold">Needs Attention</span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Checked: {new Date(auditReport?.checkedAt).toLocaleTimeString()}</p>
            </div>
          </section>

          {/* Tabbed Control Center */}
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex border-b border-gray-100 bg-gray-50/50 p-2 gap-1">
              <button 
                onClick={() => setActiveTab("health")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === "health" ? "bg-white text-gray-900 shadow-sm border border-gray-150" : "text-gray-500 hover:text-gray-900"}`}
              >
                <Activity className="w-3.5 h-3.5" />
                Live Quality Audit ({auditReport?.issues?.length || 0})
              </button>
              <button 
                onClick={() => setActiveTab("migrations")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === "migrations" ? "bg-white text-gray-900 shadow-sm border border-gray-150" : "text-gray-500 hover:text-gray-900"}`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Schema Migrations
              </button>
              <button 
                onClick={() => setActiveTab("audit_logs")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === "audit_logs" ? "bg-white text-gray-900 shadow-sm border border-gray-150" : "text-gray-500 hover:text-gray-900"}`}
              >
                <Clock className="w-3.5 h-3.5" />
                Activity Audit Logs ({auditLogs.length})
              </button>
              <button 
                onClick={() => setActiveTab("indexes")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === "indexes" ? "bg-white text-gray-900 shadow-sm border border-gray-150" : "text-gray-500 hover:text-gray-900"}`}
              >
                <FileCode className="w-3.5 h-3.5" />
                Index Directory
              </button>
            </div>

            <div className="p-6">
              {/* TAB 1: Live Quality Audit */}
              {activeTab === "health" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">Real-time Schema & Consistency Report</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Scanned collections to identify structural and tenancy isolation breaches</p>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400">Scanned on-demand</span>
                  </div>

                  {auditReport?.issues?.length === 0 ? (
                    <div className="text-center p-12 bg-neutral-50 rounded-2xl border border-dashed border-gray-200">
                      <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                      <h4 className="font-semibold text-sm text-gray-800">Your Database is Healthy</h4>
                      <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                        Zero issues detected. All scanned records correctly respect workspace scope boundary, contain optimal timestamps, and utilize correct priorities.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Issues list */}
                      <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-150">
                        {auditReport?.issues?.map((issue: any) => (
                          <div key={issue.id} className="p-4 bg-white hover:bg-neutral-50/50 flex items-start justify-between gap-4 text-xs">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {issue.severity === "critical" ? (
                                  <AlertOctagon className="w-4 h-4 text-red-500" />
                                ) : issue.severity === "high" ? (
                                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                                ) : issue.severity === "medium" ? (
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                ) : (
                                  <HelpCircle className="w-4 h-4 text-blue-400" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider ${
                                    issue.severity === "critical" ? "bg-red-50 text-red-600 border border-red-100" :
                                    issue.severity === "high" ? "bg-orange-50 text-orange-600 border border-orange-100" :
                                    issue.severity === "medium" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                    "bg-blue-50 text-blue-600 border border-blue-100"
                                  }`}>
                                    {issue.severity}
                                  </span>
                                  <span className="font-mono text-gray-400 text-[10px]">{issue.collection}</span>
                                  <span className="font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{issue.recordId}</span>
                                </div>
                                <p className="font-medium text-gray-800 text-xs">{issue.description}</p>
                                <p className="text-[10px] text-gray-400">
                                  <span className="font-semibold text-gray-600">Proposed Auto-Fix: </span>
                                  {issue.suggestedFix}
                                </p>
                              </div>
                            </div>

                            {issue.autoFixAvailable && (
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                                Resolvable via Migration
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <button 
                          onClick={() => setActiveTab("migrations")}
                          className="bg-black hover:bg-gray-800 text-white rounded-xl px-4 py-2 font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Go to Migrations Panel to Fix Issues
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Collection Breakdown */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden mt-6">
                    <div className="bg-gray-50 border-b border-gray-150 px-4 py-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Workspace Collection Size Breakdown</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
                      {Object.entries(auditReport?.stats || {}).map(([col, size]: any) => (
                        <div key={col} className="p-4 text-center">
                          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block mb-1">{col}</span>
                          <span className="text-lg font-bold text-gray-800">{size}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Schema Migrations */}
              {activeTab === "migrations" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Database Hardening Schema Migrations</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Safely standardize, isolate, and index legacy data. Standardizes records, sets timestamps, resets priority fallbacks, and prepares search normalizations.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-neutral-50 rounded-2xl border border-gray-200 p-5 space-y-4">
                      <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-gray-500" />
                        Execution Controls
                      </h4>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Use <span className="font-semibold">Dry Run</span> to verify changes without altering any document data. Use <span className="font-semibold">Apply Migration</span> to apply corrections to all documents.
                      </p>

                      <div className="flex gap-2.5">
                        <button
                          onClick={() => handleMigration("dry")}
                          disabled={migrating}
                          className="flex-1 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl py-3 px-4 text-xs font-semibold flex justify-center items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          {migrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          Dry Run Migration
                        </button>
                        <button
                          onClick={() => handleMigration("apply")}
                          disabled={migrating}
                          className="flex-1 bg-black hover:bg-gray-800 text-white rounded-xl py-3 px-4 text-xs font-semibold flex justify-center items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          {migrating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white/50" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Apply Migration
                        </button>
                      </div>

                      {migrationStats && (
                        <div className="bg-white border border-gray-150 rounded-xl p-4 text-xs space-y-2">
                          <h5 className="font-bold text-gray-800">Latest Execution Stats</h5>
                          <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-gray-500 mt-2">
                            <div className="bg-neutral-50 p-2 rounded-lg">
                              <span className="block text-gray-400 text-[9px] uppercase font-bold">Scanned</span>
                              <span className="text-sm font-bold text-gray-900">{migrationStats.scanned}</span>
                            </div>
                            <div className="bg-neutral-50 p-2 rounded-lg">
                              <span className="block text-gray-400 text-[9px] uppercase font-bold">Modified</span>
                              <span className="text-sm font-bold text-indigo-600">{migrationStats.changed}</span>
                            </div>
                            <div className="bg-neutral-50 p-2 rounded-lg">
                              <span className="block text-gray-400 text-[9px] uppercase font-bold">Errors</span>
                              <span className={`text-sm font-bold ${migrationStats.errorsCount > 0 ? "text-red-500" : "text-gray-900"}`}>
                                {migrationStats.errorsCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-black rounded-2xl border border-neutral-800 p-5 flex flex-col h-64 overflow-hidden">
                      <h4 className="font-mono text-xs text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Console Logs</span>
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      </h4>
                      <div className="flex-1 overflow-y-auto font-mono text-[10px] text-neutral-300 space-y-1.5 pr-2">
                        {migrationLogs.length === 0 ? (
                          <span className="text-neutral-500 italic">No migration runs executed yet in this session.</span>
                        ) : (
                          migrationLogs.map((log, idx) => (
                            <div key={idx} className={log.includes("[ERROR]") ? "text-red-400" : log.includes("[tasks:") || log.includes("[projects:") ? "text-indigo-400" : ""}>
                              {log}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Activity Audit Logs */}
              {activeTab === "audit_logs" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">Workspace Activity Audit Trail</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Immutable record of project alterations, status updates, and deletions</p>
                    </div>
                    <button 
                      onClick={fetchAuditLogs}
                      className="text-[11px] font-bold text-indigo-600 flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh Logs
                    </button>
                  </div>

                  {auditLogs.length === 0 ? (
                    <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-dashed border-gray-200">
                      <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <h4 className="font-semibold text-xs text-gray-500">No activity logged yet</h4>
                      <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                        Critical modifications and entity creations will be automatically audited here to maintain full data lineage.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gray-150 rounded-2xl overflow-hidden overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                            <th className="p-3">Time</th>
                            <th className="p-3">Action</th>
                            <th className="p-3">Actor</th>
                            <th className="p-3">Entity Type</th>
                            <th className="p-3">Entity ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-neutral-50/40 text-gray-700">
                              <td className="p-3 whitespace-nowrap text-[10px] text-gray-400 font-mono">
                                {log.createdAt ? new Date(log.createdAt).toLocaleDateString() + " " + new Date(log.createdAt).toLocaleTimeString() : "N/A"}
                              </td>
                              <td className="p-3 whitespace-nowrap font-semibold text-gray-950">
                                {log.action}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                                  log.actorType === "boldi" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                                }`}>
                                  {log.actorType || "user"}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap text-gray-500">
                                {log.entityType || "N/A"}
                              </td>
                              <td className="p-3 whitespace-nowrap font-mono text-[10px] text-gray-400">
                                {log.entityId || "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Index Directory */}
              {activeTab === "indexes" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Firestore Index Directory</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Composite indexes required for multi-workspace filter query performance</p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-xs text-amber-800 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Important Notice:</span> Firestore composite indexes must be set up via the Firebase Console or deployed using Firebase CLI configurations. If any compound query fails with an index error, follow the link displayed in the browser developer console to initialize the index instantly.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {indexDoc.indexes.map((idx, i) => (
                      <div key={i} className="border border-gray-200 rounded-2xl p-4 space-y-2 bg-white hover:shadow-sm transition-all text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded text-[10px]">
                            {idx.collection}
                          </span>
                        </div>
                        <div className="bg-neutral-50 rounded-lg p-2.5 font-mono text-[10px] text-gray-600 select-all border border-gray-150">
                          {idx.fields}
                        </div>
                        <p className="text-[11px] text-gray-500">
                          <span className="font-semibold text-gray-700">Scope:</span> {idx.useCase}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
