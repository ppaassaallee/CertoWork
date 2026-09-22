import type { MessageCard } from "./types";

export type CollabSlashCommand =
  | "task"
  | "approve"
  | "summarize"
  | "actions"
  | "status"
  | "draft"
  | "invoice";

const COMMANDS = new Set<string>([
  "task",
  "approve",
  "summarize",
  "actions",
  "status",
  "draft",
  "invoice",
]);

export function parseSlashCommand(text: string): {
  command: CollabSlashCommand | null;
  rest: string;
  isSlash: boolean;
} {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return { command: null, rest: trimmed, isSlash: false };
  }
  const match = trimmed.match(/^\/([a-zA-Z]+)(?:\s+([\s\S]*))?$/);
  if (!match) return { command: null, rest: trimmed, isSlash: true };
  const name = match[1].toLowerCase();
  const rest = (match[2] || "").trim();
  if (!COMMANDS.has(name)) return { command: null, rest: trimmed, isSlash: true };
  return { command: name as CollabSlashCommand, rest, isSlash: true };
}

export const SLASH_HELP = [
  { cmd: "/task", hint: "Create an item linked to this conversation" },
  { cmd: "/approve", hint: "Post an approval card" },
  { cmd: "/summarize", hint: "Ask Odysseus to summarize" },
  { cmd: "/actions", hint: "Extract action items" },
  { cmd: "/status", hint: "Project/room status" },
  { cmd: "/draft", hint: "Draft an external reply" },
  { cmd: "/invoice", hint: "Attach invoice card by id" },
];

export function approvalCard(input: {
  what: string;
  askedBy: string;
  askedByName: string;
}): MessageCard {
  return {
    type: "approval",
    ref: {
      what: input.what,
      askedBy: input.askedBy,
      askedByName: input.askedByName,
      status: "pending",
    },
  };
}
