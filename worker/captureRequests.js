/**
 * Certo Capture + Requests — worker handlers (Brevo outbound, offline-safe AI).
 */

function stripQuotedEmailReply(body) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  let cleaned = text
    .replace(/\nOn .+ wrote:\n[\s\S]*$/i, "")
    .replace(/\nFrom:\s.+\nSent:\s.+\n[\s\S]*$/i, "")
    .replace(/\n-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i, "");
  return cleaned
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n")
    .trim();
}

function sanitizeEmailHtmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isActionableIntent(intent) {
  return ["ACTION_REQUIRED", "DECISION", "FOLLOW_UP", "REQUEST"].includes(intent);
}

export function deterministicCaptureUnderstand(input = {}) {
  const subject = String(input.subject || "").trim();
  const body = stripQuotedEmailReply(
    String(input.body || input.text || "").trim() ||
      sanitizeEmailHtmlToText(String(input.html || "")),
  );
  const text = `${subject}\n${body}`.toLowerCase();
  let intent = "INFORMATION";
  if (/unsubscribe|viagra|crypto giveaway/.test(text)) intent = "SPAM";
  else if (/\b(fyi|for your information|no action)\b/.test(text)) intent = "FYI";
  else if (/\b(meeting|invite|calendar)\b/.test(text)) intent = "MEETING";
  else if (/\b(decide|decision|approve|approval)\b/.test(text)) intent = "DECISION";
  else if (/\b(follow[- ]?up|checking in|circling back)\b/.test(text)) intent = "FOLLOW_UP";
  else if (/\b(please|need|request|can you|could you|asap|deadline)\b/.test(text)) {
    intent = "ACTION_REQUIRED";
  } else if (!subject && !body) intent = "NO_ACTION";

  const cleanedTitle = subject
    .replace(/^(re|fw|fwd)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const title =
    intent === "ACTION_REQUIRED" || intent === "REQUEST" || intent === "DECISION"
      ? cleanedTitle
        ? cleanedTitle.length > 72
          ? `Review: ${cleanedTitle.slice(0, 64)}…`
          : cleanedTitle
        : "Review inbound request"
      : cleanedTitle || "Captured email";

  return {
    intent,
    title,
    description: {
      context: body.slice(0, 420) || "No body text was provided.",
      outcome:
        intent === "ACTION_REQUIRED" || intent === "REQUEST"
          ? "Confirm the requested outcome and close the loop with the sender."
          : "Review and decide whether action is required.",
      details: body.slice(0, 900),
    },
    workItemSuggestion: isActionableIntent(intent) ? "pbi" : "none",
    fields: {},
    duplicateOfId: null,
  };
}

export function deterministicTicketTriage(input = {}) {
  const text = `${input.subject || ""}\n${input.body || ""}`.toLowerCase();
  let priority = "2";
  if (/\b(down|outage|can't login|cannot access|production|critical|urgent)\b/.test(text)) {
    priority = "1";
  } else if (/\b(minor|cosmetic|when you can|low priority)\b/.test(text)) {
    priority = "3";
  }
  return {
    category: /\b(access|login|password|permission)\b/.test(text)
      ? "access"
      : /\b(report|dashboard|export)\b/.test(text)
        ? "reporting"
        : "general",
    priority,
    urgency: priority === "1" ? "high" : priority === "3" ? "low" : "normal",
    impact: priority === "1" ? "high" : "medium",
    suggestedOwner: null,
    duplicateOfId: null,
  };
}

/** Keep request replies short — Brevo transactional body. */
export function briefTicketReplyEmail({
  ticketTitle,
  ticketKey,
  body,
  workspaceName,
  portalUrl,
}) {
  const title = String(ticketTitle || "your request").trim();
  const key = String(ticketKey || "").trim();
  const reply = String(body || "").trim().slice(0, 2000);
  const workspace = String(workspaceName || "Certo Work").trim();
  const subject = key ? `Re: [${key}] ${title}` : `Re: ${title}`;
  const textContent = [
    reply,
    "",
    portalUrl ? `Track status: ${portalUrl}` : "",
    "",
    `— ${workspace}`,
  ]
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n")
    .trim();
  const htmlContent = `<!doctype html>
<html><body style="margin:0;background:#f7faf7;font-family:Inter,Arial,sans-serif;color:#23352b;">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px;">
    <div style="border:1px solid #dfe8e1;border-radius:18px;background:#fff;padding:22px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#587061;">Certo Requests</div>
      <p style="margin:14px 0 0;line-height:1.55;white-space:pre-wrap;">${escapeHtml(reply)}</p>
      ${
        portalUrl
          ? `<p style="margin:18px 0 0;"><a href="${escapeHtml(portalUrl)}" style="color:#214b39;font-weight:700;">Track status</a></p>`
          : ""
      }
      <p style="margin:18px 0 0;color:#8a9690;font-size:12px;">— ${escapeHtml(workspace)}</p>
    </div>
  </div>
</body></html>`;
  return { subject, textContent, htmlContent };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inboundAuthorized(request, env) {
  const secret = String(env.CAPTURE_INBOUND_SECRET || "").trim();
  if (!secret) return false;
  const header =
    request.headers.get("x-capture-secret") ||
    request.headers.get("x-brevo-secret") ||
    "";
  if (header && header === secret) return true;
  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

/**
 * @param {object} deps - { json, readJson, authorize, sendBrevoTransactionalEmail, openai optional }
 */
export function createCaptureRequestsHandlers(deps) {
  const { json, readJson, authorize, sendBrevoTransactionalEmail } = deps;

  async function handleUnderstand(request, env) {
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
    }
    try {
      await authorize(request, body, env);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Authentication failed" }, 401);
    }
    const understood = deterministicCaptureUnderstand(body);
    return json({ ok: true, provider: "offline-safe", understood });
  }

  async function handleTriage(request, env) {
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
    }
    try {
      await authorize(request, body, env);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Authentication failed" }, 401);
    }
    const triage = deterministicTicketTriage(body);
    return json({ ok: true, provider: "offline-safe", triage });
  }

  /** Brevo inbound parse / generic email webhook → understand payload (persist client-side). */
  async function handleInboundEmail(request, env) {
    if (!inboundAuthorized(request, env) && !env.CAPTURE_INBOUND_OPEN) {
      // Also allow Firebase-authenticated callers for manual ingest.
      let body;
      try {
        body = await readJson(request);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
      }
      try {
        await authorize(request, body, env);
      } catch {
        return json({ error: "Capture inbound secret or auth required" }, 401);
      }
      const understood = deterministicCaptureUnderstand(normalizeInboundBody(body));
      const triage = deterministicTicketTriage(normalizeInboundBody(body));
      return json({
        ok: true,
        persisted: false,
        understood,
        triage,
        suggested: suggestedWorkItem(understood, triage, normalizeInboundBody(body)),
      });
    }

    let body;
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        body = await readJson(request);
      } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
        const form = await request.formData();
        body = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : v.name]));
      } else {
        body = await readJson(request);
      }
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
    }

    const normalized = normalizeInboundBody(body);
    const understood = deterministicCaptureUnderstand(normalized);
    const triage = deterministicTicketTriage(normalized);
    return json({
      ok: true,
      persisted: false,
      note: "Wire Brevo inbound to this endpoint; create the work item from suggested payload in Certo (or add FIREBASE admin write later).",
      understood,
      triage,
      suggested: suggestedWorkItem(understood, triage, normalized),
    });
  }

  /** Authenticated public reply → Brevo (brief). */
  async function handleTicketReply(request, env) {
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
    }
    if (!body.userId || !body.workspaceId || !body.toEmail || !body.body) {
      return json({ error: "userId, workspaceId, toEmail, and body are required" }, 400);
    }
    try {
      await authorize(request, body, env);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Authentication failed" }, 401);
    }
    const toEmail = String(body.toEmail || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
      return json({ error: "A valid recipient email is required" }, 400);
    }
    const content = briefTicketReplyEmail({
      ticketTitle: body.ticketTitle,
      ticketKey: body.ticketKey,
      body: body.body,
      workspaceName: body.workspaceName,
      portalUrl: body.portalUrl,
    });
    const senderEmail =
      env.CERTO_REQUESTS_EMAIL_FROM ||
      env.CERTO_EMAIL_FROM ||
      "requests@certo.work";
    const senderName = env.CERTO_EMAIL_FROM_NAME || "Certo Requests";
    const replyToEmail =
      body.replyTo ||
      env.CERTO_REQUESTS_EMAIL_REPLY_TO ||
      env.CERTO_EMAIL_REPLY_TO ||
      senderEmail;
    const result = await sendBrevoTransactionalEmail(env, {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: String(body.toName || "").trim() }],
      replyTo: { email: replyToEmail, name: senderName },
      subject: content.subject,
      htmlContent: content.htmlContent,
      textContent: content.textContent,
      tags: ["request-reply"],
      headers: {
        "X-Mailin-custom": JSON.stringify({
          workspaceId: body.workspaceId,
          ticketId: body.ticketId || null,
          kind: "request-reply",
        }),
      },
    });
    if (!result.sent) {
      return json(
        {
          ok: false,
          error: result.error || "Could not send email",
          configured: result.configured,
        },
        result.configured ? 502 : 503,
      );
    }
    return json({ ok: true, sent: true, messageId: result.messageId || null });
  }

  return {
    handleUnderstand,
    handleTriage,
    handleInboundEmail,
    handleTicketReply,
  };
}

