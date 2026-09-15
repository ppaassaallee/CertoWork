/**
 * Item update channels: email + Slack webhook outbound, and inbound email/Slack notes.
 */

export type ItemUpdatePayload = {
  workspaceId: string;
  itemId: string;
  itemTitle: string;
  projectTitle?: string;
  actorName?: string;
  message: string;
  kind: "comment" | "status" | "assignment" | "update";
  recipientEmails?: string[];
  slackWebhookUrl?: string | null;
};

export function buildItemUpdateEmail(payload: ItemUpdatePayload) {
  const subject = `[Certo] ${payload.itemTitle}: ${payload.kind}`;
  const body = [
    payload.actorName ? `${payload.actorName} updated an item.` : "An item was updated.",
    "",
    `Item: ${payload.itemTitle}`,
    payload.projectTitle ? `Project: ${payload.projectTitle}` : null,
    "",
    payload.message,
    "",
    `Open in Certo: /my-work?item=${encodeURIComponent(payload.itemId)}`,
  ]
    .filter((line) => line != null)
    .join("\n");
  return { subject, body };
}

export function buildSlackItemUpdateBlocks(payload: ItemUpdatePayload) {
  return {
    text: `${payload.itemTitle}: ${payload.message}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${payload.itemTitle}*\n${payload.message}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: [
              payload.projectTitle ? `Project: ${payload.projectTitle}` : null,
              payload.actorName ? `By: ${payload.actorName}` : null,
              `Kind: ${payload.kind}`,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ],
      },
    ],
  };
}

export function parseInboundItemUpdate(text: string): {
  itemId: string | null;
  message: string;
} {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(/^(?:item|task)\s*[:#]\s*([a-zA-Z0-9_-]+)\s+([\s\S]+)$/i);
  if (match) {
    return { itemId: match[1], message: match[2].trim() };
  }
  const replyMatch = trimmed.match(/\[certo-item:([a-zA-Z0-9_-]+)\]([\s\S]*)/i);
  if (replyMatch) {
    return { itemId: replyMatch[1], message: replyMatch[2].trim() || trimmed };
  }
  return { itemId: null, message: trimmed };
}

export function slackWebhookStorageKey(workspaceId: string) {
  return `certo.slackWebhook.${workspaceId}`;
}

export function notifyOnAssignmentEmailKey(workspaceId: string) {
  return `certo.notifyOnAssignmentEmail.${workspaceId}`;
}

export function readSlackWebhookUrl(workspaceId: string): string {
  if (typeof localStorage === "undefined") return "";
  return String(localStorage.getItem(slackWebhookStorageKey(workspaceId)) || "").trim();
}

export function writeSlackWebhookUrl(workspaceId: string, url: string) {
  if (typeof localStorage === "undefined") return;
  const trimmed = String(url || "").trim();
  if (trimmed) localStorage.setItem(slackWebhookStorageKey(workspaceId), trimmed);
  else localStorage.removeItem(slackWebhookStorageKey(workspaceId));
}

export function readNotifyOnAssignmentEmail(workspaceId: string): boolean {
  if (typeof localStorage === "undefined") return true;
  const raw = localStorage.getItem(notifyOnAssignmentEmailKey(workspaceId));
  if (raw == null) return true;
  return raw === "1" || raw === "true";
}

export function writeNotifyOnAssignmentEmail(workspaceId: string, enabled: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(notifyOnAssignmentEmailKey(workspaceId), enabled ? "1" : "0");
}

/** Fire-and-forget outbound notify after assignment docs are written. */
export async function postAssignmentNotify(input: {
  workspaceId: string;
  itemId: string;
  itemTitle: string;
  message: string;
  recipientEmails?: string[];
  actorName?: string;
  projectTitle?: string;
  token?: string | null;
}) {
  const slackWebhookUrl = readSlackWebhookUrl(input.workspaceId);
  const notifyEmail = readNotifyOnAssignmentEmail(input.workspaceId);
  if (!slackWebhookUrl && !notifyEmail) return;
  try {
    await fetch("/api/items/notify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
      },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        itemTitle: input.itemTitle,
        message: input.message,
        kind: "assignment",
        recipientEmails: notifyEmail ? input.recipientEmails || [] : [],
        slackWebhookUrl: slackWebhookUrl || null,
        actorName: input.actorName,
        projectTitle: input.projectTitle,
      }),
    });
  } catch {
    // Endpoint may not exist yet; assignment in-app notifications still applied.
  }
}
