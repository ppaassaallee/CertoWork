import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  X,
} from "../ui/Icon";
import { OdysseusMark } from "./OdysseusMark";
import { OdysseusWorkLog, type OdysseusRunStep } from "./OdysseusWork";
import {
  collectVoiceActions,
  createSpeechRecognition,
  finalSpeechFromEvent,
  joinVoiceNotes,
  planFromSelectedActions,
  preferredRecorderMime,
  speakText,
  speechRecognitionSupported,
  stopSpeaking,
  VOICE_GREETING,
  type VoiceCallPhase,
  type VoicePendingAction,
} from "../../lib/voiceConversation";

export type VoiceTurnResult = {
  reply: string;
  actionPlan?: any;
} | null;

export function OdysseusVoiceCall({
  open,
  projects = [],
  activeProject = null,
  liveSteps = [],
  onClose,
  onTranscribe,
  onWrapUp,
  onApplyPlans,
}: {
  open: boolean;
  projects?: any[];
  activeProject?: any | null;
  liveSteps?: OdysseusRunStep[];
  onClose: () => void;
  onTranscribe?: (blob: Blob) => Promise<string>;
  onWrapUp: (transcript: string) => Promise<VoiceTurnResult>;
  onApplyPlans: (plans: any[]) => Promise<number>;
}) {
  const [phase, setPhase] = useState<VoiceCallPhase>("listening");
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [appliedCount, setAppliedCount] = useState(0);
  const [pending, setPending] = useState<VoicePendingAction[]>([]);
  const phaseRef = useRef<VoiceCallPhase>("listening");
  const notesRef = useRef<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const openRef = useRef(false);
  const startingRef = useRef(false);
  const wrappingRef = useRef(false);
  const wrapUpRef = useRef(onWrapUp);
  const transcribeRef = useRef(onTranscribe);
  const applyPlansRef = useRef(onApplyPlans);
  wrapUpRef.current = onWrapUp;
  transcribeRef.current = onTranscribe;
  applyPlansRef.current = onApplyPlans;

  const setCallPhase = (next: VoiceCallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* already stopped */
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    const stream = streamRef.current;
    recorderRef.current = null;
    streamRef.current = null;
    return new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        stream?.getTracks().forEach((track) => track.stop());
        const chunks = chunksRef.current;
        chunksRef.current = [];
        resolve(chunks.length ? new Blob(chunks, { type: recorder?.mimeType || chunks[0]?.type || "audio/webm" }) : null);
        return;
      }
      recorder.onstop = () => {
        stream?.getTracks().forEach((track) => track.stop());
        const chunks = chunksRef.current;
        chunksRef.current = [];
        resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || "audio/webm" }) : null);
      };
      try {
        recorder.stop();
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        resolve(null);
      }
    });
  };

  const listen = () => {
    if (!openRef.current || phaseRef.current !== "listening") return;
    const recognition = recognitionRef.current;
    if (!recognition || startingRef.current) return;
    startingRef.current = true;
    setError("");
    try {
      recognition.start();
    } catch {
      startingRef.current = false;
    }
  };

  const appendNotes = (pieces: string[]) => {
    const next = [...notesRef.current];
    for (const piece of pieces) {
      const text = piece.replace(/\s+/g, " ").trim();
      if (!text) continue;
      if (next[next.length - 1] === text) continue;
      next.push(text);
    }
    if (next.length === notesRef.current.length) return;
    notesRef.current = next;
    setNotes(next);
    setHeard(next[next.length - 1] || "");
  };

  useEffect(() => {
    openRef.current = open;
    if (!open) {
      wrappingRef.current = false;
      stopSpeaking();
      stopListening();
      void stopRecording();
      setCallPhase("listening");
      setInterim("");
      setHeard("");
      setNotes([]);
      notesRef.current = [];
      setReply("");
      setError("");
      setAppliedCount(0);
      setPending([]);
      return;
    }

    setReply(VOICE_GREETING);
    setCallPhase("listening");

    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled || !openRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (typeof MediaRecorder === "undefined") return;
        const mime = preferredRecorderMime();
        const recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data?.size) chunksRef.current.push(event.data);
        };
        try {
          recorder.start(4000);
        } catch {
          recorder.start();
        }
        recorderRef.current = recorder;
      } catch {
        if (!cancelled) {
          setError("Microphone access is blocked. Allow the mic, then try again.");
        }
      }
    })();

    if (speechRecognitionSupported()) {
      const recognition = createSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        recognition.onstart = () => {
          startingRef.current = false;
        };
        recognition.onend = () => {
          startingRef.current = false;
          if (openRef.current && phaseRef.current === "listening") {
            window.setTimeout(() => listen(), 160);
          }
        };
        recognition.onerror = (event: any) => {
          startingRef.current = false;
          const code = String(event?.error || "");
          if (code === "not-allowed" || code === "service-not-allowed") {
            setError("Microphone access is blocked. Allow the mic, then try again.");
            return;
          }
          if (openRef.current && phaseRef.current === "listening" && code !== "aborted") {
            window.setTimeout(() => listen(), 240);
          }
        };
        recognition.onresult = (event: any) => {
          if (phaseRef.current !== "listening") return;
          const { interim: live, finals } = finalSpeechFromEvent(event);
          setInterim(live);
          if (finals.length) appendNotes(finals);
        };
        listen();
      }
    }

    return () => {
      cancelled = true;
      stopSpeaking();
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      void stopRecording();
    };
  }, [open]);

  const endCall = async () => {
    if (wrappingRef.current) return;
    wrappingRef.current = true;
    stopSpeaking();
    stopListening();
    setCallPhase("wrapping");
    setInterim("");
    setError("");
    const recording = await stopRecording();
    let transcript = joinVoiceNotes(notesRef.current);
    if (recording && transcribeRef.current) {
      try {
        const recorded = await transcribeRef.current(recording);
        if (recorded) {
          transcript = recorded;
          notesRef.current = recorded
            .split(/(?<=[.!?])\s+/)
            .map((item) => item.trim())
            .filter(Boolean);
          setNotes(notesRef.current);
        }
      } catch (reason) {
        if (!transcript) {
          setError(
            reason instanceof Error
              ? reason.message
              : "I could not transcribe the recording.",
          );
        }
      }
    }
    if (!openRef.current) return;
    if (!transcript) {
      const message = "I didn't catch any speech. Check the microphone, then talk again.";
      setReply(message);
      setPending([]);
      setCallPhase("review");
      await speakText(message);
      return;
    }
    try {
      const result = await wrapUpRef.current(transcript);
      if (!openRef.current) return;
      const nextReply =
        result?.reply ||
        "I captured your notes. Review each task before anything is added.";
      const nextPending = collectVoiceActions(
        result?.actionPlan ? [result.actionPlan] : [],
        projects,
        activeProject,
      );
      setReply(nextReply);
      setPending(nextPending);
      setCallPhase("review");
      await speakText(nextReply);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "I captured notes but could not build the action plan.";
      setError(message);
      setReply(message);
      setPending([]);
      setCallPhase("review");
    }
  };

  const apply = async () => {
    const plan = planFromSelectedActions(pending);
    if (!plan) {
      onClose();
      return;
    }
    setCallPhase("applying");
    try {
      const count = await applyPlansRef.current([plan]);
      setAppliedCount(count);
      setCallPhase("done");
      await speakText(
        count > 0
          ? `Done. I added ${count} task${count === 1 ? "" : "s"} after your approval.`
          : "Done. Nothing was applied.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Those updates could not be applied.",
      );
      setCallPhase("review");
    }
  };

  if (!open) return null;

  const status =
    phase === "listening"
      ? "Listening — taking notes"
      : phase === "paused"
        ? "Paused"
        : phase === "wrapping"
          ? "Checking what I captured"
          : phase === "review"
            ? "Approve each task"
            : phase === "applying"
              ? "Adding approved tasks"
              : "Updates applied";

  const reviewing = phase === "wrapping" || phase === "review" || phase === "applying" || phase === "done";

  return (
    <div className="odiseus-voice-scrim" role="dialog" aria-label="Talk with Odysseus" data-testid="odiseus-voice-call">
      <div className="odiseus-voice-call">
        <header>
          <div>
            <OdysseusMark size="sm" />
            <strong>Talk with Odysseus</strong>
          </div>
          <button aria-label="Close voice conversation" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        <div className={`odiseus-voice-orb is-${phase}`} aria-hidden="true">
          <OdysseusMark size="lg" />
        </div>
        <p className="odiseus-voice-status">{status}</p>

        {error ? <p className="odiseus-voice-error" role="alert">{error}</p> : null}

        {!reviewing ? (
          <>
            <p className="odiseus-voice-heard">
              {interim || heard || "Talk. I’ll listen and take notes — no interview."}
            </p>
            {notes.length > 0 ? (
              <ul className="odiseus-voice-notes" data-testid="odiseus-voice-notes">
                {notes.map((note, index) => (
                  <li key={`${index}-${note.slice(0, 24)}`}>{note}</li>
                ))}
              </ul>
            ) : null}
            {reply ? <p className="odiseus-voice-reply">{reply}</p> : null}
            <div className="odiseus-voice-actions">
              {phase === "listening" ? (
                <button
                  className="is-listening"
                  onClick={() => {
                    setCallPhase("paused");
                    stopListening();
                  }}
                  type="button"
                >
                  <MicOff size={16} />
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCallPhase("listening");
                    listen();
                  }}
                  type="button"
                >
                  <Mic size={16} />
                  Resume
                </button>
              )}
              <button className="is-end" onClick={() => void endCall()} type="button">
                <PhoneOff size={16} />
                End conversation
              </button>
            </div>
          </>
        ) : (
          <div className="odiseus-voice-review">
            {phase === "wrapping" ? (
              <>
                <p className="odiseus-voice-reply">Checking the notes against what you said…</p>
                <OdysseusWorkLog steps={liveSteps} working />
              </>
            ) : phase === "done" ? (
              <p className="odiseus-voice-reply">
                {appliedCount > 0
                  ? `Added ${appliedCount} task${appliedCount === 1 ? "" : "s"} after you approved each one.`
                  : "Nothing needed applying."}
              </p>
            ) : (
              <>
                <p className="odiseus-voice-reply">
                  {reply || "Approve each task. Nothing is added until you confirm it."}
                </p>
                {notes.length > 0 ? (
                  <p className="odiseus-voice-pending">
                    Captured {notes.length} note{notes.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                {pending.length ? (
                  <ul>
                    {pending.map((action) => (
                      <li key={action.id}>
                        <label>
                          <input
                            checked={action.selected}
                            disabled={phase === "applying"}
                            onChange={() =>
                              setPending((current) =>
                                current.map((item) =>
                                  item.id === action.id
                                    ? { ...item, selected: !item.selected }
                                    : item,
                                ),
                              )
                            }
                            type="checkbox"
                          />
                          <span>
                            <strong>{action.type}</strong>
                            {action.title}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="odiseus-voice-pending">No tasks to add from what I captured.</p>
                )}
              </>
            )}
            <div className="odiseus-voice-actions">
              {phase === "done" ? (
                <button className="is-primary" onClick={onClose} type="button">
                  Close
                </button>
              ) : phase === "wrapping" ? (
                <button disabled type="button">
                  <Loader2 className="spin" size={16} />
                  Wrapping up
                </button>
              ) : (
                <>
                  <button disabled={phase === "applying"} onClick={onClose} type="button">
                    Discard
                  </button>
                  <button
                    className="is-primary"
                    disabled={phase === "applying" || pending.every((item) => !item.selected)}
                    onClick={() => void apply()}
                    type="button"
                  >
                    {phase === "applying" ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                    Apply selected
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
