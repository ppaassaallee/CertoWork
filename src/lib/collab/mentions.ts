import { emptyMentions, type MessageMentions } from "./types";

/**
 * Parse markdown-lite mention tokens from message text.
 * Tokens: {{user:uid}} {{agent:id}} {{item:id}} {{project:id}} {{record:tableId:id}} {{odysseus}}
 */
export function parseMentions(text: string): MessageMentions & { odysseus: boolean } {
  const mentions = emptyMentions();
  let odysseus = false;
  const re =
    /\{\{(user|agent|item|project|record|odysseus)(?::([^}]+))?\}\}/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const kind = match[1].toLowerCase();
    const raw = (match[2] || "").trim();
    if (kind === "odysseus") {
      odysseus = true;
      continue;
    }
    if (!raw) continue;
    if (kind === "user") {
      if (!mentions.userIds.includes(raw)) mentions.userIds.push(raw);
    } else if (kind === "agent") {
      if (!mentions.agentIds.includes(raw)) mentions.agentIds.push(raw);
    } else if (kind === "item") {
      if (!mentions.itemIds.includes(raw)) mentions.itemIds.push(raw);
    } else if (kind === "project") {
      if (!mentions.projectIds.includes(raw)) mentions.projectIds.push(raw);
    } else if (kind === "record") {
      const [tableId, id] = raw.split(":");
      if (tableId && id && !mentions.recordRefs.some((r) => r.tableId === tableId && r.id === id)) {
        mentions.recordRefs.push({ tableId, id });
      }
    }
  }
  return { ...mentions, odysseus };
}

/** Strip tokens to a human-readable preview. */
export function previewFromText(text: string, maxLen = 140): string {
  const cleaned = text
    .replace(/\{\{user:([^}]+)\}\}/gi, "@$1")
    .replace(/\{\{agent:([^}]+)\}\}/gi, "@$1")
    .replace(/\{\{item:([^}]+)\}\}/gi, "#$1")
    .replace(/\{\{project:([^}]+)\}\}/gi, "#$1")
    .replace(/\{\{record:([^}]+)\}\}/gi, "#$1")
    .replace(/\{\{odysseus\}\}/gi, "@Odysseus")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1)}…`;
}
