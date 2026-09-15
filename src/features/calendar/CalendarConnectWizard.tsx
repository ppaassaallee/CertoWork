import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, Check, Cloud, Mail, X } from "../../components/ui/Icon";
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
  const canContinueProvider = provider === "google";

  const close = () => {
    clearCalendarWizardPending();
    onClose();
  };

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
        /* best-effort */
      }
    }
    clearCalendarWizardPending();
    onClose();
    onOpenWeek?.();
  };

  const primaryDisabled =
    (step === "provider" && !canContinueProvider) ||
    (step === "authorize" && (busy || capabilitiesLoading || !googleConfigured)) ||
    (step === "calendars" && !latestAccount) ||
    busy;

  const onPrimary = () => {
    if (step === "provider") {
      if (canContinueProvider) setStep("authorize");
      return;
    }
    if (step === "authorize") {
      void startAuthorize();
      return;
    }
    if (step === "calendars" || step === "privacy") {
      goNext();
      return;
    }
    if (step === "done") void finish();
  };

  const primaryLabel =
    step === "authorize"
      ? busy || capabilitiesLoading
        ? t("calendar.connecting")
        : t("calendar.wizard.continueGoogle")
      : step === "done"
        ? t("calendar.wizard.openWeek")
        : t("calendar.wizard.continue");

  return (
    <div
      aria-label={t("calendar.wizard.title")}
      aria-modal="true"
      className="do-skill-layer cw-cal-wizard-layer"
      data-testid="calendar-connect-wizard"
      role="dialog"
    >
      <section className="cw-cal-wizard">
        <header className="cw-cal-wizard-head">
          <div className="cw-cal-wizard-brand">
            <span className="cw-cal-wizard-icon" aria-hidden>
              <CalendarIcon size={18} />
            </span>
            <div className="cw-cal-wizard-titles">
              <small>{t("calendar.wizard.kicker")}</small>
              <h2>{t("calendar.wizard.title")}</h2>
              <p>{t("calendar.wizard.summaryShort")}</p>
            </div>
          </div>
          <button
            aria-label={t("calendar.wizard.close")}
            className="cw-cal-wizard-close"
            onClick={close}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <nav aria-label={t("calendar.wizard.progress")} className="cw-cal-wizard-steps">
          {CALENDAR_CONNECT_STEPS.map((id, index) => {
            const done = index < stepIndex;
            const current = id === step;
            return (
              <div
                className={`cw-cal-wizard-step${done ? " is-done" : ""}${current ? " is-current" : ""}`}
                key={id}
              >
                <span className="cw-cal-wizard-step-dot" aria-hidden>
                  {done ? <Check size={11} /> : index + 1}
                </span>
                <span className="cw-cal-wizard-step-label">{t(STEP_LABEL_KEYS[id])}</span>
              </div>
            );
          })}
        </nav>

        <div className="cw-cal-wizard-body">
          {step === "provider" ? (
            <div className="cw-cal-wizard-panel">
              <h3>{t("calendar.wizard.pickProvider")}</h3>
              <p className="cw-cal-wizard-note">{t("calendar.wizard.personalNoteShort")}</p>
              <div className="cw-cal-wizard-providers">
                <button
                  className={`cw-cal-wizard-card${provider === "google" ? " is-selected" : ""}`}
                  data-testid="calendar-wizard-provider-google"
                  onClick={() => setProvider("google")}
                  onDoubleClick={() => setStep("authorize")}
                  type="button"
                >
                  <Cloud size={20} />
                  <strong>{t("calendar.wizard.google")}</strong>
                  <span>{t("calendar.wizard.googleHint")}</span>
                </button>
                <button
                  className={`cw-cal-wizard-card${provider === "microsoft" ? " is-selected" : ""} is-soon`}
                  data-testid="calendar-wizard-provider-outlook"
                  onClick={() => setProvider("microsoft")}
                  type="button"
                >
                  <Mail size={20} />
                  <strong>{t("calendar.wizard.outlook")}</strong>
                  <span>{t("calendar.wizard.outlookHint")}</span>
                </button>
              </div>
              {provider === "microsoft" ? (
                <p className="cw-cal-wizard-banner" role="status">
                  {t("calendar.wizard.outlookSoonDetail")}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "authorize" ? (
            <div className="cw-cal-wizard-panel">
              <h3>{t("calendar.wizard.stepAuthorize")}</h3>
              <p>{t("calendar.wizard.authorizeBody")}</p>
              {!capabilitiesLoading && !googleConfigured ? (
                <div className="cw-cal-wizard-banner is-warn" role="status">
                  <strong>{t("calendar.wizard.platformPending")}</strong>
                  <span>{t("calendar.wizard.platformPendingHint")}</span>
                </div>
              ) : (
                <ul className="cw-cal-wizard-bullets">
                  <li>
                    <Check size={14} />
                    {t("calendar.wizard.authorizeBullet1")}
                  </li>
                  <li>
                    <Check size={14} />
                    {t("calendar.wizard.authorizeBullet2")}
                  </li>
                  <li>
                    <Check size={14} />
                    {t("calendar.wizard.authorizeBullet3")}
                  </li>
                </ul>
              )}
              {error ? (
                <p className="cw-cal-wizard-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "calendars" ? (
            <div className="cw-cal-wizard-panel">
              <h3>{t("calendar.wizard.stepCalendars")}</h3>
              <p>{t("calendar.wizard.calendarsBody")}</p>
              {latestAccount ? (
                <p className="cw-cal-wizard-account">
                  {latestAccount.email || latestAccount.displayName}
                </p>
              ) : (
                <p className="cw-cal-wizard-banner is-warn" role="status">
                  {t("calendar.wizard.waitingAccount")}
                </p>
              )}
              <ul className="cw-cal-wizard-list">
                {accountCalendars.map((calendar) => (
                  <li key={calendar.id}>
                    <span
                      className="cw-cal-wizard-dot"
                      style={{ background: calendar.color || "var(--accent)" }}
                    />
                    <span className="cw-cal-wizard-list-name">{calendar.name}</span>
                    <label>
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
            </div>
          ) : null}

          {step === "privacy" ? (
            <div className="cw-cal-wizard-panel">
              <h3>{t("calendar.wizard.stepPrivacy")}</h3>
              <p>{t("calendar.wizard.privacyBody")}</p>
              <ul className="cw-cal-wizard-list">
                {accountCalendars.map((calendar) => (
                  <li key={calendar.id}>
                    <span className="cw-cal-wizard-list-name">{calendar.name}</span>
                    <select
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
            </div>
          ) : null}

          {step === "done" ? (
            <div className="cw-cal-wizard-panel">
              <h3>{t("calendar.wizard.stepDone")}</h3>
              <p>{t("calendar.wizard.doneBody")}</p>
            </div>
          ) : null}
        </div>

        <footer className="cw-cal-wizard-foot">
          {step === "provider" || step === "done" ? (
            <button className="cw-cal-wizard-btn" onClick={close} type="button">
              {t("calendar.wizard.close")}
            </button>
          ) : (
            <button
              className="cw-cal-wizard-btn"
              onClick={() =>
                setStep(
                  step === "authorize"
                    ? "provider"
                    : step === "calendars"
                      ? "authorize"
                      : "calendars",
                )
              }
              type="button"
            >
              {t("calendar.wizard.back")}
            </button>
          )}
          <button
            className="cw-cal-wizard-btn is-primary"
            data-testid={step === "authorize" ? "calendar-wizard-authorize" : "calendar-wizard-continue"}
            disabled={primaryDisabled}
            onClick={onPrimary}
            type="button"
          >
            {primaryLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
