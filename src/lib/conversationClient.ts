type BoldiChatRequest = {
  token: string;
  userId: string;
  workspaceId: string;
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
  workspaceContext: any;
  onStep?: (step: {
    id?: string;
    tool?: string;
    label: string;
    status: "queued" | "working" | "done" | "failed";
    at?: number;
  }) => void;
};

export type BoldiChatResult = {
  reply?: string;
  citations?: Array<{ id: string; title: string; type?: string }>;
  suggestedChips?: string[];
  actionPlan?: any;
  provider?: any;
  run?: {
    status?: string;
    steps?: Array<{
      id?: string;
      tool?: string;
      label: string;
      status: "queued" | "working" | "done" | "failed";
      at?: number;
    }>;
    toolCount?: number;
    artifact?: {
      kind: string;
      title: string;
      summary?: string;
      body?: string;
      projectId?: string | null;
    } | null;
  };
  error?: string;
};

async function readSseChat(
  response: Response,
  onStep?: BoldiChatRequest["onStep"],
): Promise<BoldiChatResult> {
  if (!response.body) {
    throw new Error("The AI service returned an empty stream.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: BoldiChatResult | null = null;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: any = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === "step") onStep?.(parsed);
      if (event === "final") finalResult = parsed;
      if (event === "error") {
        streamError = parsed?.error || "The assistant is temporarily unavailable";
      }
    }
  }

  if (streamError) throw new Error(streamError);
  if (!finalResult) throw new Error("The AI service closed the stream without a final reply.");
  return finalResult;
}

export async function sendBoldiChat({
  token,
  userId,
  workspaceId,
  conversationId,
  messages,
  workspaceContext,
  onStep,
}: BoldiChatRequest): Promise<BoldiChatResult> {
  const response = await fetch("/api/boldi/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      userId,
      workspaceId,
      conversationId,
      messages,
      workspaceContext,
      stream: true,
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    if (!response.ok) {
      throw new Error("The AI service is temporarily unavailable.");
    }
    return readSseChat(response, onStep);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      result.error || "The AI service is temporarily unavailable.",
    );
  }
  return result;
}
