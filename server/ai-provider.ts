export type AssistantProvider = "openai" | "gemini";

export interface AssistantResponseRequest {
  instructions: string;
  messages: Array<{ role: string; content: string }>;
  jsonSchemaName?: string;
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
}

export interface AssistantResponseResult {
  provider: AssistantProvider;
  model: string;
  text: string;
}

function extractOpenAIText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return "";
}

export function resolveAssistantProvider(): AssistantProvider {
  const requested = (process.env.AI_PROVIDER || process.env.BOLDI_AI_PROVIDER || "auto").toLowerCase();
  if (requested === "none") {
    throw new Error("Certo Work SAFE MODE. OpenAI is not configured for this Certo Work deployment yet.");
  }
  if (requested === "openai") return "openai";
  if (requested === "gemini") return "gemini";
  return process.env.OPENAI_API_KEY ? "openai" : "gemini";
}

export async function generateWithOpenAI(
  request: AssistantResponseRequest,
): Promise<AssistantResponseResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
  const textFormat = request.jsonSchema
    ? {
        type: "json_schema",
        name: request.jsonSchemaName || "gazelle_assistant_response",
        strict: false,
        schema: request.jsonSchema,
      }
    : { type: "json_object" };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: request.instructions,
      input: request.messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
      text: { format: textFormat },
      store: false,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI request failed (${response.status})`);
  }

  const text = extractOpenAIText(payload);
  if (!text) throw new Error("OpenAI returned no assistant text");
  return { provider: "openai", model, text };
}
