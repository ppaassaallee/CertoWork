import type { MessageCard } from "./types";

export type OdysseusCommand = "summarize" | "actions" | "status" | "draft" | null;

export type OdysseusResult = {
  ok: boolean;
  reply: string;
  card?: MessageCard;
  error?: string;
  posted?: boolean;
  messageId?: string;
};

export async function askOdysseus(input: {
  workspaceId: string;
  conversationId: string;
  userId: string;
  text?: string;
  command?: OdysseusCommand;
  post?: boolean;
}): Promise<OdysseusResult> {
  try {
    const res = await fetch("/api/collab/odysseus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        userId: input.userId,
        text: input.text || "",
        command: input.command ?? null,
        post: Boolean(input.post),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as OdysseusResult & {
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, reply: "", error: data.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      reply: String(data.reply || ""),
      card: data.card,
      posted: Boolean((data as { posted?: boolean }).posted),
      messageId: (data as { messageId?: string }).messageId,
    };
  } catch (err) {
    return {
      ok: false,
      reply: "",
      error: err instanceof Error ? err.message : "Odysseus request failed",
    };
  }
}
