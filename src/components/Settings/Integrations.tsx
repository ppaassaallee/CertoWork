import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Workflow, Folder, Calendar, Cloud, Mic, MessageSquare, ChevronRight, ArrowLeft } from "../ui/Icon";
import { useNavigate } from "react-router-dom";
import { usePlatformCapabilities } from "../../lib/capabilities";
import { useAuth } from "../../lib/AuthContext";
import { useCalendarEvents } from "../../features/calendar/useCalendarEvents";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { t } from "../../lib/i18n";
import { DestructiveDialog } from "../ui/DestructiveDialog";

export function Integrations() {
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const { capabilities, loading } = usePlatformCapabilities();
  const { accounts, calendars } = useCalendarEvents();
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const voiceAvailable =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar") === "connected") {
      // Soft notice via URL; keep page clean.
      params.delete("calendar");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, []);

  const integrationsList = [
    {
      title: "Google Workspace",
      description: "Docs, Sheets, Drive",
      icon: Cloud,
      connected: capabilities?.googleDrive.configured,
      path: null
    },
    {
      title: "Notion",
      description: "Pages & Databases",
      icon: Folder,
      connected: false,
      path: "/settings/integrations/notion",
      planned: true
    },
    {
      title: "HubSpot / CRM",
      description: "Webhook ingestion",
      icon: Workflow,
      connected: capabilities?.hubspot.configured,
      path: null
    },
    {
      title: "Voice / STT",
      description: "On-device browser speech capture",
      icon: Mic,
      connected: voiceAvailable,
      path: "/boldi",
      internal: true
    },
    {
      title: "Email / SMS",
      description: "External delivery",
      icon: MessageSquare,
      connected: false,
      path: null
    }
  ];

  const connectGoogle = () => {
    if (!user || !workspace) return;
    const url = `/api/calendar/oauth/google/start?uid=${encodeURIComponent(user.uid)}&workspaceId=${encodeURIComponent(workspace.id)}`;
    window.location.href = url;
  };

  const syncAccount = async (accountId: string) => {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`/api/calendar/sync/${encodeURIComponent(accountId)}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: user.uid }),
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 max-w-2xl mx-auto space-y-6 pb-24"
    >
      <header className="mb-6 mt-4 flex items-center gap-3">
        <button onClick={() => navigate("/settings")} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-gray-500 text-sm mt-1">Connect third-party apps and services.</p>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden" data-testid="calendar-integrations">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-100">
              <Calendar className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <span className="font-medium text-gray-900 block">{t("calendar.calendars")}</span>
              <span className="text-xs text-gray-500 block">Google Calendar · read overlay</span>
            </div>
          </div>
          <button
            className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
            onClick={connectGoogle}
            type="button"
          >
            {t("calendar.connectGoogle")}
          </button>
        </div>
        {accounts.map((account) => (
          <div className="p-4 border-b border-gray-100 space-y-3" key={account.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <strong className="text-sm">{account.email || account.displayName}</strong>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">{account.status}</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs px-2 py-1 rounded-lg border"
                  onClick={() => void syncAccount(account.id)}
                  type="button"
                >
                  {t("calendar.syncNow")}
                </button>
                <button
                  className="text-xs px-2 py-1 rounded-lg border text-red-600"
                  onClick={() => setDisconnectId(account.id)}
                  type="button"
                >
                  {t("calendar.disconnect")}
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {calendars
                .filter((calendar) => calendar.accountId === account.id)
                .map((calendar) => (
                  <li className="flex items-center gap-2 text-xs" key={calendar.id}>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: calendar.color || "var(--accent)" }}
                    />
                    <span className="flex-1">{calendar.name}</span>
                    <label className="flex items-center gap-1">
                      <input
                        checked={calendar.visible !== false}
                        onChange={(e) =>
                          void updateDoc(doc(db, "calendars", calendar.id), {
                            visible: e.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      {t("calendar.show")}
                    </label>
                    <select
                      onChange={(e) =>
                        void updateDoc(doc(db, "calendars", calendar.id), {
                          privacy: e.target.value,
                        })
                      }
                      value={calendar.privacy || "full"}
                    >
                      <option value="full">{t("calendar.privacyFull")}</option>
                      <option value="busy">{t("calendar.privacyBusy")}</option>
                    </select>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {integrationsList.map((item) => (
          <button 
            key={item.title} 
            onClick={() => item.path && navigate(item.path)} 
            className={`w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors ${!item.path ? "cursor-default hover:bg-white" : ""}`}
          >
            <div className="flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-50 border border-gray-100`}>
                <item.icon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <span className="font-medium text-gray-900 block">{item.title}</span>
                <span className="text-xs text-gray-500 block">{item.description}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                loading
                  ? "text-gray-500 bg-gray-100"
                  : item.connected
                    ? "text-emerald-600 bg-emerald-50"
                    : item.planned
                      ? "text-amber-600 bg-amber-50"
                      : "text-gray-500 bg-gray-100"
              }`}>
                {loading ? "…" : item.connected ? "On" : item.planned ? "Soon" : "Off"}
              </span>
              {item.path ? <ChevronRight className="w-4 h-4 text-gray-400" /> : null}
            </div>
          </button>
        ))}
      </div>

      <DestructiveDialog
        confirmLabel={t("calendar.disconnect")}
        entityName={accounts.find((a) => a.id === disconnectId)?.email || "Google"}
        impact={["Scheduled blocks stay in Google but stop syncing."]}
        onCancel={() => setDisconnectId(null)}
        onConfirm={() => {
          if (disconnectId) {
            void updateDoc(doc(db, "calendar_accounts", disconnectId), {
              status: "disconnected",
            });
          }
          setDisconnectId(null);
        }}
        open={Boolean(disconnectId)}
        verb={t("calendar.disconnect")}
      />
    </motion.div>
  );
}
