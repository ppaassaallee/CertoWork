export type SignalKind = "send" | "follow-up" | "risk" | "billing" | "approval";

export type SignalAction = {
  label: string;
  type: "draft-email" | "open" | "mark-paid" | "send-reminder" | "dismiss" | "snooze";
  payload?: Record<string, unknown>;
};

export type Signal = {
  id: string;
  uid: string;
  workspaceId: string;
  kind: SignalKind;
  title: string;
  body: string;
  severity: "info" | "warn" | "bad";
  entityKey: string;
  actions: SignalAction[];
  createdAt: unknown;
  dismissedAt?: unknown | null;
  snoozedUntil?: unknown | null;
};
