import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, Check, ChevronRight, Cloud, Mail, X } from "../../components/ui/Icon";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { t, type MessageKey } from "../../lib/i18n";
import type { Calendar, CalendarAccount } from "../../lib/calendar/types";
import {
  type CalendarConnectProvider,
  type CalendarConnectStep,
  CALENDAR_CONNECT_STEPS,
  calendarConnectStepIndex,
  clearCalendarWizardPending,
  markCalendarWizardPending,
  nextCalendarConnectStep,
} from "../../lib/calendar/connectWizard";

export type CalendarConnectWizardProps = {
  accounts: CalendarAccount[];
  calendars: Calendar[];
  googleConfigured: boolean;
  capabilitiesLoading?: boolean;
  initialProvider?: CalendarConnectProvider;
  initialStep?: CalendarConnectStep;
  isOpen: boolean;
  onClose: () => void;
  onConnectGoogle: () => Promise<void>;
  onOpenWeek?: () => void;
  onSyncAccount: (accountId: string) => Promise<void>;
};

const STEP_LABEL_KEYS: Record<CalendarConnectStep, MessageKey> = {
  provider: "calendar.wizard.stepProvider",
  authorize: "calendar.wizard.stepAuthorize",
  calendars: "calendar.wizard.stepCalendars",
  privacy: "calendar.wizard.stepPrivacy",
  done: "calendar.wizard.stepDone",
};

