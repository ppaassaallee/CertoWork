/**
 * Workspace invitation + reminder email content for Certo Work.
 * Variants follow SaaS invite best practice: immediate send, day-1 nudge,
 * day-3 collaboration reminder, day-6 expiry warning (7-day invite TTL).
 */

export const INVITE_EMAIL_KINDS = ["invite", "reminder_1", "reminder_2", "reminder_final"];

export function publicAppOrigin(origin) {
  const value = String(origin || "").trim().replace(/\/$/, "");
  if (!value) return "https://certo.work";
  try {
    const hostname = new URL(value).hostname;
    if (/workers\.dev$/i.test(hostname) || /localhost|127\.0\.0\.1/i.test(hostname)) {
      return "https://certo.work";
    }
  } catch {
    return "https://certo.work";
  }
  return value;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeKind(kind) {
  const value = String(kind || "invite").trim().toLowerCase();
  return INVITE_EMAIL_KINDS.includes(value) ? value : "invite";
}

function copyForKind({ kind, inviterName, workspaceName, toEmail, role, expiresLabel }) {
  const roleLabel = role || "member";
  switch (kind) {
    case "reminder_1":
      return {
        subject: `Quick reminder: join ${workspaceName} on Certo Work`,
        eyebrow: "Reminder · day 1",
        headline: `${inviterName} is still waiting for you.`,
        lead: `Your invitation to collaborate in ${workspaceName} is ready. It only takes a minute to accept.`,
        cta: "Accept invitation",
        tip: `Sign in or create your password with ${toEmail}. Role: ${roleLabel}.`,
        footerNote: expiresLabel
          ? `This invite expires ${expiresLabel}. If you already joined, you can ignore this email.`
          : "If you already joined, you can ignore this email.",
      };
    case "reminder_2":
      return {
        subject: `${workspaceName} is waiting — accept your Certo Work invite`,
        eyebrow: "Reminder · day 3",
        headline: `Your seat in ${workspaceName} is still open.`,
        lead: `${inviterName} invited you so you can pick up work, comment, and stay in sync with the team.`,
        cta: "Join the workspace",
        tip: `Use this exact email: ${toEmail}. Role: ${roleLabel}.`,
        footerNote: expiresLabel
          ? `Invite expires ${expiresLabel}. Prefer a different email? Ask ${inviterName} to resend.`
          : `Prefer a different email? Ask ${inviterName} to resend.`,
      };
    case "reminder_final":
      return {
        subject: `Last chance: your ${workspaceName} invite expires soon`,
        eyebrow: "Final reminder",
        headline: "Your invitation expires tomorrow.",
        lead: `Open the link below before it expires, or ask ${inviterName} to send a fresh invite.`,
        cta: "Accept before it expires",
        tip: `Sign in with ${toEmail}. Role: ${roleLabel}.`,
        footerNote:
          "After expiry, the link stops working. Your admin can resend a new invitation anytime.",
      };
    default:
      return {
        subject: `${inviterName} invited you to ${workspaceName} in Certo Work`,
        eyebrow: "Team invitation",
        headline: `You're invited to ${workspaceName}.`,
        lead: `${inviterName} wants you on the Certo Work team — projects, priorities, and follow-ups in one place.`,
        cta: "Accept invitation",
        tip: `Use this exact email: ${toEmail}. Role: ${roleLabel}. Do not use “Request beta access” — this link already grants workspace access.`,
        footerNote: expiresLabel
          ? `This invitation expires ${expiresLabel}. Check spam/promotions if you do not see follow-ups.`
          : "Check spam/promotions if you do not see this email later.",
      };
  }
}

export function inviteEmailContent(body, origin) {
  const kind = normalizeKind(body.kind || body.emailKind);
  const token = String(body.inviteToken || "").trim();
  const appOrigin = publicAppOrigin(origin || body.appOrigin);
  const inviteUrl = token ? `${appOrigin}/invite/${encodeURIComponent(token)}` : `${appOrigin}/`;
  const workspaceName = String(body.workspaceName || "Certo Work").trim() || "Certo Work";
  const toEmail = String(body.toEmail || "").trim().toLowerCase();
  const role = String(body.role || "member").trim() || "member";
  const inviterName = String(body.inviterName || body.inviterEmail || "Your workspace admin").trim();
  const expiresLabel = String(body.expiresLabel || "").trim();
  const copy = copyForKind({ kind, inviterName, workspaceName, toEmail, role, expiresLabel });

  const textContent = [
    copy.headline,
    "",
    copy.lead,
    "",
    "Accept here (do not request beta access):",
    inviteUrl,
    "",
    `1. Open the link.`,
    `2. Sign in or create your password with this exact email: ${toEmail}`,
    "3. Certo Work adds you to the workspace automatically.",
    `Role: ${role}`,
    "",
    copy.footerNote,
    "",
    "— The Certo Work team",
    "https://certo.work",
  ].join("\n");

  const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0f241c;font-family:Georgia,'Times New Roman',serif;color:#1c2a24;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(copy.lead)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#0f241c 0%,#16352a 42%,#eef3ef 42%,#eef3ef 100%);padding:0;margin:0;">
      <tr>
        <td align="center" style="padding:28px 16px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 8px 22px;text-align:left;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#b7d4c4;">Certo Work</div>
                <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7fa892;">${escapeHtml(copy.eyebrow)}</div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(8,24,18,.28);">
                <div style="height:6px;background:linear-gradient(90deg,#1f6b45,#3d9b6c,#c6e2d1);"></div>
                <div style="padding:28px 28px 10px;">
                  <h1 style="margin:0 0 12px;font-size:32px;line-height:1.08;letter-spacing:-.03em;color:#143d2e;font-weight:700;">${escapeHtml(copy.headline)}</h1>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#4d5f56;">${escapeHtml(copy.lead)}</p>
                </div>
                <div style="padding:8px 28px 6px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3faf6;border:1px solid #d7e8de;border-radius:16px;">
                    <tr>
                      <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#244b39;">
                        <strong style="display:block;margin-bottom:4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5f7a6c;">Workspace</strong>
                        ${escapeHtml(workspaceName)}
                        <div style="margin-top:10px;"><strong>Email</strong><br />${escapeHtml(toEmail)}</div>
                        <div style="margin-top:8px;"><strong>Role</strong> · ${escapeHtml(role)}</div>
                        <div style="margin-top:8px;"><strong>Invited by</strong> · ${escapeHtml(inviterName)}</div>
                      </td>
                    </tr>
                  </table>
                </div>
                <div style="padding:18px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
                  <a href="${inviteUrl}" style="display:inline-block;background:#1f6b45;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:.01em;padding:14px 22px;border-radius:999px;">${escapeHtml(copy.cta)}</a>
                </div>
                <div style="padding:10px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#66756d;">
                  <p style="margin:0 0 12px;">${escapeHtml(copy.tip)}</p>
                  <p style="margin:0 0 14px;">${escapeHtml(copy.footerNote)}</p>
                  <p style="margin:0;font-size:11px;line-height:1.5;color:#8a9690;word-break:break-all;">If the button does not work, paste this link into your browser:<br />${escapeHtml(inviteUrl)}</p>
                </div>
                <div style="padding:16px 28px 22px;border-top:1px solid #e6eee9;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7a8a82;background:#fbfcfb;">
                  Sent by the Certo Work team · <a href="https://certo.work" style="color:#1f6b45;text-decoration:none;">certo.work</a>
                  <br />Questions? Reply to this email or write support@certo.work
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    kind,
    subject: copy.subject,
    textContent,
    htmlContent,
    inviteUrl,
  };
}
