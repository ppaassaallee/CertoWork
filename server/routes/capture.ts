import type { Express } from "express";
import { Type } from "@google/genai";
import { generateContentWithFallback } from "../lib/ai";
import { parseCleanJSON } from "../lib/json";
import { sendPublicError } from "../middleware/errors";
import { registerCaptureProjectRoutes } from "./captureProjects";

export function registerCaptureRoutes(app: Express) {
  app.post("/api/warroom/modify-canvas", async (req, res) => {
    try {
      const { canvasData, prompt } = req.body;
      if (!canvasData || !prompt) {
        return res.status(400).json({ error: "Missing required canvas data or instruction prompt" });
      }

      const systemPrompt = `You are Boldi, an elite workspace strategy assistant.
Your task is to take an existing visual project canvas (structured with a list of "metrics" cards and "blocks" text content cards), and modify it in response to the user's natural language request.

Existing Canvas Data:
${JSON.stringify(canvasData, null, 2)}

User Instruction: "${prompt}"

Your response must be the complete, updated canvas data structure. Keep unmodified cards as-is, update existing cards where requested, delete cards if requested, or add new metrics/blocks if needed.

Format your output strictly as a valid JSON matching this schema:
{
  "metrics": [
    { "label": "Metric Label (e.g., Budget, Launch Date, Team Size)", "value": "Metric Value text", "subtext": "Optional subtext details" }
  ],
  "blocks": [
    { "id": "unique_block_id", "title": "Block Title (e.g., Goals, Audience, Tasks, Risks)", "text": "Detailed multi-line block description and text content" }
  ]
}
`;

      const aiResponse = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const resText = aiResponse?.text || aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!resText) throw new Error("Empty response from Gemini API for canvas modification");

      const parsed = parseCleanJSON(resText);
      if (!parsed) throw new Error("Failed to parse valid JSON from Gemini canvas response");

      res.json(parsed);
    } catch (e: any) {
      console.error("[Canvas Modify Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/skills/invoke", async (req, res) => {
    try {
      const { skillTitle, instructions, itemTitle, itemContent, itemType } = req.body;
      if (!instructions) {
        return res.status(400).json({ error: "instructions is required" });
      }

      const promptText = `
You are executing the AI Skill "${skillTitle || "Custom Skill"}" on a ${itemType || 'item'} in the Gazelle productivity system.

### Core Skill Instructions:
${instructions}

### Input Item Context:
- Title: ${itemTitle || "Untitled"}
- Type: ${itemType || "Unknown"}
- Current Details/Content:
${itemContent || "(No details provided)"}

Execute the skill instructions precisely on the provided input item. Generate a highly polished, comprehensive, and helpful response. Use standard, elegant Markdown for formatting.
`;

      const aiResponse = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }]
          }
        ]
      });

      const outputText = aiResponse.text;
      res.json({ outputText });
    } catch (e: any) {
      console.error("[Skill Invoke Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/transcribe-capture", async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "audioBase64 is required" });
      }

      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        contents: [
          {
            text: `You are an elite productivity strategist and executive assistant (inspired by the COD methodology, Weekly Planning, and GTD). The user has recorded an audio file which could be a solo brain-dump, a live client conversation, or a long meeting recording.
Your task is to transcribe the audio faithfully, analyze its contents completely, and transform it into highly structured, actionable intelligence.

CRITICAL INSTRUCTIONS:
1. Exhaustive Extraction: You MUST extract EVERY SINGLE action item, commitment, task, next step, or follow-up mentioned in the audio. Do not miss or summarize multiple distinct tasks into one. If there are 15 tasks, list all 15.
2. Infer Implicit Actions: Think beyond the explicit words. If a discussion logically requires preparation, follow-up, or a specific next step that wasn't explicitly stated, infer it and add it as a necessary action.
3. Rephrase for Clarity: Rephrase each extracted item into a well-crafted, robust, actionable task statement. It MUST start with a strong action verb (e.g., "Review", "Email", "Draft", "Schedule").
4. Analyze the ENTIRE audio from beginning to end.

Return your response strictly in the following JSON format:
{
  "rawTranscription": "The full exact transcription of the conversation or dictation.",
  "summary": "A concise executive summary of the recording's main themes.",
  "actionItems": [
    { "title": "A clear, actionable task starting with a verb", "type": "task" | "follow-up", "notes": "Additional context, constraints, or inferred necessity" }
  ],
  "decisions": [
    { "title": "A decision that was made", "reason": "Why the decision was made based on the audio" }
  ],
  "ideasAndNotes": [
    { "title": "A summary of the idea, reflection, or note", "description": "More detailed explanation" }
  ]
}
Do not include any other text outside of this JSON block.`
          },
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType || 'audio/webm'
            }
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });
      const parsed = parseCleanJSON(response.text);
      res.json(parsed);
    } catch (e: any) {
      console.error("[Transcribe Capture Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/triage", async (req, res) => {
    try {
      const { content } = req.body;
      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        contents: `You are an elite productivity strategist and AI assistant based on GTD and COD. The user is dumping their thoughts, plans, and ideas into the capture tool.
Break down their raw thoughts into structured review candidates.
A review candidate can be a 'task', 'project', 'decision', 'waiting_for', etc.

CRITICAL INSTRUCTIONS:
1. Exhaustive Extraction: Extract EVERY distinct actionable item, thought, or commitment. Do not summarize or combine items.
2. Infer Necessary Actions: If an idea requires follow-up, preparation, or next steps to become reality, infer those logical next steps and create tasks for them.
3. Rephrase for Clarity: Rephrase all tasks to start with a strong action verb (e.g., "Draft", "Review", "Contact").
4. Analyze thoroughly to ensure absolutely nothing is lost.

Raw Input: "${content}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              candidates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, description: "e.g., 'task', 'project', 'waiting_for', 'decision'" },
                    why: { type: Type.STRING, description: "Why this matters or what the context is" },
                    action: { type: Type.STRING, description: "What needs to be done next" },
                    confidence: { type: Type.STRING, description: "high, medium, or low based on how clear the input is" },
                    proposed: { 
                        type: Type.OBJECT, 
                        properties: {
                          description: { type: Type.STRING },
                          dueDate: { type: Type.STRING }
                        }
                    }
                  },
                  required: ["title", "type", "why", "action", "confidence"]
                }
              }
            },
            required: ["candidates"]
          }
        }
      });
      if (!response.text) throw new Error("No response");
      let jsonStr = response.text.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (e: any) {
      console.error(e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  registerCaptureProjectRoutes(app);
}
