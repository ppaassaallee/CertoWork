import { actionLabel } from "./delivereeRoutes";
import { proposalActionTitle } from "./workspaceDisplay";

export type VoiceCallPhase =
  | "listening"
  | "paused"
  | "thinking"
  | "speaking"
  | "review"
  | "applying"
  | "done";

export type VoicePendingAction = {
  type: string;
  title: string;
  reason?: string;
};

export function speechRecognitionSupported(
  host: { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown } = globalThis as any,
) {
  return Boolean(host?.SpeechRecognition || host?.webkitSpeechRecognition);
}

export function speechSynthesisSupported(
  host: { speechSynthesis?: unknown } = globalThis as any,
) {
  return Boolean(host?.speechSynthesis);
}

export function spokenReplyText(markdown: string) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>]+/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_200);
}

export function collectVoiceActions(
  plans: Array<{ proposedActions?: any[] } | null | undefined>,
  projects: any[] = [],
  fallbackProject: any | null = null,
): VoicePendingAction[] {
  const actions: VoicePendingAction[] = [];
  for (const plan of plans) {
    for (const action of plan?.proposedActions || []) {
      actions.push({
        type: actionLabel(action?.type),
        title: proposalActionTitle(action, projects, fallbackProject),
        reason: String(action?.reason || "").trim() || undefined,
      });
    }
  }
  return actions;
}

export function createSpeechRecognition(lang = "en-US"): any | null {
  if (typeof window === "undefined") return null;
  const Recognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = lang;
  recognition.maxAlternatives = 1;
  return recognition;
}

export function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const spoken = spokenReplyText(text);
    window.speechSynthesis.cancel();
    if (!spoken) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = "en-US";
    utterance.rate = 1.02;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export const VOICE_GREETING =
  "I'm listening. Tell me what to capture, change, or move on your tasks and projects.";
