export type ClientExceptionTrace = {
  id: string;
  area: string;
  action: string;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

const TRACE_KEY = "certo-client-exception-traces";
const MAX_TRACES = 25;

function errorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  return String(reason || "Unknown error");
}

export function recordClientException(
  area: string,
  action: string,
  reason: unknown,
  details: Record<string, unknown> = {},
) {
  const trace: ClientExceptionTrace = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    area,
    action,
    message: errorMessage(reason),
    details,
    createdAt: new Date().toISOString(),
  };
  console.error(`[Certo Work] ${area}:${action}`, trace);
  if (typeof window === "undefined") return trace;
  try {
    const current = readClientExceptionTraces();
    window.localStorage.setItem(
      TRACE_KEY,
      JSON.stringify([trace, ...current].slice(0, MAX_TRACES)),
    );
    window.dispatchEvent(new CustomEvent("certo-client-exception", { detail: trace }));
  } catch {
    // If localStorage is unavailable, console.error above remains the fallback trace.
  }
  return trace;
}

export function readClientExceptionTraces(): ClientExceptionTrace[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TRACE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearClientExceptionTraces() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TRACE_KEY);
}
