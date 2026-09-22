/**
 * Channel adapter interface — WhatsApp left unimplemented (Step 16).
 */
export type ChannelKind = "email" | "portal" | "whatsapp" | "app";

export interface ChannelAdapter {
  kind: ChannelKind;
  sendOutbound(input: {
    conversationId: string;
    text: string;
    to: string;
  }): Promise<{ ok: boolean; error?: string }>;
}

export const whatsappAdapter: ChannelAdapter = {
  kind: "whatsapp",
  async sendOutbound() {
    return { ok: false, error: "WhatsApp adapter not implemented" };
  },
};
