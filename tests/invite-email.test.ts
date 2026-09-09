import assert from "node:assert/strict";
import test from "node:test";
import { inviteEmailContent, publicAppOrigin } from "../worker/inviteEmail.js";

test("invite emails force the public certo.work origin off workers.dev", () => {
  assert.equal(publicAppOrigin("https://certo-work.workers.dev"), "https://certo.work");
  assert.equal(publicAppOrigin("http://localhost:5173"), "https://certo.work");
  assert.equal(publicAppOrigin("https://certo.work"), "https://certo.work");
});

test("invite template includes Certo branding and reminder variants", () => {
  const invite = inviteEmailContent(
    {
      inviteToken: "ABCDEF123",
      workspaceName: "Atlas",
      toEmail: "luis@example.com",
      role: "member",
      inviterName: "Alejandro",
      kind: "invite",
      expiresLabel: "Sep 16, 2026",
    },
    "https://certo-work.workers.dev",
  );
  assert.match(invite.subject, /Alejandro invited you to Atlas/);
  assert.match(invite.htmlContent, /Certo Work/);
  assert.match(invite.htmlContent, /Accept invitation/);
  assert.match(invite.htmlContent, /https:\/\/certo\.work\/invite\/ABCDEF123/);
  assert.match(invite.textContent, /do not request beta access/i);

  const finalReminder = inviteEmailContent(
    {
      inviteToken: "ABCDEF123",
      workspaceName: "Atlas",
      toEmail: "luis@example.com",
      role: "admin",
      inviterName: "Alejandro",
      kind: "reminder_final",
    },
    "https://certo.work",
  );
  assert.match(finalReminder.subject, /expires soon/i);
  assert.match(finalReminder.htmlContent, /Final reminder/);
  assert.equal(finalReminder.kind, "reminder_final");
});
