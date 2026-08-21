type BoldiChatRequest = {
  token: string;
  userId: string;
  workspaceId: string;
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
  workspaceContext: any;
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

export async function sendBoldiChat({
  token,
  userId,
  workspaceId,
  conversationId,
  messages,
  workspaceContext,
}: BoldiChatRequest): Promise<BoldiChatResult> {
  const response = await fetch("/api/boldi/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      workspaceId,
      conversationId,
      messages,
      workspaceContext,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      result.error || "The AI service is temporarily unavailable.",
    );
  }
  return result;
}
