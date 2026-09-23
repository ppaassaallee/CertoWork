import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Workflow, Folder, Calendar, Cloud, Mic, MessageSquare, ChevronRight, ArrowLeft } from "../ui/Icon";
import { useNavigate } from "react-router-dom";
import { usePlatformCapabilities } from "../../lib/capabilities";
import { useAuth } from "../../lib/AuthContext";
import { useCalendarEvents } from "../../features/calendar/useCalendarEvents";
import { CalendarConnectWizard } from "../../features/calendar/CalendarConnectWizard";
import {
  type CalendarConnectStep,
  consumeCalendarWizardPending,
} from "../../lib/calendar/connectWizard";
import { doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { t } from "../../lib/i18n";
import { DestructiveDialog } from "../ui/DestructiveDialog";
import {
  readNotifyOnAssignmentEmail,
  readSlackWebhookUrl,
  writeNotifyOnAssignmentEmail,
  writeSlackWebhookUrl,
} from "../../lib/itemUpdateChannels";

function calendarConnectErrorMessage(payload: { error?: string; code?: string }, status: number): string {
  const code = String(payload.code || "");
  const error = String(payload.error || "");
  if (
    code === "GOOGLE_CALENDAR_NOT_CONFIGURED" ||
    /GOOGLE_CALENDAR_CLIENT/i.test(error) ||
    /not configured/i.test(error)
  ) {
    return t("calendar.wizard.platformPending");
  }
  if (code === "CALENDAR_TOKEN_KEY_MISSING" || /CALENDAR_TOKEN_KEY/i.test(error)) {
    return t("calendar.wizard.platformPending");
  }
  if (status === 401 || /Authentication required/i.test(error)) {
    return t("calendar.connectError");
  }
  if (status === 403 || /Forbidden/i.test(error)) {
    return t("calendar.needWorkspace");
  }
  return error || t("calendar.connectError");
}

function calendarCallbackErrorMessage(reason: string): string {
  const code = String(reason || "").toLowerCase();
  if (!code || code === "unknown") return t("calendar.callbackError");
  if (code === "access_denied") return t("calendar.callbackAccessDenied");
  if (code === "invalid_state" || code === "missing_code") {
    return t("calendar.callbackState");
  }
  if (/redirect_uri/i.test(reason) || code === "redirect_uri_mismatch") {
    return t("calendar.callbackRedirect");
  }
  if (/oauth exchange|invalid_grant|code/i.test(reason)) {
    return t("calendar.callbackExchange");
  }
  return `${t("calendar.callbackError")} (${reason.slice(0, 80)})`;
}

export function Integrations() {
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const { capabilities, loading } = usePlatformCapabilities();
  const { accounts, calendars } = useCalendarEvents();
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectNotice, setConnectNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<CalendarConnectStep>("provider");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [notifyAssignmentEmail, setNotifyAssignmentEmail] = useState(true);
  const [notifySaveNotice, setNotifySaveNotice] = useState("");
  const voiceAvailable =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const googleConfigured = capabilities?.googleCalendar?.configured === true;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarParam = params.get("calendar");
    const reason = String(params.get("reason") || "").trim();
    if (calendarParam === "connected") {
      setConnectNotice({ kind: "ok", text: t("calendar.connected") });
      const pending = consumeCalendarWizardPending();
      if (pending?.provider === "google" || params.get("wizard") === "1") {
        setWizardStep("calendars");
        setWizardOpen(true);
      }
    } else if (calendarParam === "error") {
      setConnectNotice({
        kind: "error",
        text: calendarCallbackErrorMessage(reason),
      });
      const pending = consumeCalendarWizardPending();
      if (pending) {
        setWizardStep("authorize");
        setWizardOpen(true);
      }
    }
    if (calendarParam || params.get("wizard") || params.get("reason")) {
      params.delete("calendar");
      params.delete("wizard");
      params.delete("reason");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, []);

  useEffect(() => {
    if (!workspace?.id) return;
    setSlackWebhook(readSlackWebhookUrl(workspace.id));
    setNotifyAssignmentEmail(readNotifyOnAssignmentEmail(workspace.id));
    void getDoc(doc(db, "workspace_settings", workspace.id)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as {
        slackWebhookUrl?: string;
        notifyOnAssignmentEmail?: boolean;
      };
      if (typeof data.slackWebhookUrl === "string" && data.slackWebhookUrl) {
        setSlackWebhook(data.slackWebhookUrl);
        writeSlackWebhookUrl(workspace.id, data.slackWebhookUrl);
      }
      if (typeof data.notifyOnAssignmentEmail === "boolean") {
        setNotifyAssignmentEmail(data.notifyOnAssignmentEmail);
        writeNotifyOnAssignmentEmail(workspace.id, data.notifyOnAssignmentEmail);
      }
    });
  }, [workspace?.id]);

  const saveNotifyChannels = async () => {
    if (!workspace?.id) return;
    writeSlackWebhookUrl(workspace.id, slackWebhook);
    writeNotifyOnAssignmentEmail(workspace.id, notifyAssignmentEmail);
    try {
      await setDoc(
        doc(db, "workspace_settings", workspace.id),
        {
          workspaceId: workspace.id,
          slackWebhookUrl: slackWebhook.trim() || null,
          notifyOnAssignmentEmail: notifyAssignmentEmail,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      setNotifySaveNotice("Saved notification channels.");
    } catch {
      setNotifySaveNotice("Saved locally. Workspace settings write failed.");
    }
  };

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
      throw new Error(t("calendar.needWorkspace"));
    }
    if (capabilities?.googleCalendar && !capabilities.googleCalendar.configured) {
      throw new Error(t("calendar.wizard.platformPending"));
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
        throw new Error(calendarConnectErrorMessage(payload, response.status));
      }
      window.location.assign(String(payload.url));
    } catch (reason) {
      console.error("[calendar.oauth.start]", reason);
      const text = reason instanceof Error ? reason.message : t("calendar.connectError");
      setConnectNotice({ kind: "error", text });
      throw reason instanceof Error ? reason : new Error(text);
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
            data-testid="calendar-open-wizard"
            disabled={connectBusy}
            onClick={() => {
              setWizardStep("provider");
              setWizardOpen(true);
            }}
            type="button"
          >
            {t("calendar.connectCalendar")}
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
            <p>{t("calendar.wizard.platformPending")}</p>
            <p className="mt-1 text-xs opacity-90">{t("calendar.wizard.platformPendingHint")}</p>
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

      <section
        className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
        data-testid="item-notify-integrations"
      >
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-100">
              <MessageSquare className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <span className="font-medium text-gray-900 block">Item notifications</span>
              <span className="text-xs text-gray-500 block">
                Slack webhook and email when someone is assigned.
              </span>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-700">Slack webhook URL</span>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              data-testid="slack-webhook-input"
              onChange={(e) => setSlackWebhook(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
              type="url"
              value={slackWebhook}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              checked={notifyAssignmentEmail}
              data-testid="notify-assignment-email"
              onChange={(e) => setNotifyAssignmentEmail(e.target.checked)}
              type="checkbox"
            />
            Email notify on assignment
          </label>
          <div className="flex items-center gap-3">
            <button
              className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              data-testid="save-notify-channels"
              onClick={() => void saveNotifyChannels()}
              type="button"
            >
              Save
            </button>
            {notifySaveNotice ? (
              <span className="text-xs text-gray-500" role="status">
                {notifySaveNotice}
              </span>
            ) : null}
          </div>
        </div>
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

      <CalendarConnectWizard
        accounts={accounts}
        calendars={calendars}
        capabilitiesLoading={loading}
        googleConfigured={googleConfigured}
        initialProvider="google"
        initialStep={wizardStep}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onConnectGoogle={connectGoogle}
        onOpenWeek={() => navigate("/my-work/week")}
        onSyncAccount={syncAccount}
      />

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