export function CalendarConnectWizard({
  accounts,
  calendars,
  googleConfigured,
  capabilitiesLoading = false,
  initialProvider = "google",
  initialStep = "provider",
  isOpen,
  onClose,
  onConnectGoogle,
  onOpenWeek,
  onSyncAccount,
}: CalendarConnectWizardProps) {
  const [step, setStep] = useState<CalendarConnectStep>(initialStep);
  const [provider, setProvider] = useState<CalendarConnectProvider>(initialProvider);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status !== "disconnected"),
    [accounts],
  );
  const latestAccount = activeAccounts[0] || null;
  const accountCalendars = useMemo(
    () =>
      latestAccount
        ? calendars.filter((calendar) => calendar.accountId === latestAccount.id)
        : [],
    [calendars, latestAccount],
  );

  useEffect(() => {
    if (!isOpen) return;
    setStep(initialStep);
    setProvider(initialProvider);
    setError("");
    setBusy(false);
  }, [initialProvider, initialStep, isOpen]);

  if (!isOpen) return null;

  const stepIndex = calendarConnectStepIndex(step);

  const goNext = () => {
    const next = nextCalendarConnectStep(step);
    if (next) setStep(next);
  };

  const startAuthorize = async () => {
    if (provider === "microsoft") {
      setError(t("calendar.wizard.outlookSoonDetail"));
      return;
    }
    if (!googleConfigured) {
      setError(t("calendar.wizard.platformPending"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      markCalendarWizardPending("google");
      await onConnectGoogle();
    } catch (reason) {
      clearCalendarWizardPending();
      setError(reason instanceof Error ? reason.message : t("calendar.connectError"));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (latestAccount) {
      try {
        await onSyncAccount(latestAccount.id);
      } catch {
        /* sync is best-effort on finish */
      }
    }
    clearCalendarWizardPending();
    onClose();
    onOpenWeek?.();
  };

  return (
    <div
      aria-label={t("calendar.wizard.title")}
      aria-modal="true"
      className="do-skill-layer"
      data-testid="calendar-connect-wizard"
      role="dialog"
    >
      <section className="do-skill-modal">
        <header className="do-skill-head">
          <div className="do-skill-title">
            <span>
              <CalendarIcon size={18} />
            </span>
            <div>
              <small>{t("calendar.wizard.kicker")}</small>
              <h2>{t("calendar.wizard.title")}</h2>
              <p>{t("calendar.wizard.summary")}</p>
            </div>
          </div>
          <button
            aria-label={t("calendar.wizard.close")}
            onClick={() => {
              clearCalendarWizardPending();
              onClose();
            }}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="do-skill-body">
          <aside className="do-skill-readiness">
            <span className="do-kicker">{t("calendar.wizard.progress")}</span>
            <h3>
              {t("calendar.wizard.stepOf")
                .replace("{current}", String(stepIndex + 1))
                .replace("{total}", String(CALENDAR_CONNECT_STEPS.length))}
            </h3>
            <p>{t("calendar.wizard.personalNote")}</p>
            <div>
              {CALENDAR_CONNECT_STEPS.map((id) => {
                const done = calendarConnectStepIndex(id) < stepIndex;
                const current = id === step;
                return (
                  <span className={done || current ? "is-done" : ""} key={id}>
                    {done ? <Check size={12} /> : <ChevronRight size={12} />}
                    {t(STEP_LABEL_KEYS[id])}
                  </span>
                );
              })}
            </div>
          </aside>

          <main className="do-skill-form">
            {step === "provider" ? (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--muted)]">{t("calendar.wizard.pickProvider")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      provider === "google"
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-soft,var(--surface-2))]"
                        : "border-[color:var(--border)] hover:bg-[color:var(--surface-2)]"
                    }`}
                    data-testid="calendar-wizard-provider-google"
                    onClick={() => setProvider("google")}
                    type="button"
                  >
                    <Cloud className="mb-2 h-5 w-5" />
                    <strong className="block text-sm">{t("calendar.wizard.google")}</strong>
                    <span className="text-xs text-[color:var(--muted)]">
                      {t("calendar.wizard.googleHint")}
                    </span>
                  </button>
                  <button
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      provider === "microsoft"
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-soft,var(--surface-2))]"
                        : "border-[color:var(--border)] hover:bg-[color:var(--surface-2)]"
                    }`}
                    data-testid="calendar-wizard-provider-outlook"
                    onClick={() => setProvider("microsoft")}
                    type="button"
                  >
                    <Mail className="mb-2 h-5 w-5" />
                    <strong className="block text-sm">{t("calendar.wizard.outlook")}</strong>
                    <span className="text-xs text-[color:var(--muted)]">
                      {t("calendar.wizard.outlookHint")}
                    </span>
                  </button>
                </div>
                {provider === "microsoft" ? (
                  <p className="text-sm text-amber-800" role="status">
                    {t("calendar.wizard.outlookSoonDetail")}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="rounded-xl border px-3 py-2 text-xs font-bold"
                    disabled={provider === "microsoft"}
                    onClick={() => setStep("authorize")}
                    type="button"
                  >
                    {t("calendar.wizard.continue")}
                  </button>
                </div>
              </div>
            ) : null}

            {step === "authorize" ? (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--muted)]">{t("calendar.wizard.authorizeBody")}</p>
                {!capabilitiesLoading && !googleConfigured ? (
                  <div
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900"
                    role="status"
                  >
                    <p className="font-medium">{t("calendar.wizard.platformPending")}</p>
                    <p className="mt-1 text-xs opacity-90">{t("calendar.wizard.platformPendingHint")}</p>
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm text-[color:var(--muted)]">
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                      {t("calendar.wizard.authorizeBullet1")}
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                      {t("calendar.wizard.authorizeBullet2")}
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                      {t("calendar.wizard.authorizeBullet3")}
                    </li>
                  </ul>
                )}
                {error ? (
                  <p className="text-sm text-red-700" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    className="rounded-xl border px-3 py-2 text-xs font-bold"
                    onClick={() => setStep("provider")}
                    type="button"
                  >
                    {t("calendar.wizard.back")}
                  </button>
                  <button
                    className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    data-testid="calendar-wizard-authorize"
                    disabled={busy || capabilitiesLoading || !googleConfigured}
                    onClick={() => void startAuthorize()}
                    type="button"
                  >
                    {busy || capabilitiesLoading ? t("calendar.connecting") : t("calendar.wizard.continueGoogle")}
                  </button>
                </div>
              </div>
            ) : null}

            {step === "calendars" ? (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--muted)]">{t("calendar.wizard.calendarsBody")}</p>
                {latestAccount ? (
                  <p className="text-sm font-medium">
                    {latestAccount.email || latestAccount.displayName}
                  </p>
                ) : (
                  <p className="text-sm text-amber-800">{t("calendar.wizard.waitingAccount")}</p>
                )}
                <ul className="space-y-2">
                  {accountCalendars.map((calendar) => (
                    <li
                      className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm"
                      key={calendar.id}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: calendar.color || "var(--accent)" }}
                      />
                      <span className="flex-1">{calendar.name}</span>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          checked={calendar.visible !== false}
                          onChange={(event) =>
                            void updateDoc(doc(db, "calendars", calendar.id), {
                              visible: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        {t("calendar.show")}
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    className="rounded-xl border px-3 py-2 text-xs font-bold"
                    onClick={() => setStep("authorize")}
                    type="button"
                  >
                    {t("calendar.wizard.back")}
                  </button>
                  <button
                    className="rounded-xl border px-3 py-2 text-xs font-bold"
                    disabled={!latestAccount}
                    onClick={goNext}
                    type="button"
                  >
                    {t("calendar.wizard.continue")}
                  </button>
                </div>
              </div>
            ) : null}

            {step === "privacy" ? (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--muted)]">{t("calendar.wizard.privacyBody")}</p>
                <ul className="space-y-2">
                  {accountCalendars.map((calendar) => (
                    <li
                      className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm"
                      key={calendar.id}
                    >
                      <span className="flex-1">{calendar.name}</span>
                      <select
                        className="rounded-lg border px-2 py-1 text-xs"
                        onChange={(event) =>
                          void updateDoc(doc(db, "calendars", calendar.id), {
                            privacy: event.target.value,
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
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    className="rounded-xl border px-3 py-2 text-xs font-bold"
                    onClick={() => setStep("calendars")}
                    type="button"
                  >
                    {t("calendar.wizard.back")}
                  </button>
                  <button
                    className="rounded-xl border px-3 py-2 text-xs font-bold"
                    onClick={goNext}
                    type="button"
                  >
                    {t("calendar.wizard.continue")}
                  </button>
                </div>
              </div>
            ) : null}

            {step === "done" ? (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--muted)]">{t("calendar.wizard.doneBody")}</p>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    className="rounded-xl border px-3 py-2 text-xs font-bold"
                    onClick={() => {
                      clearCalendarWizardPending();
                      onClose();
                    }}
                    type="button"
                  >
                    {t("calendar.wizard.close")}
                  </button>
                  <button
                    className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-2 text-xs font-bold text-white"
                    data-testid="calendar-wizard-finish"
                    onClick={() => void finish()}
                    type="button"
                  >
                    {t("calendar.wizard.openWeek")}
                  </button>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </section>
    </div>
  );
}
