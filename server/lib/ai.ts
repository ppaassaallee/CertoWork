import { GoogleGenAI } from "@google/genai";
import {
  generateWithOpenAI,
  resolveAssistantProvider,
  type AssistantResponseRequest,
  type AssistantResponseResult,
} from "../ai-provider";

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiInstance;
}

function logAiUsage(entry: {
  provider: string;
  model: string;
  latencyMs: number;
  tokens?: number;
  requestId?: string;
}) {
  console.log(JSON.stringify({ event: "ai_usage", ...entry }));
}

export async function generateContentWithFallback(params: any): Promise<any> {
  const started = Date.now();
  const primaryModel = process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite";
  const fallbackModel = process.env.BOLDI_GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
  const models = Array.from(new Set([primaryModel, fallbackModel]));
  if (params.model && !models.includes(params.model)) models.unshift(params.model);
  else if (params.model) {
    const idx = models.indexOf(params.model);
    if (idx > -1) models.splice(idx, 1);
    models.unshift(params.model);
  }

  const sanitizedParams = { ...params };
  if (Array.isArray(sanitizedParams.contents)) {
    sanitizedParams.contents = sanitizedParams.contents
      .filter((item: any) => item && String(item.role || "").toLowerCase() !== "system")
      .map((item: any) => {
        const role = String(item.role || "").toLowerCase();
        return { ...item, role: role === "assistant" || role === "model" ? "model" : "user" };
      });
  }

  let lastError: any = null;
  const aiClient = getGeminiClient();
  for (const model of models) {
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        const response = await aiClient.models.generateContent({ ...sanitizedParams, model });
        logAiUsage({
          provider: "gemini",
          model,
          latencyMs: Date.now() - started,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err.message || "").toLowerCase();
        const isQuotaExceeded =
          err.code === 429 ||
          err.status === 429 ||
          errMsg.includes("429") ||
          errMsg.includes("quota") ||
          errMsg.includes("limit") ||
          errMsg.includes("resource has been exhausted");
        if (isQuotaExceeded) break;
        const isRetryable =
          err.code === 503 ||
          err.status === 503 ||
          errMsg.includes("503") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("demand");
        if (isRetryable && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("All fallback models failed");
}

export async function completeAssistant(
  request: AssistantResponseRequest,
  requestId?: string,
): Promise<AssistantResponseResult> {
  const started = Date.now();
  const provider = resolveAssistantProvider();
  if (provider === "openai") {
    const result = await generateWithOpenAI(request);
    logAiUsage({
      provider: result.provider,
      model: result.model,
      latencyMs: Date.now() - started,
      requestId,
    });
    return result;
  }
  const response = await generateContentWithFallback({
    contents: request.messages.map((message) => ({
      role: message.role,
      parts: [{ text: `${request.instructions}\n\n${message.content}` }],
    })),
  });
  const text = String(response.text || "");
  logAiUsage({
    provider: "gemini",
    model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
    latencyMs: Date.now() - started,
    requestId,
  });
  return { provider: "gemini", model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite", text };
}

export { resolveAssistantProvider };
