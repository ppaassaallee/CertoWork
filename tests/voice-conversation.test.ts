import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildVoiceWrapUpMessage,
  collectVoiceActions,
  finalSpeechFromEvent,
  firestorePermissionMessage,
  joinVoiceNotes,
  pickNaturalVoice,
  planFromSelectedActions,
  spokenReplyText,
  speechRecognitionSupported,
  VOICE_GREETING,
} from "../src/lib/voiceConversation";
import worker, { assistantInstructions } from "../worker/index.js";

test("spoken Odysseus replies drop markdown so TTS stays natural", () => {
  assert.equal(
    spokenReplyText("**Done.** I will update [FieldOps](https://certo.work) and create a task."),
    "Done. I will update FieldOps and create a task.",
  );
  assert.match(spokenReplyText("# Status\n- Ship the report"), /Ship the report/);
});

test("natural voice prefers Samantha or Google over novelty voices", () => {
  const voice = pickNaturalVoice([
    { name: "Fred", lang: "en-US", localService: true },
    { name: "Google US English", lang: "en-US", localService: false },
    { name: "Samantha", lang: "en-US", localService: true },
    { name: "Zarvox", lang: "en-US", localService: true },
  ]);
  assert.equal(voice?.name, "Samantha");
});

test("speech result events keep live captions and only commit finals", () => {
  const event = {
    resultIndex: 1,
    results: [
      { isFinal: true, 0: { transcript: "old" } },
      { isFinal: true, 0: { transcript: "Call the lawyer" } },
      { isFinal: false, 0: { transcript: " about the" } },
    ],
  };
  const parsed = finalSpeechFromEvent(event);
  assert.deepEqual(parsed.finals, ["Call the lawyer"]);
  assert.equal(parsed.interim, "about the");
});

test("voice wrap-up asks Odysseus to recap, flag gaps, and create tasks", () => {
  const message = buildVoiceWrapUpMessage("Call the lawyer. Block time for the deck.");
  assert.match(message, /VOICE WRAP-UP/);
  assert.match(message, /quiet assistant taking notes/);
  assert.match(message, /create_task/);
  assert.match(message, /Call the lawyer/);
  assert.equal(joinVoiceNotes(["  Call the lawyer. ", "", "Block time"]), "Call the lawyer. Block time");
});

test("Firestore permission errors stay actionable instead of raw SDK text", () => {
  assert.match(
    firestorePermissionMessage(new Error("Missing or insufficient permissions.")),
    /couldn't save that task/i,
  );
});

test("selected voice actions become the plan that can be applied", () => {
  const actions = collectVoiceActions([
    {
      proposedActions: [
        {
          type: "create_task",
          proposedChange: { title: "Call the lawyer", timeSector: "today" },
        },
        {
          type: "create_task",
          proposedChange: { title: "Skip this one" },
        },
      ],
    },
  ]);
  assert.equal(actions.length, 2);
  assert.equal(actions[0].selected, true);
  actions[1].selected = false;
  const plan = planFromSelectedActions(actions);
  assert.equal(plan?.proposedActions.length, 1);
  assert.equal(plan?.proposedActions[0].proposedChange.title, "Call the lawyer");
});

test("voice conversation is wired as a listener with wrap-up and per-item approval", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const overlay = readFileSync(resolve("src/components/odiseus/OdysseusVoiceCall.tsx"), "utf8");
  const home = readFileSync(resolve("src/components/odiseus/OdysseusWork.tsx"), "utf8");
  const css = readFileSync(resolve("src/index.css"), "utf8");
  const workerSource = readFileSync(resolve("worker/index.js"), "utf8");
  assert.match(workspace, /Talk with Odysseus/);
  assert.match(workspace, /talk-odysseus/);
  assert.match(workspace, /startVoiceCall/);
  assert.match(workspace, /applyVoicePlans/);
  assert.match(workspace, /voiceWrapUp/);
  assert.match(workspace, /buildVoiceWrapUpMessage/);
  assert.match(workspace, /transcribeVoiceAudio/);
  assert.match(overlay, /data-testid="odiseus-voice-call"/);
  assert.match(overlay, /Apply selected/);
  assert.match(overlay, /firestorePermissionMessage/);
  assert.match(overlay, /End conversation/);
  assert.match(overlay, /onWrapUp/);
  assert.match(overlay, /taking notes/);
  assert.doesNotMatch(overlay, /react-hooks\/exhaustive-deps/);
  assert.match(home, /onTalk/);
  assert.match(css, /\.odiseus-voice-call/);
  assert.match(css, /\.odiseus-voice-notes/);
  assert.match(workerSource, /VOICE WRAP-UP/);
  assert.match(workerSource, /\/api\/voice\/transcribe/);
  assert.match(VOICE_GREETING, /listening/i);
  assert.match(VOICE_GREETING, /notes/i);
  assert.equal(speechRecognitionSupported({ webkitSpeechRecognition: function Recognition() {} }), true);
  assert.equal(speechRecognitionSupported({}), false);
});

test("voice wrap-up instructions ask for a recap and tasks, not an interview", () => {
  const instructions = assistantInstructions(
    {
      workspaceContext: {
        mode: "personal_home",
        voiceSession: true,
        voiceWrapUp: true,
        tasks: [],
        projects: [],
      },
    },
    [],
  );
  assert.match(instructions, /VOICE WRAP-UP/);
  assert.match(instructions, /create_task/);
  assert.doesNotMatch(instructions, /Confirm what you will change/);
});

function environment(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: {
      async fetch() {
        return new Response("missing", { status: 404 });
      },
    },
    ...overrides,
  };
}

test("voice transcription requires authentication", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/voice/transcribe", { method: "POST" }),
    environment({ OPENAI_API_KEY: "sk-test" }),
  );
  assert.equal(response.status, 401);
});
