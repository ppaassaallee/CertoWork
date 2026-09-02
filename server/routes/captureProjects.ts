import type { Express } from "express";
import { Type } from "@google/genai";
import { generateContentWithFallback } from "../lib/ai";
import { parseCleanJSON } from "../lib/json";
import { sendPublicError } from "../middleware/errors";

export function registerCaptureProjectRoutes(app: Express) {
  app.post("/api/generateProject", async (req, res) => {
    try {
      const { prompt, skills } = req.body;
      const skillsContext = skills && skills.length > 0 
        ? `Here are some skills/knowledge from the library to consider:\n${skills.map((s:any) => `- ${s.title}: ${s.description}\n  When to use: ${s.whenToUse}`).join('\n')}`
        : '';

      const systemPrompt = `You are an expert AI Project Builder.
Your task is to take a natural language request for a new project, goal, or feature, and generate a highly structured, comprehensive project plan. If the user request is in another language (like Spanish), generate the content values in that language, but KEEP ALL JSON KEYS EXACTLY AS INSTRUCTED.

${skillsContext}`;

      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "The name of the project" },
              description: { type: Type.STRING, description: "Detailed project overview" },
              objective: { type: Type.STRING, description: "Primary goal of the project" },
              successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
              assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
              openQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              methodology: { type: Type.STRING, description: "e.g., Agile, Waterfall, Kanban" },
              milestones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
                    acceptanceCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          priority: { type: Type.INTEGER, description: "1 for High, 4 for Low" },
                          recurrence: { type: Type.STRING, description: "Optional, e.g., 'daily', 'weekly'" },
                          subtasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["title", "description", "priority"]
                      }
                    }
                  },
                  required: ["title", "description", "deliverables", "acceptanceCriteria", "tasks"]
                }
              }
            },
            required: ["title", "description", "objective", "successCriteria", "risks", "assumptions", "openQuestions", "methodology", "milestones"]
          }
        }
      });
      if (!response.text) throw new Error("No response");
      let jsonStr = response.text.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
      res.json(parseCleanJSON(jsonStr));
    } catch (e: any) {
      console.error(e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/projects/generate-report", async (req, res) => {
    try {
      const { projectTitle, projectDescription, status, health, category, priority, tasks, milestones, recentUpdates } = req.body;
      const prompt = `Please generate an executive status report for this project:
Title: ${projectTitle}
Description: ${projectDescription || "None"}
Status: ${status}
Health: ${health || "Not evaluated"}
Category: ${category || "None"}
Priority: ${priority || "None"}

Current Tasks:
${(tasks || []).map((t:any) => `- [${t.status === 'done' ? 'DONE' : 'OPEN'}] ${t.title}`).join('\n')}

Key Milestones:
${(milestones || []).map((m:any) => `- [${m.status === 'done' || m.status === 'completed' ? 'DONE' : 'OPEN'}] ${m.title}`).join('\n')}

Recent Logged Updates:
${(recentUpdates || []).map((u:any) => `- ${u.content || u}`).join('\n')}
`;

      const systemPrompt = `You are a professional PMI/Scrum Executive Assistant.
Generate a structured, polished status report summary based on the provided project details. Write the content in the language of the request (e.g. if the project details are in Spanish, write the fields in Spanish).
Do not invent anything that isn't logical, but structure it beautifully. Keep your summaries objective, executive, and concise.`;

      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING, description: "A high-level executive summary of current progress and general project posture (2-3 sentences)." },
              wins: { type: Type.STRING, description: "Key achievements, wins, or milestones completed since the last check-in." },
              blockers: { type: Type.STRING, description: "Active blockers, bottleneck items, or unresolved issues needing attention." },
              risks: { type: Type.STRING, description: "Potential future risks or threats that could delay the timeline or exceed budget." },
              nextSteps: { type: Type.STRING, description: "Immediate next actions and priority focus areas for the upcoming period." }
            },
            required: ["executiveSummary", "wins", "blockers", "risks", "nextSteps"]
          }
        }
      });
      if (!response.text) throw new Error("No response from AI");
      let jsonStr = response.text.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
      res.json(parseCleanJSON(jsonStr));
    } catch (e: any) {
      console.error(e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/performTask", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        contents: `You are an AI coworker assistant named Boldi built into a productivity workspace. 
Context about the current item (Task/Project/Document):
${context || 'No specific context provided.'}

User Request:
${prompt}

Provide a helpful, direct, conversational response. Format as Markdown.
If the user asks you to write, draft, send, or compose an email, or notify/ask a coworker/stakeholder for something, write a conversational confirmation, AND output the email draft inside a codeblock starting with \`\`\`email, like this:
\`\`\`email
to: [recipient email or name]
subject: [clear email subject line]
body:
[the polished draft body here]
\`\`\`

Feel free to suggest names or emails from the task/project stakeholders if they appear in the context. Keep everything conversational, warm, and highly professional.`,
      });
      if (!response.text) throw new Error("No response");
      res.json({ text: response.text });
    } catch (e: any) {
      console.error(e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/autoOrganize", async (req, res) => {
    try {
      const { tasks, categories, gtdStages, pipelineStages } = req.body;
      const stages = gtdStages || pipelineStages || [];
      
      const prompt = `You are an elite productivity strategist and Odysseus (inspired by Carl Pullein's methodologies, COD, and Perfect Week principles).
Your goal is to organize, de-duplicate, merge, and enrich the user's task inbox.

You must perform three tasks:
1. Organize: Assign the best matching category ID (if any), priority (1 to 4, where 1 is highest/most urgent, 4 is lowest), and stage ID from the provided stages for each task.
2. De-duplicate & Merge: Carefully analyze the tasks to find duplicate or highly overlapping items.
   - If two or more tasks represent the same core task, choose one task to be the "primary" task.
   - List the IDs of the other duplicate tasks in "duplicateTaskIds" (these will be deleted/merged).
   - For the primary task, make sure you merge and combine their description details/context into a single cohesive, high-context description.
3. Enrich & Contextualize: For EVERY task (both non-duplicates and primary merged tasks), rewrite the title and description to make them clearer, highly descriptive, professional, and rich with context. Each title MUST begin with a strong, precise action verb (e.g., "Draft", "Review", "Coordinate", "Analyze", "Implement", "Email", "Call").

Here are the categories: ${JSON.stringify(categories)}
Here are the stages: ${JSON.stringify(stages)}
Here are the tasks to organize: ${JSON.stringify(tasks.map((t:any) => ({ id: t.id, title: t.title, description: t.description || "" })))}

Return your analysis strictly as a JSON object matching this schema:
{
  "taskUpdates": [
    {
      "taskId": "String (the task ID)",
      "categoryId": "String (optional, pick best match ID from categories)",
      "priority": "Number (1-4)",
      "globalStageId": "String (pick best match from stages)",
      "enrichedTitle": "String (a beautiful, descriptive title starting with an action verb and rich with context)",
      "enrichedDescription": "String (a robust, comprehensive description/notes combining details if merged, or expanding on the existing description)"
    }
  ],
  "duplicateMerges": [
    {
      "primaryTaskId": "String (the task ID to keep and enrich)",
      "duplicateTaskIds": ["String (list of other duplicate task IDs to be removed)"]
    }
  ]
}`;

      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              taskUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING },
                    categoryId: { type: Type.STRING },
                    priority: { type: Type.INTEGER },
                    globalStageId: { type: Type.STRING },
                    enrichedTitle: { type: Type.STRING },
                    enrichedDescription: { type: Type.STRING }
                  },
                  required: ["taskId", "priority", "globalStageId", "enrichedTitle", "enrichedDescription"]
                }
              },
              duplicateMerges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    primaryTaskId: { type: Type.STRING },
                    duplicateTaskIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ["primaryTaskId", "duplicateTaskIds"]
                }
              }
            },
            required: ["taskUpdates", "duplicateMerges"]
          }
        }
      });
      if (!response.text) throw new Error("No response from AI");
      let jsonStr = response.text.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (e: any) {
      console.error(e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });
}
