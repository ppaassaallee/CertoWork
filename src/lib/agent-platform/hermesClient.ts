/**
 * Server-side Hermes OpenAI-compatible client.
 * Never import from browser code.
 */

export type HermesClientConfig = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
};

export type HermesChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type HermesChatResult = {
  id: string;
  content: string;
  model: string;
  usage?: Record<string, number>;
  raw: unknown;
};

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export class HermesClient {
  constructor(private readonly config: HermesClientConfig) {}

  async health(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await this.request("/v1/models", { method: "GET" });
      return { ok: res.ok, detail: res.ok ? "models" : `status ${res.status}` };
    } catch (error: any) {
      return { ok: false, detail: String(error?.message || error) };
    }
  }

  async chatCompletions(input: {
    messages: HermesChatMessage[];
    model?: string;
    stream?: boolean;
  }): Promise<HermesChatResult> {
    const res = await this.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: input.model || "hermes-agent",
        messages: input.messages,
        stream: Boolean(input.stream),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hermes chat failed (${res.status}): ${text.slice(0, 400)}`);
    }
    const raw = await res.json();
    const content =
      raw?.choices?.[0]?.message?.content ||
      raw?.choices?.[0]?.text ||
      "";
    return {
      id: String(raw?.id || `hermes-${Date.now()}`),
      content: String(content || ""),
      model: String(raw?.model || "hermes-agent"),
      usage: raw?.usage,
      raw,
    };
  }

  private async request(path: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs || 60_000,
    );
    try {
      return await fetch(joinUrl(this.config.baseUrl, path), {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
          ...(init.headers || {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function hermesClientFromEnv(env: Record<string, string | undefined> = process.env) {
  const baseUrl = String(
    env.HERMES_BASE_URL || env.CERTO_HERMES_BASE_URL || "http://127.0.0.1:8642",
  ).trim();
  const apiKey = String(
    env.HERMES_API_SERVER_KEY || env.API_SERVER_KEY || env.CERTO_HERMES_API_KEY || "",
  ).trim();
  if (!apiKey) {
    throw new Error("HERMES_API_SERVER_KEY / API_SERVER_KEY is required");
  }
  return new HermesClient({ baseUrl, apiKey });
}
