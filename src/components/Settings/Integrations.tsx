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

function calendarConnectErrorMessage(payload: { error?: string; code?: string }, status: number): string {
  const code = String(payload.code || "");
  const error = String(payload.error || "");
  if (
    code === "GOOGLE_CALENDAR_NOT_CONFIGURED" ||
    /GOOGLE_CALENDAR_CLIENT/i.test(error) ||
    /not configured/i.test(error)
  ) {
    return t("calendar.oauthNotConfigured");
  }
  if (code === "CALENDAR_TOKEN_KEY_MISSING" || /CALENDAR_TOKEN_KEY/i.test(error)) {
    return t("calendar.oauthNotConfigured");
  }
  if (status === 401 || /Authentication required/i.test(error)) {
    return t("calendar.connectError");
  }
  if (status === 403 || /Forbidden/i.test(error)) {
    return t("calendar.needWorkspace");
  }
  return error || t("calendar.connectError");
}

export function Integrations() {
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const { capabilities, loading } = usePlatformCapabilities();
  const { accounts, calendars } = useCalendarEvents();
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectNotice, setConnectNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const voiceAvailable =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const calendarConfigured = capabilities?.googleCalendar?.configured !== false;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarParam = params.get("calendar");
    if (calendarParam === "connected") {
      setConnectNotice({ kind: "ok", text: t("calendar.connected") });
    } else if (calendarParam === "error") {
      setConnectNotice({ kind: "error", text: t("calendar.callbackError") });
    }
    if (calendarParam) {
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

  const connectGoogle = async () => {
    if (!user || !workspace) {
      setConnectNotice({ kind: "error", text: t("calendar.needWorkspace") });
      return;
    }
    if (capabilities?.googleCalendar && !capabilities.googleCalendar.configured) {
      setConnectNotice({ kind: "error", text: t("calendar.oauthNotConfigured") });
      return;
    }
    setConnectBusy(true);
    setConnectNotice(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/calendar/oauth/google/start", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: user.uid, workspaceId: workspace.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok || !payload.url) {
        console.error("[calendar.oauth.start]", payload.error || response.status);
        setConnectNotice({
          kind: "error",
          text: calendarConnectErrorMessage(payload, response.status),
        });
        return;
      }
      window.location.assign(String(payload.url));
    } catch (reason) {
      console.error("[calendar.oauth.start]", reason);
      setConnectNotice({
        kind: "error",
        text: reason instanceof Error ? reason.message : t("calendar.connectError"),
      });
    } finally {
      setConnectBusy(false);
    }
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

  const disconnectAccount = async (accountId: string) => {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`/api/calendar/accounts/${encodeURIComponent(accountId)}/disconnect`, {
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
        <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-100">
              <Calendar className="w-5 h-5 text-gray-600" />
            </div>
            <div className="min-w-0">
              <span className="font-medium text-gray-900 block">{t("calendar.calendars")}</span>
              <span className="text-xs text-gray-500 block">{t("calendar.subtitle")}</span>
            </div>
          </div>
          <button
            className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            disabled={connectBusy || (!loading && !calendarConfigured)}
            onClick={() => void connectGoogle()}
            type="button"
          >
            {connectBusy ? t("calendar.connecting") : t("calendar.connectGoogle")}
          </button>
        </div>
        {connectNotice ? (
          <div
            className={`px-4 py-3 text-sm border-b border-gray-100 ${
              connectNotice.kind === "ok" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
            }`}
            data-testid="calendar-connect-notice"
            role="status"
          >
            {connectNotice.text}
          </div>
        ) : null}
        {!loading && capabilities?.googleCalendar && !capabilities.googleCalendar.configured ? (
          <div className="px-4 py-3 text-sm text-amber-800 bg-amber-50 border-b border-gray-100" role="status">
            {t("calendar.oauthNotConfigured")}
          </div>
        ) : null}
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
        impact={[t("calendar.disconnectImpact")]}
        onCancel={() => setDisconnectId(null)}
        onConfirm={() => {
          if (disconnectId) {
            void disconnectAccount(disconnectId);
          }
          setDisconnectId(null);
        }}
        open={Boolean(disconnectId)}
        verb={t("calendar.disconnect")}
      />
    </motion.div>
  );
}
