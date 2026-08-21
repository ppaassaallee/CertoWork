import { executeOdiseusTool, ODISEUS_TOOLS, TOOL_LABELS } from "./odiseus-tools.js";

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

export async function runOdiseusAgent({
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
  maxRounds = 5,
}) {
  const steps = [];
  const collectedActions = [];
  let artifact = null;
  let input = [
    {
      role: "user",
      content:
        "Odiseus operating contract: use Certo.Work tools for facts. Do not invent records. Prefer tools over guessing. When finished, return exactly one valid JSON object matching the instructions (reply, optional actionPlan, suggestedChips, citations). Never claim mutations already happened — mutations go in actionPlan for approval.",
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

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
        store: false,
      }),
    });
    const payload = await response.json();
    lastPayload = payload;
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
      const executed = executeOdiseusTool(call.name, args, workspaceContext);
      steps.push({
        id: call.callId || `${call.name}-${steps.length}`,
        tool: call.name,
        label: executed.label || TOOL_LABELS[call.name] || call.name,
        status: "done",
        at: Date.now(),
      });
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
      title: result?.actionPlan?.title || "Odiseus wants to perform actions",
      summary:
        result?.actionPlan?.summary ||
        `Prepared ${collectedActions.length + existing.length} action(s). Nothing changes until you approve.`,
      riskLevel: result?.actionPlan?.riskLevel || "medium",
      safetyLevel: result?.actionPlan?.safetyLevel || 2,
      proposedActions: [...existing, ...collectedActions].slice(0, 24),
    };
  }

  const normalized = normalizeAssistantResult(result, citations, model, latestUserMessage);
  normalized.run = {
    status: collectedActions.length ? "waiting_for_approval" : "completed",
    steps,
    toolCount: steps.length,
    artifact: artifact || null,
  };
  return normalized;
}
