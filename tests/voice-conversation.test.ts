import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectVoiceActions,
  spokenReplyText,
  speechRecognitionSupported,
  VOICE_GREETING,
} from "../src/lib/voiceConversation";

test("spoken Odysseus replies drop markdown so TTS stays natural", () => {
  assert.equal(
    spokenReplyText("**Done.** I will update [FieldOps](https://certo.work) and create a task."),
    "Done. I will update FieldOps and create a task.",
  );
  assert.match(spokenReplyText("# Status\n- Ship the report"), /Ship the report/);
});

test("voice actions flatten proposed task and project updates", () => {
  const actions = collectVoiceActions([
    {
      proposedActions: [
        {
          type: "update_task",
          proposedChange: { title: "Close checkout bug", taskId: "t1" },
          reason: "You said it is done",
        },
        {
          type: "create_project",
          proposedChange: { title: "Q4 launch" },
        },
      ],
    },
  ]);
  assert.equal(actions.length, 2);
  assert.equal(actions[0].type, "Update task");
  assert.equal(actions[0].title, "Close checkout bug");
  assert.equal(actions[1].type, "Create project");
});

test("voice conversation is wired for phone and desktop", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const overlay = readFileSync(resolve("src/components/odiseus/OdysseusVoiceCall.tsx"), "utf8");
  const home = readFileSync(resolve("src/components/odiseus/OdysseusWork.tsx"), "utf8");
  const css = readFileSync(resolve("src/index.css"), "utf8");
  const worker = readFileSync(resolve("worker/index.js"), "utf8");
  assert.match(workspace, /Talk with Odysseus/);
  assert.match(workspace, /talk-odysseus/);
  assert.match(workspace, /startVoiceCall/);
  assert.match(workspace, /applyVoicePlans/);
  assert.match(workspace, /voiceSession/);
  assert.match(overlay, /data-testid="odiseus-voice-call"/);
  assert.match(overlay, /Apply updates/);
  assert.match(overlay, /End conversation/);
  assert.match(home, /onTalk/);
  assert.match(css, /\.odiseus-voice-call/);
  assert.match(worker, /VOICE CONVERSATION/);
  assert.match(VOICE_GREETING, /listening/i);
  assert.equal(speechRecognitionSupported({ webkitSpeechRecognition: function Recognition() {} }), true);
  assert.equal(speechRecognitionSupported({}), false);
});
