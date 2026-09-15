/**
 * Calendar Connect wizard — personal provider onboarding (Google live, Outlook next).
 * Platform OAuth client secrets are one-time ops; end users only walk this wizard.
 */

export type CalendarConnectProvider = "google" | "microsoft";

export type CalendarConnectStep =
  | "provider"
  | "authorize"
  | "calendars"
  | "privacy"
  | "done";

export const CALENDAR_CONNECT_STEPS: CalendarConnectStep[] = [
  "provider",
  "authorize",
  "calendars",
  "privacy",
  "done",
];

export const CALENDAR_WIZARD_STORAGE_KEY = "certo.calendarConnectWizard";

export function calendarConnectStepIndex(step: CalendarConnectStep): number {
  return CALENDAR_CONNECT_STEPS.indexOf(step);
}

export function nextCalendarConnectStep(step: CalendarConnectStep): CalendarConnectStep | null {
  const index = calendarConnectStepIndex(step);
  if (index < 0 || index >= CALENDAR_CONNECT_STEPS.length - 1) return null;
  return CALENDAR_CONNECT_STEPS[index + 1]!;
}

export function markCalendarWizardPending(provider: CalendarConnectProvider): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    CALENDAR_WIZARD_STORAGE_KEY,
    JSON.stringify({ provider, at: Date.now() }),
  );
}

export function peekCalendarWizardPending(): { provider: CalendarConnectProvider } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CALENDAR_WIZARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { provider?: string };
    if (parsed.provider === "google" || parsed.provider === "microsoft") {
      return { provider: parsed.provider };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function consumeCalendarWizardPending(): { provider: CalendarConnectProvider } | null {
  const pending = peekCalendarWizardPending();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(CALENDAR_WIZARD_STORAGE_KEY);
  }
  return pending;
}

export function clearCalendarWizardPending(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(CALENDAR_WIZARD_STORAGE_KEY);
}
