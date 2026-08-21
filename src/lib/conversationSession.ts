type StreamSetter = (text: string) => void;

export async function streamConversationReply(
  text: string,
  setStreamed: StreamSetter,
) {
  const size = Math.max(8, Math.ceil(text.length / 70));
  for (let index = 0; index < text.length; index += size) {
    setStreamed(text.slice(0, index + size));
    await new Promise((resolve) => window.setTimeout(resolve, 10));
  }
}

export function assistantFallbackReply(error: unknown) {
  const message = error instanceof Error ? error.message : "the service is unavailable";
  if (/OPENAI_NOT_CONFIGURED|not configured for this Certo Work/i.test(message)) {
    return "Certo Work SAFE MODE\nOpenAI is not configured for this Certo Work deployment yet.\n\nNothing was changed.";
  }
  return `I couldn't complete that request: ${message}\n\nNothing was changed.`;
}

export function conversationTitleForMessage(
  userText: string,
  existingMessageCount: number,
  currentTitle?: string,
) {
  if (existingMessageCount === 0) return userText.slice(0, 64);
  return currentTitle || userText.slice(0, 64);
}
