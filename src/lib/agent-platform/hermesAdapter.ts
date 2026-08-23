import { HermesClient, type HermesChatMessage } from "./hermesClient";
import type { NormalizedRunStatus } from "./types";

export type RuntimeRunRequest = {
  agentId: string;
  hermesProfile?: string;
  messages: HermesChatMessage[];
  traceId: string;
};

export type RuntimeRunRef = {
  runId: string;
  hermesRunId: string;
  agentId: string;
};

export type RuntimeRunState = {
  ref: RuntimeRunRef;
  status: NormalizedRunStatus;
  content?: string;
  errorMessage?: string;
};

export type NormalizedRuntimeEvent =
  | { type: "run.started"; runId: string }
  | { type: "message.completed"; runId: string; content: string }
  | { type: "run.completed"; runId: string }
  | { type: "run.failed"; runId: string; errorMessage: string };

export interface AgentRuntimeAdapter {
  getCapabilities(): Promise<{
    chatCompletions: boolean;
    streaming: boolean;
    jobs: boolean;
    mcp: boolean;
  }>;
  startRun(request: RuntimeRunRequest): Promise<RuntimeRunRef>;
  getRun(ref: RuntimeRunRef): Promise<RuntimeRunState>;
  stopRun(ref: RuntimeRunRef): Promise<void>;
}

const runMemory = new Map<string, RuntimeRunState>();

export class HermesRuntimeAdapter implements AgentRuntimeAdapter {
  constructor(private readonly client: HermesClient) {}

  async getCapabilities() {
    const health = await this.client.health();
    return {
      chatCompletions: health.ok,
      streaming: true,
      jobs: true,
      mcp: true,
    };
  }

  async startRun(request: RuntimeRunRequest): Promise<RuntimeRunRef> {
    const runId = `run_${request.traceId}`;
    const started: RuntimeRunState = {
      ref: { runId, hermesRunId: "", agentId: request.agentId },
      status: "starting",
    };
    runMemory.set(runId, started);
    try {
      const result = await this.client.chatCompletions({
        messages: request.messages,
      });
      const ref: RuntimeRunRef = {
        runId,
        hermesRunId: result.id,
        agentId: request.agentId,
      };
      runMemory.set(runId, {
        ref,
        status: "completed",
        content: result.content,
      });
      return ref;
    } catch (error: any) {
      runMemory.set(runId, {
        ref: { runId, hermesRunId: "", agentId: request.agentId },
        status: "failed",
        errorMessage: String(error?.message || error),
      });
      throw error;
    }
  }

  async getRun(ref: RuntimeRunRef): Promise<RuntimeRunState> {
    return (
      runMemory.get(ref.runId) || {
        ref,
        status: "unknown",
      }
    );
  }

  async stopRun(ref: RuntimeRunRef): Promise<void> {
    const current = runMemory.get(ref.runId);
    if (current && current.status === "running") {
      runMemory.set(ref.runId, { ...current, status: "cancelled" });
    }
  }
}

export function* normalizeCompletedRun(
  ref: RuntimeRunRef,
  content: string,
): Generator<NormalizedRuntimeEvent> {
  yield { type: "run.started", runId: ref.runId };
  yield { type: "message.completed", runId: ref.runId, content };
  yield { type: "run.completed", runId: ref.runId };
}
