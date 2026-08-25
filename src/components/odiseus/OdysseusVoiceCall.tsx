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
  onSendTurn,
  onApplyPlans,
}: {
  open: boolean;
  projects?: any[];
  activeProject?: any | null;
  liveSteps?: OdysseusRunStep[];
  onClose: () => void;
  onSendTurn: (text: string) => Promise<VoiceTurnResult>;
  onApplyPlans: (plans: any[]) => Promise<number>;
}) {
  const [phase, setPhase] = useState<VoiceCallPhase>("listening");
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [appliedCount, setAppliedCount] = useState(0);
  const [pending, setPending] = useState<VoicePendingAction[]>([]);
  const plansRef = useRef<any[]>([]);
  const phaseRef = useRef<VoiceCallPhase>("listening");
  const recognitionRef = useRef<any>(null);
  const openRef = useRef(false);
  const startingRef = useRef(false);
  const sendTurnRef = useRef(onSendTurn);
  const applyPlansRef = useRef(onApplyPlans);
  sendTurnRef.current = onSendTurn;
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

  const listen = () => {
    if (!openRef.current || phaseRef.current !== "listening") return;
    const recognition = recognitionRef.current;
    if (!recognition || startingRef.current) return;
    startingRef.current = true;
    setInterim("");
    setError("");
    try {
      recognition.start();
    } catch {
      startingRef.current = false;
    }
  };

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    openRef.current = open;
    if (!open) {
      stopSpeaking();
      stopListening();
      setCallPhase("listening");
      setInterim("");
      setHeard("");
      setReply("");
      setError("");
      setAppliedCount(0);
      setPending([]);
      plansRef.current = [];
      return;
    }

    if (!speechRecognitionSupported()) {
      setError("Voice conversation needs Chrome, Edge, or Safari, with microphone access.");
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) {
      setError("This browser cannot start a voice conversation.");
      return;
    }
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      startingRef.current = false;
    };
    recognition.onend = () => {
      startingRef.current = false;
      if (openRef.current && phaseRef.current === "listening") {
        window.setTimeout(() => listen(), 180);
      }
    };
    recognition.onerror = (event: any) => {
      startingRef.current = false;
      const code = String(event?.error || "");
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone access is blocked. Allow the mic, then try again.");
        setCallPhase("review");
        return;
      }
      if (openRef.current && phaseRef.current === "listening" && code !== "aborted") {
        window.setTimeout(() => listen(), 280);
      }
    };
    recognition.onresult = (event: any) => {
      const pieces = Array.from(event.results || []) as Array<{ isFinal?: boolean; 0?: { transcript?: string } }>;
      const live = pieces.map((result) => result[0]?.transcript || "").join(" ").trim();
      setInterim(live);
      const last = pieces[pieces.length - 1];
      if (!last?.isFinal) return;
      const transcript = live;
      if (!transcript) return;
      void handleTurn(transcript);
    };

    setCallPhase("speaking");
    void (async () => {
      setReply(VOICE_GREETING);
      await speakText(VOICE_GREETING);
      if (!openRef.current) return;
      setCallPhase("listening");
      listen();
    })();

    return () => {
      stopSpeaking();
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
    // Mount/unmount with open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleTurn = async (transcript: string) => {
    if (phaseRef.current !== "listening") return;
    stopListening();
    setHeard(transcript);
    setInterim("");
    setCallPhase("thinking");
    try {
      const result = await sendTurnRef.current(transcript);
      const nextReply =
        result?.reply ||
        "I heard you, but I could not complete that turn. Nothing was changed.";
      if (result?.actionPlan?.proposedActions?.length) {
        plansRef.current = [...plansRef.current, result.actionPlan];
        setPending(collectVoiceActions(plansRef.current, projects, activeProject));
      }
      setReply(nextReply);
      if (!openRef.current) return;
      setCallPhase("speaking");
      await speakText(nextReply);
      if (!openRef.current) return;
      setCallPhase("listening");
      listen();
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "I could not complete that turn. Nothing was changed.";
      setError(message);
      setReply(message);
      if (!openRef.current) return;
      setCallPhase("speaking");
      await speakText(message);
      if (!openRef.current) return;
      setCallPhase("listening");
      listen();
    }
  };

  const endCall = () => {
    stopSpeaking();
    stopListening();
    if (plansRef.current.some((plan) => plan?.proposedActions?.length)) {
      setPending(collectVoiceActions(plansRef.current, projects, activeProject));
      setCallPhase("review");
      return;
    }
    onClose();
  };

  const apply = async () => {
    setCallPhase("applying");
    try {
      const count = await applyPlansRef.current(plansRef.current);
      setAppliedCount(count);
      setCallPhase("done");
      await speakText(
        count > 0
          ? `Done. I applied ${count} update${count === 1 ? "" : "s"}.`
          : "Done. There was nothing to apply.",
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
      ? "Listening"
      : phase === "paused"
        ? "Paused"
        : phase === "thinking"
        ? "Odysseus is working"
        : phase === "speaking"
          ? "Odysseus is speaking"
          : phase === "review"
            ? "Ready to apply updates"
            : phase === "applying"
              ? "Applying updates"
              : "Updates applied";

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

        {phase !== "review" && phase !== "applying" && phase !== "done" ? (
          <>
            <p className="odiseus-voice-heard">
              {interim || heard || "Say what should change on a task or project."}
            </p>
            {reply ? <p className="odiseus-voice-reply">{reply}</p> : null}
            <OdysseusWorkLog steps={liveSteps} working={phase === "thinking"} />
            {pending.length > 0 ? (
              <p className="odiseus-voice-pending">
                {pending.length} change{pending.length === 1 ? "" : "s"} ready when you hang up
              </p>
            ) : null}
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
                  disabled={phase === "thinking" || phase === "speaking"}
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
              <button className="is-end" onClick={endCall} type="button">
                <PhoneOff size={16} />
                End conversation
              </button>
            </div>
          </>
        ) : (
          <div className="odiseus-voice-review">
            {phase === "done" ? (
              <p className="odiseus-voice-reply">
                {appliedCount > 0
                  ? `Applied ${appliedCount} update${appliedCount === 1 ? "" : "s"} to your workspace.`
                  : "Nothing needed applying."}
              </p>
            ) : (
              <>
                <p className="odiseus-voice-reply">
                  Odysseus will apply these updates now. Nothing changes until you confirm.
                </p>
                <ul>
                  {pending.map((action, index) => (
                    <li key={`${action.type}-${index}`}>
                      <Check size={12} />
                      <span>
                        <strong>{action.type}</strong>
                        {action.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="odiseus-voice-actions">
              {phase === "done" ? (
                <button className="is-primary" onClick={onClose} type="button">
                  Close
                </button>
              ) : (
                <>
                  <button disabled={phase === "applying"} onClick={onClose} type="button">
                    Discard
                  </button>
                  <button
                    className="is-primary"
                    disabled={phase === "applying" || pending.length === 0}
                    onClick={() => void apply()}
                    type="button"
                  >
                    {phase === "applying" ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                    Apply updates
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
