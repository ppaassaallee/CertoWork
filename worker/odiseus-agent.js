import { executeOdysseusTool, ODISEUS_TOOLS, TOOL_LABELS } from "./odiseus-tools.js";

function extractFunctionCalls(payload) {
  const calls = [];
  for (const item of payload?.output || []) {
    if (item?.type === "function_call") {
      calls.push({
        callId: item.call_id || item.id,
        name: item.name,
        arguments: item.arguments,
      });
    }
  }
  return calls;
}

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

export async function runOdysseusAgent({
  env,
  model,
  instructions,
  messages,
  workspaceContext,
  openaiApiKey,
  openaiUrl,
  extractOpenAIText,
  parseJsonObject,
  normalizeAssistantResult,
  citations,
  latestUserMessage,
  maxRounds = 1,
  maxOutputTokens = 550,
  onUsage = null,
  onStep = null,
}) {
  const steps = [];
  const collectedActions = [];
  let artifact = null;
  let input = [
    {
      role: "user",
      content:
        "Odysseus operating contract: use Certo.Work tools for facts. Do not invent records. Prefer tools over guessing. When finished, return exactly one valid JSON object matching the instructions (reply, optional actionPlan, suggestedChips, citations). Never claim mutations already happened — mutations go in actionPlan for approval. Use recall_memory before inventing preferences. Use remember_fact only for durable facts the user affirmed." +
        (workspaceContext?.voiceWrapUp
          ? " Voice wrap-up: recap the transcript, flag gaps, and put each next action in actionPlan as create_task or update_task. Do not interview."
          : workspaceContext?.voiceSession
          ? " Voice conversation: keep replies spoken and short. Listen and take notes. Do not interview."
          : ""),
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const memoryNotes = Array.isArray(workspaceContext?.odiseusMemory)
    ? workspaceContext.odiseusMemory.slice(0, 12)
    : [];
  if (memoryNotes.length) {
    input.unshift({
      role: "user",
      content: `Durable Odysseus memory for this user in this workspace:\n${memoryNotes
        .map((item) => `- (${item.kind || "fact"}) ${item.text}`)
        .join("\n")}`,
    });
  }

  let lastPayload = null;
  for (let round = 0; round < maxRounds; round += 1) {
    const wantsFinal = round === maxRounds - 1;
    const response = await fetch(openaiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${openaiApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        tools: ODISEUS_TOOLS,
        tool_choice: wantsFinal ? "none" : "auto",
        ...(wantsFinal || steps.length > 0
          ? { text: { format: { type: "json_object" } } }
          : {}),
        max_output_tokens: maxOutputTokens,
        store: false,
      }),
    });
    const payload = await response.json();
    lastPayload = payload;
    if (typeof onUsage === "function" && payload?.usage) {
      const inputTokens = Number(payload.usage.input_tokens || payload.usage.prompt_tokens || 0) || 0;
      const outputTokens = Number(payload.usage.output_tokens || payload.usage.completion_tokens || 0) || 0;
      await onUsage({
        inputTokens,
        outputTokens,
        totalTokens: Number(payload.usage.total_tokens || inputTokens + outputTokens) || 0,
      });
    }
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
      const error = new Error(message);
      error.code = "OPENAI_REQUEST_FAILED";
      error.status = 502;
      throw error;
    }

    const calls = extractFunctionCalls(payload);
    if (!calls.length) break;

    for (const call of calls) {
      const args = parseArgs(call.arguments);
      const workingStep = {
        id: call.callId || `${call.name}-${steps.length}`,
        tool: call.name,
        label: TOOL_LABELS[call.name] || call.name,
        status: "working",
        at: Date.now(),
      };
      if (typeof onStep === "function") {
        try {
          await onStep(workingStep);
        } catch {
          // Streaming callbacks must never abort the agent loop.
        }
      }
      const executed = executeOdysseusTool(call.name, args, workspaceContext);
      const doneStep = {
        ...workingStep,
        label: executed.label || workingStep.label,
        status: "done",
        at: Date.now(),
      };
      steps.push(doneStep);
      if (typeof onStep === "function") {
        try {
          await onStep(doneStep);
        } catch {
          // ignore
        }
      }
      if (Array.isArray(executed.proposedActions)) {
        collectedActions.push(...executed.proposedActions);
      }
      if (executed.artifact) {
        artifact = executed.artifact;
      }
      input = [
        ...input,
        {
          type: "function_call",
          call_id: call.callId,
          name: call.name,
          arguments: typeof call.arguments === "string" ? call.arguments : JSON.stringify(args),
        },
        {
          type: "function_call_output",
          call_id: call.callId,
          output: JSON.stringify(executed.result ?? executed),
        },
      ];
    }
  }

  const text = extractOpenAIText(lastPayload);
  let result;
  try {
    result = parseJsonObject(text);
  } catch {
    result = {
      reply:
        String(text || "").trim() ||
        "I finished the investigation but could not format the final answer.",
      actionPlan: null,
      suggestedChips: [],
      citations: [],
    };
  }

  if (collectedActions.length) {
    const existing = Array.isArray(result?.actionPlan?.proposedActions)
      ? result.actionPlan.proposedActions
      : [];
    result.actionPlan = {
      title: result?.actionPlan?.title || "Odysseus wants to perform actions",
      summary:
        result?.actionPlan?.summary ||
        `Prepared ${collectedActions.length + existing.length} action(s). Nothing changes until you approve.`,
      riskLevel: result?.actionPlan?.riskLevel || "medium",
      safetyLevel: result?.actionPlan?.safetyLevel || 2,
      proposedActions: [...existing, ...collectedActions].slice(0, 24),
    };
  }

  let finalUsage = null;
  if (lastPayload?.usage) {
    const inputTokens = Number(lastPayload.usage.input_tokens || lastPayload.usage.prompt_tokens || 0) || 0;
    const outputTokens = Number(lastPayload.usage.output_tokens || lastPayload.usage.completion_tokens || 0) || 0;
    finalUsage = {
      inputTokens,
      outputTokens,
      totalTokens: Number(lastPayload.usage.total_tokens || inputTokens + outputTokens) || 0,
    };
  }
  const normalized = normalizeAssistantResult(result, citations, model, latestUserMessage, finalUsage);
  normalized.run = {
    status: collectedActions.length ? "waiting_for_approval" : "completed",
    steps,
    toolCount: steps.length,
    artifact: artifact || null,
  };
  return normalized;
}
