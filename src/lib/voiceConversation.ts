import { actionLabel } from "./delivereeRoutes";
import { proposalActionTitle } from "./workspaceDisplay";

export type VoiceCallPhase =
  | "listening"
  | "paused"
  | "wrapping"
  | "review"
  | "applying"
  | "done";

export type VoicePendingAction = {
  id: string;
  type: string;
  title: string;
  reason?: string;
  action: any;
  selected: boolean;
};

const BANNED_VOICES =
  /fred|albert|bells|boing|bubbles|cellos|bad news|good news|zarvox|trinoids|whisper|junior|kathy|princess|ralph|organ|superstar/i;

const PREFERRED_VOICES = [
  /samantha/i,
  /ava/i,
  /nicky/i,
  /aria/i,
  /jenny/i,
  /google us english/i,
  /google uk english female/i,
  /siri/i,
  /zoe/i,
  /karen/i,
  /moira/i,
  /stephanie/i,
  /natural/i,
  /premium/i,
  /enhanced/i,
  /neural/i,
];

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

export function pickNaturalVoice(
  voices: Array<{ name?: string; lang?: string; localService?: boolean }> = [],
  lang = "en",
) {
  const english = voices.filter((voice) =>
    String(voice.lang || "").toLowerCase().startsWith("en"),
  );
  const pool = english.length ? english : voices;
  const wanted = lang.toLowerCase().slice(0, 2);
  const ranked = pool
    .filter((voice) => !BANNED_VOICES.test(String(voice.name || "")))
    .map((voice, index) => {
      const name = String(voice.name || "");
      let score = 0;
      PREFERRED_VOICES.forEach((pattern, rank) => {
        if (pattern.test(name)) score += 80 - rank;
      });
      if (voice.localService) score += 10;
      if (String(voice.lang || "").toLowerCase().startsWith(wanted)) score += 8;
      if (/female|samantha|ava|nicky|aria|jenny/i.test(name)) score += 4;
      return { voice, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return ranked[0]?.voice || pool[0] || voices[0] || null;
}

export function loadSpeechVoices(
  host: { speechSynthesis?: SpeechSynthesis } = typeof window === "undefined" ? {} : window,
): Promise<SpeechSynthesisVoice[]> {
  const synth = host.speechSynthesis;
  if (!synth) return Promise.resolve([]);
  const existing = synth.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const finish = () => resolve(synth.getVoices());
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", finish, { once: true });
    } else {
      synth.onvoiceschanged = finish;
    }
    setTimeout(finish, 900);
  });
}

export function finalSpeechFromEvent(event: {
  resultIndex?: number;
  results?: ArrayLike<{ isFinal?: boolean; 0?: { transcript?: string } }>;
}) {
  const results = event?.results;
  if (!results) return { interim: "", finals: [] as string[] };
  const start = Number(event.resultIndex || 0);
  const finals: string[] = [];
  let interim = "";
  for (let index = start; index < results.length; index += 1) {
    const piece = String(results[index]?.[0]?.transcript || "").trim();
    if (!piece) continue;
    if (results[index]?.isFinal) finals.push(piece);
    else interim = `${interim} ${piece}`.trim();
  }
  return { interim, finals };
}

export function joinVoiceNotes(notes: string[]) {
  return notes
    .map((note) => String(note || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function buildVoiceWrapUpMessage(transcript: string) {
  const captured = String(transcript || "").trim();
  return [
    "VOICE WRAP-UP. The live conversation ended. You were a quiet assistant taking notes, not an interviewer.",
    "Read the transcript carefully. Recap what you heard in 2-4 spoken sentences.",
    "Say if anything sounded incomplete or cut off.",
    "Then create an actionPlan: one create_task for each concrete next action (or update_task when it clearly matches an existing task).",
    "Set timeSector to today, this-week, or later. Keep titles as clear verbs.",
    "Do not ask a list of questions. At most one clarifying question if a required fact is missing for every item.",
    "Never claim the tasks were already created.",
    captured ? `Transcript:\n${captured}` : "Transcript: (empty — I did not catch any speech.)",
  ].join(" ");
}

export function collectVoiceActions(
  plans: Array<{ proposedActions?: any[] } | null | undefined>,
  projects: any[] = [],
  fallbackProject: any | null = null,
): VoicePendingAction[] {
  const actions: VoicePendingAction[] = [];
  for (const [planIndex, plan] of plans.entries()) {
    for (const [actionIndex, action] of (plan?.proposedActions || []).entries()) {
      actions.push({
        id: `${planIndex}-${actionIndex}-${String(action?.type || "action")}`,
        type: actionLabel(action?.type),
        title: proposalActionTitle(action, projects, fallbackProject),
        reason: String(action?.reason || "").trim() || undefined,
        action,
        selected: true,
      });
    }
  }
  return actions;
}

export function planFromSelectedActions(pending: VoicePendingAction[]) {
  const proposedActions = pending
    .filter((item) => item.selected && item.action)
    .map((item) => item.action);
  if (!proposedActions.length) return null;
  return {
    title: "Voice conversation",
    summary: "Tasks captured from the Odysseus voice conversation.",
    riskLevel: "low",
    proposedActions,
  };
}

export function createSpeechRecognition(lang = "en-US"): any | null {
  if (typeof window === "undefined") return null;
  const Recognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;
  recognition.maxAlternatives = 1;
  return recognition;
}

export function preferredRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export async function transcribeVoiceAudio({
  token,
  userId,
  blob,
}: {
  token: string;
  userId: string;
  blob: Blob;
}) {
  if (!blob || blob.size < 80) return "";
  const form = new FormData();
  form.append("userId", userId);
  const extension = blob.type.includes("mp4") ? "m4a" : "webm";
  form.append("file", blob, `odysseus-voice.${extension}`);
  const response = await fetch("/api/voice/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "The recording could not be transcribed.");
  }
  return String(payload?.text || "").trim();
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
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearInterval(keepAlive);
      window.clearTimeout(watchdog);
      resolve();
    };
    const keepAlive = window.setInterval(() => {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 4000);
    const watchdog = window.setTimeout(finish, Math.min(20_000, 900 + spoken.length * 70));
    void loadSpeechVoices().then((voices) => {
      if (settled) return;
      const utterance = new SpeechSynthesisUtterance(spoken);
      const voice = pickNaturalVoice(voices, "en") as SpeechSynthesisVoice | null;
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "en-US";
      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume();
    });
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export const VOICE_GREETING = "I'm listening. Talk it through — I'll take notes.";