function normalizeInboundBody(body = {}) {
  return {
    subject: body.subject || body.Subject || "",
    body: body.body || body.text || body["body-plain"] || body.TextBody || "",
    html: body.html || body["body-html"] || body.HtmlBody || "",
    fromEmail:
      body.fromEmail ||
      body.from ||
      body.sender ||
      extractEmail(body.From || body.from) ||
      "",
    fromName: body.fromName || body.senderName || "",
    to: body.to || body.recipient || body.To || "",
    messageId: body.messageId || body["Message-Id"] || body.headers?.["message-id"],
    inReplyTo: body.inReplyTo || body["In-Reply-To"],
    references: body.references || body.References,
  };
}

function extractEmail(value) {
  const match = String(value || "").match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return match ? match[0].toLowerCase() : "";
}

function suggestedWorkItem(understood, triage, inbound) {
  const kind = understood.workItemSuggestion === "pbi" ? "pbi" : "ticket";
  const description = [
    understood.description?.context ? `Context\n${understood.description.context}` : "",
    understood.description?.outcome ? `Requested outcome\n${understood.description.outcome}` : "",
    understood.description?.details ? `Important details\n${understood.description.details}` : "",
    inbound.fromEmail ? `Source\nEmail from ${inbound.fromEmail}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    title: understood.title,
    description,
    workItemType: kind,
    type: kind,
    source: "email",
    sourceType: "email",
    captureIntent: understood.intent,
    captureReviewStatus: isActionableIntent(understood.intent) ? "accepted" : "needs_review",
    requesterEmail: inbound.fromEmail || null,
    requesterName: inbound.fromName || null,
    priority: triage.priority,
    ticketStatus: kind === "ticket" ? "new" : null,
    status: kind === "ticket" ? "backlog" : "backlog",
    ai: { classification: understood.intent, triage },
  };
}
