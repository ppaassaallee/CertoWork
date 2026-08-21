import express from "express";
import helmet from "helmet";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import { generateWithOpenAI, resolveAssistantProvider } from "./server/ai-provider";
import { rankRetrievalCandidates, type RetrievalCandidate } from "./server/retrieval";
import {
  createRequireWorkspaceApiAuth,
  principalDisplayName,
  requestIdMiddleware,
  verifyHubspotSignature,
} from "./server/middleware/auth";
import { errorHandler, sendPublicError } from "./server/middleware/errors";
import { createAiRateLimit } from "./server/middleware/rateLimit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCleanJSON(str: string): any {
  if (!str) return null;
  // 1. Remove markdown code blocks if any
  let cleaned = str.replace(/^```json\n?/gi, '').replace(/```\n?$/g, '').trim();
  
  // 2. Remove comments
  // Strip single line comments: //...
  cleaned = cleaned.replace(/\/\/.*/g, '');
  // Strip multi-line comments: /*...*/
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // 3. Remove trailing commas in objects and arrays
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  // 4. Try to parse
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // If it still fails, try to escape raw newlines inside JSON strings
    try {
      let withinString = false;
      let fixed = "";
      for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        if (char === '"' && (i === 0 || cleaned[i - 1] !== '\\')) {
          withinString = !withinString;
          fixed += char;
        } else if (char === '\n' && withinString) {
          fixed += '\\n';
        } else if (char === '\r' && withinString) {
          fixed += '\\r';
        } else {
          fixed += char;
        }
      }
      return JSON.parse(fixed);
    } catch (err2) {
      console.error("[parseCleanJSON] Failed to parse cleaned JSON. Original:", str, "Cleaned:", cleaned);
      throw err;
    }
  }
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = Number(process.env.PORT) || 3000;
  const corsAllowlist = String(
    process.env.CORS_ORIGIN || "http://localhost:3000,https://certo.work,https://certo-work.gazellehunt.workers.dev",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  app.use(requestIdMiddleware);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: corsAllowlist, credentials: true }));
  app.use((req, res, next) => {
    const limit = req.path === "/api/transcribe-capture" ? "25mb" : "1mb";
    return express.json({
      limit,
      verify: (request, _response, buffer) => {
        (request as typeof req).rawBody = buffer;
      },
    })(req, res, next);
  });

  // Initialize firebase admin SDK
  let dbAdmin: any = null;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      
      let credentialObj: any = undefined;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      if (clientEmail && privateKey) {
        credentialObj = cert({
          projectId: firebaseConfig.projectId,
          clientEmail: clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        });
        console.log("[Firebase Admin] Initializing with environment service account credentials");
      }

      if (!getApps().length) {
        const appOptions: any = { projectId: firebaseConfig.projectId };
        if (credentialObj) appOptions.credential = credentialObj;
        initializeApp(appOptions);
      }
      if (firebaseConfig.firestoreDatabaseId) {
        try {
          dbAdmin = getFirestore(firebaseConfig.firestoreDatabaseId);
        } catch (e) {
          dbAdmin = getFirestore();
        }
      } else {
        dbAdmin = getFirestore();
      }
      console.log("[Firebase Admin] Initialized Firestore successfully");
    }
  } catch (e) {
    console.error("[Firebase Admin] Init failed:", e);
  }
  
  let aiInstance: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiInstance) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required but missing. Please configure it in Settings > Secrets.");
      }
      aiInstance = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiInstance;
  }

  async function generateContentWithFallback(params: any): Promise<any> {
    const primaryModel = process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash";
    const fallbackModel = process.env.BOLDI_GEMINI_FALLBACK_MODEL || "gemini-2.0-flash";
    const models = [
      primaryModel,
      fallbackModel,
      "gemini-2.5-pro",
      "gemini-2.0-pro-exp-02-05"
    ];
    
    if (params.model && !models.includes(params.model)) {
      models.unshift(params.model);
    } else if (params.model) {
      const idx = models.indexOf(params.model);
      if (idx > -1) {
        models.splice(idx, 1);
      }
      models.unshift(params.model);
    }

    // Sanitize the contents to remove system roles and normalize other roles to "user" or "model"
    const sanitizedParams = { ...params };
    if (Array.isArray(sanitizedParams.contents)) {
      sanitizedParams.contents = sanitizedParams.contents
        .filter((item: any) => {
          if (!item) return false;
          const role = (item.role || "").toLowerCase();
          return role !== "system";
        })
        .map((item: any) => {
          const role = (item.role || "").toLowerCase();
          const mappedRole = (role === "assistant" || role === "model") ? "model" : "user";
          return {
            ...item,
            role: mappedRole
          };
        });
    }

    let lastError: any = null;
    const aiClient = getGeminiClient();
    for (const model of models) {
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        attempts++;
        try {
          console.log(`[AI Fallback Logger] Trying model: ${model} (attempt ${attempts}/${maxAttempts})`);
          const response = await aiClient.models.generateContent({
            ...sanitizedParams,
            model,
          });
          console.log(`[AI Fallback Logger] Success with model: ${model}`);
          return response;
        } catch (err: any) {
          lastError = err;
          const errMsg = (err.message || "").toLowerCase();
          
          const isQuotaExceeded = 
            err.code === 429 || 
            err.status === 429 || 
            errMsg.includes("429") || 
            errMsg.includes("quota") || 
            errMsg.includes("limit") ||
            errMsg.includes("resource has been exhausted");

          if (isQuotaExceeded) {
            console.warn(`[AI Fallback Logger] Model ${model} returned quota exceeded (429). Falling back immediately...`);
            break; // Break out of the while loop to try the next model
          }

          const isRetryable = 
            err.code === 503 ||
            err.status === 503 ||
            errMsg.includes("503") ||
            errMsg.includes("unavailable") ||
            errMsg.includes("demand");

          if (isRetryable) {
            if (attempts < maxAttempts) {
              const waitTime = attempts * 1000;
              console.warn(`[AI Fallback Logger] Model ${model} returned retryable error (503). Retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            } else {
              console.warn(`[AI Fallback Logger] Model ${model} failed after ${maxAttempts} attempts. Falling back...`);
              break;
            }
          }
          console.error(`[AI Fallback Logger] Error with model ${model}. Trying next fallback model... Error:`, err.message || err);
          break; // Break out of the while loop to try the next model
        }
      }
    }
    console.error(`[AI Fallback Logger] All fallback models failed. Final error:`, lastError?.message || lastError);
    throw lastError || new Error("All fallback models failed");
  }

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      ai: {
        available: !!process.env.OPENAI_API_KEY || !!process.env.GEMINI_API_KEY,
        provider: resolveAssistantProvider(),
      },
      database: dbAdmin ? "available" : "degraded",
    });
  });

  app.get("/api/capabilities", (req, res) => {
    res.json({
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        description: "Primary Responses API adapter for structured Chief of Staff conversations."
      },
      gemini: {
        configured: !!process.env.GEMINI_API_KEY,
        description: "Preserved legacy provider and fallback for existing AI workflows."
      },
      activeAIProvider: {
        configured: !!process.env.OPENAI_API_KEY || !!process.env.GEMINI_API_KEY,
        description: `Current routing policy: ${resolveAssistantProvider()}.`
      },
      firebase: {
        configured: !!dbAdmin,
        description: "Durable cloud database for multi-user collaboration and permissioned projects."
      },
      hubspot: {
        configured: !!process.env.HUBSPOT_ACCESS_TOKEN,
        description: "Enables automated deal stages synchronization and closed won handoffs."
      },
      googleDrive: {
        configured: !!process.env.GOOGLE_DRIVE_API_KEY || (!!process.env.GOOGLE_DRIVE_CLIENT_ID && !!process.env.GOOGLE_DRIVE_CLIENT_SECRET),
        description: "Enables folder structure creation and document uploads."
      }
    });
  });

  async function loadWorkspaceAccess(workspaceId: string, uid: string) {
    if (!dbAdmin) return false;
    const memberId = `${workspaceId}_${uid}`;
    const [memberDoc, workspaceDoc] = await Promise.all([
      dbAdmin.collection("workspace_members").doc(memberId).get(),
      dbAdmin.collection("workspaces").doc(workspaceId).get(),
    ]);
    const isActiveMember = memberDoc.exists && memberDoc.data()?.status === "active";
    const isOwner = workspaceDoc.exists && workspaceDoc.data()?.ownerId === uid;
    return Boolean(isActiveMember || isOwner);
  }

  const requireWorkspaceApiAuth = createRequireWorkspaceApiAuth({
    verifyIdToken: async (token) => {
      const decoded = await getAdminAuth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      };
    },
    loadWorkspaceAccess,
    adminAvailable: () => Boolean(dbAdmin),
  });
  const aiRateLimit = createAiRateLimit();

  app.post("/api/webhooks/hubspot", verifyHubspotSignature, async (req, res) => {
    try {
      const events = Array.isArray(req.body) ? req.body : [];
      for (const event of events) {
        if (event.subscriptionType === "deal.propertyChange" && event.propertyName === "dealstage") {
          const TARGET_STAGE_ID = process.env.HUBSPOT_TARGET_STAGE_ID || "closed_won_handoff_required";
          if (event.propertyValue === TARGET_STAGE_ID) {
            console.log(`[HubSpot Automation] Deal ${event.objectId} reached trigger stage.`);
          }
        }
      }
      res.status(200).send("OK");
    } catch (err: unknown) {
      sendPublicError(req, res, 500, "internal_error", "Internal server error", err);
    }
  });

  app.use("/api", (req, res, next) => {
    if (req.path === "/webhooks/hubspot") return next();
    return requireWorkspaceApiAuth(req, res, next);
  });
  app.use(
    [
      "/api/boldi",
      "/api/warroom",
      "/api/triage",
      "/api/generateProject",
      "/api/projects",
      "/api/performTask",
      "/api/autoOrganize",
      "/api/workouts",
      "/api/analytics",
      "/api/habits",
      "/api/clarity",
      "/api/portfolio",
      "/api/stakeholder",
      "/api/timeblocks",
      "/api/skills",
      "/api/transcribe-capture",
    ],
    aiRateLimit,
  );

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
        model: "gemini-flash-latest",
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
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.1-pro-preview',
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
        model: 'gemini-2.5-pro',
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
        model: "gemini-flash-latest",
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
        model: "gemini-flash-latest",
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
        model: 'gemini-flash-latest',
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
      
      const prompt = `You are an elite productivity strategist and chief of staff (inspired by Carl Pullein's methodologies, COD, and Perfect Week principles).
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
        model: "gemini-flash-latest",
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

  app.post("/api/workouts/generate", async (req, res) => {
    try {
      const { profile } = req.body;
      const prompt = `You are an elite fitness coach. Generate a personalized 1-week workout plan draft for this profile:
${JSON.stringify(profile)}

Rules:
- 4 strength days, 1-2 swim days, 3 walk/run days, 1 Sunday MTB (as requested).
- INCLUDE 'hiking' and 'mountain_bike' sessions where appropriate based on the profile.
- Strength workouts should be ~60 mins.
- Include gym and no-gym versions for strength.
- Focus on muscle balance and recovery.
- For each exercise, provide a clear, concise 'explanation' (max 2 sentences) describing form or purpose.
- Output a weekly structure with daily sessions.

IMPORTANT: Disclaimer "Workout recommendations are general fitness guidance, not medical advice."`;

      const response = await generateContentWithFallback({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              weeklyStructure: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.INTEGER, description: "0-6" },
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, description: "one of: strength, swim, walk, run, mountain_bike, hiking, mobility, recovery, rest" },
                    durationMinutes: { type: Type.INTEGER },
                    intensity: { type: Type.STRING },
                    gymVersion: { type: Type.STRING },
                    noGymVersion: { type: Type.STRING },
                    warmup: { type: Type.STRING },
                    cooldown: { type: Type.STRING },
                    exercises: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          explanation: { type: Type.STRING, description: "Form check or purpose" },
                          muscleGroup: { type: Type.STRING },
                          sets: { type: Type.INTEGER },
                          reps: { type: Type.INTEGER },
                          durationSeconds: { type: Type.INTEGER },
                          distance: { type: Type.INTEGER },
                          restSeconds: { type: Type.INTEGER }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      res.json(JSON.parse(response.text));
    } catch (e: any) {
      console.error(e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/analytics/analyze", async (req, res) => {
    try {
      const { metrics, period } = req.body;
      const prompt = `You are a productivity coach. Analyze the user's performance metrics for the period: ${period.start} to ${period.end}.
${JSON.stringify(metrics, null, 2)}

Produce a structured performance analysis following the EXACT JSON schema provided below.
Focus on actionable decisions. Recommendations must be potential review candidates.`;

      const response = await generateContentWithFallback({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              wins: { type: Type.ARRAY, items: { type: Type.STRING } },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
              bottlenecks: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    type: { type: Type.STRING, description: "focus | review | project | delegation | kill | habit | workout | recovery | planning" },
                    confidence: { type: Type.STRING, description: "low | medium | high" }
                  },
                  required: ["title", "description", "reason", "type", "confidence"]
                }
              },
              nextWeekExperiment: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  successMeasure: { type: Type.STRING }
                },
                required: ["title", "description", "successMeasure"]
              }
            },
            required: ["executiveSummary", "wins", "risks", "bottlenecks", "recommendations", "nextWeekExperiment"]
          }
        }
      });
      res.json(JSON.parse(response.text));
    } catch (e: any) {
      console.error(e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/habits/analyze", async (req, res) => {
    try {
      const { habits, logs, period } = req.body;
      const prompt = `You are an elite productivity strategist and human performance coach.
Analyze the user's habit tracking logs for the selected period: ${period || "current month"}.

Habits tracking template definition:
${JSON.stringify(habits, null, 2)}

Habit logs (actual completions):
${JSON.stringify(logs, null, 2)}

Provide a structured, motivating habit analysis. Do not use generic placeholders or make up metrics. Analyze their actual consistency, check-ins, skipped logs, and identify patterns.

Specifically answer:
- Which habit is strongest?
- Which habit needs attention?
- Is the plan too ambitious (are there too many habits or too hard to sustain)?
- What is the minimum version they should use to stay consistent?
- What is one actionable change for next week?
- Which habit should be paused or simplified to protect focus?`;

      const response = await generateContentWithFallback({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strongestHabit: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  analysis: { type: Type.STRING }
                },
                required: ["title", "analysis"]
              },
              needsAttentionHabit: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  analysis: { type: Type.STRING }
                },
                required: ["title", "analysis"]
              },
              planAmbitiousness: { type: Type.STRING },
              minimumVersionSuggestions: { type: Type.STRING },
              nextWeekChange: { type: Type.STRING },
              suggestedPauseOrSimplify: { type: Type.STRING }
            },
            required: [
              "strongestHabit",
              "needsAttentionHabit",
              "planAmbitiousness",
              "minimumVersionSuggestions",
              "nextWeekChange",
              "suggestedPauseOrSimplify"
            ]
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

  app.post("/api/clarity/evaluate", async (req, res) => {
    try {
      const { pendientes, decisiones, ideas, dejarIr } = req.body;
      
      const prompt = `You are Gazelle, an elite productivity strategist. The user is doing their 10-Minute Daily Mental Clarity Reset in Certo Work.
      Here are the items they captured under each of the 4 sections:
      
      - PENDIENTES (Raw captured tasks or admin duties):
      ${(pendientes || []).map((p: any) => `- [${p.id}] ${p.title}`).join('\n')}
      
      - DECISIONES (Things weighing on their mind requiring a decision):
      ${(decisiones || []).map((d: any) => `- [${d.id}] ${d.title}`).join('\n')}
      
      - IDEAS (Inspirations, personal project seeds, random creative thoughts):
      ${(ideas || []).map((i: any) => `- [${i.id}] ${i.title}`).join('\n')}
      
      - DEJAR IR (Release points, noise, worries, things out of control):
      ${(dejarIr || []).map((dj: any) => `- [${dj.id}] ${dj.title}`).join('\n')}
      
      Evaluate these items. According to Gazelle system rules, we must:
      1. Select 1 to 3 Pendientes that represent high-leverage moves (Core Work) rather than busywork or passive tasks. Explain why in "reason".
      2. Choose EXACTLY 1 Decisión to resolve or close today. Explain why closing this today frees the most cognitive bandwidth in "reason".
      3. Choose EXACTLY 1 Idea that deserves to be protected/scheduled. Suggest a calendar block time (e.g., 'morning', 'afternoon') for it.
      4. Provide suggestions on which item(s) from 'DEJAR IR' or general clutter to release, and why.
      5. Write a short, calm, strategic 2-sentence personal reflection to guide their day.
      
      Verify that all itemIds returned match the actual item ID strings provided in the lists above.
      
      Return a JSON response conforming to this schema:
      {
        "suggestedPendientes": [
          { "itemId": "string", "reason": "string" }
        ],
        "suggestedDecision": {
          "itemId": "string",
          "reason": "string"
        },
        "suggestedIdea": {
          "itemId": "string",
          "reason": "string",
          "suggestedCalendarBlock": "string"
        },
        "letGoSuggestions": [
          { "itemId": "string", "reason": "string" }
        ],
        "reflection": "string"
      }`;

      const response = await generateContentWithFallback({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedPendientes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["itemId", "reason"]
                }
              },
              suggestedDecision: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["itemId", "reason"]
              },
              suggestedIdea: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  suggestedCalendarBlock: { type: Type.STRING }
                },
                required: ["itemId", "reason", "suggestedCalendarBlock"]
              },
              letGoSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["itemId", "reason"]
                }
              },
              reflection: { type: Type.STRING }
            },
            required: ["suggestedPendientes", "suggestedDecision", "suggestedIdea", "letGoSuggestions", "reflection"]
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

  app.post("/api/portfolio/analyze", async (req, res) => {
    try {
      const { projects, milestones, tasks } = req.body;
      const prompt = `You are Gazelle, a professional productivity strategist and portfolio director. Analyze this project portfolio and provide tactical assessments and action candidates.

      PROJECTS:
      ${JSON.stringify(projects.map((p: any) => ({ id: p.id, title: p.title, status: p.status, priority: p.priority, categoryId: p.categoryId, healthStatus: p.healthStatus || 'Pending', healthNote: p.healthNote || '', dueDate: p.dueDate || 'No due date' })))}

      MILESTONES:
      ${JSON.stringify(milestones.map((m: any) => ({ id: m.id, projectId: m.projectId, title: m.title, status: m.status, order: m.order })))}

      TASKS:
      ${JSON.stringify(tasks.map((t: any) => ({ id: t.id, projectId: t.projectId, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate })))}

      Evaluate individual project health, detect misalignments, identify milestones slipping or lacking active tasks, progress bottlenecks, and output a structured analysis. Include a set of tactical candidates that can be approved to adjust priorities, create follow-up task entities, or schedule project touchpoints.`;

      const response = await generateContentWithFallback({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              projectAssessments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    projectId: { type: Type.STRING },
                    statusAssessment: { type: Type.STRING, description: "On Track | At Risk | Off Track | Proposed" },
                    analysis: { type: Type.STRING }
                  },
                  required: ["projectId", "statusAssessment", "analysis"]
                }
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    projectId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    proposedAction: { type: Type.STRING },
                    urgency: { type: Type.STRING, description: "High | Medium | Low" }
                  },
                  required: ["projectId", "title", "description", "reason", "proposedAction", "urgency"]
                }
              }
            },
            required: ["executiveSummary", "projectAssessments", "recommendations"]
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

  app.post("/api/stakeholder/insight", async (req, res) => {
    try {
      const { stakeholder, tasks, projects } = req.body;
      const prompt = `You are a high-level organizational commander. Analyze the commitments, assignments, open issues, and performance of this stakeholder.

      STAKEHOLDER PROFILE:
      Name: ${stakeholder.name}
      Role/Company: ${stakeholder.role || 'Unspecified'}
      Email: ${stakeholder.email || 'Unspecified'}

      projects:
      ${JSON.stringify(projects.map((p: any) => ({ name: p.title, status: p.status })))}

      TASKS ASSIGNED TO STAKEHOLDER:
      ${JSON.stringify(tasks.map((t: any) => ({ title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate })))}

      Provide a clinical leadership analysis of how to manage communications with this individual. Address blockers, upcoming deadlines they need to meet, open issues, and actions we should take to unblock opportunities. Output solid task actions we can insert into our Review Candidate collection.`;

      const response = await generateContentWithFallback({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryText: { type: Type.STRING, description: "Executive briefing on managing this stakeholder" },
              relationshipVibe: { type: Type.STRING, description: "Assessment of cooperation level or pressure points" },
              blockersIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
              communicationPlay: { type: Type.STRING, description: "Next communication play, e.g., 'Assertive reminder on Task X', 'Alignment syncing'" },
              proposedActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    proposedDueDate: { type: Type.STRING }
                  },
                  required: ["title", "description", "reason"]
                }
              }
            },
            required: ["summaryText", "relationshipVibe", "blockersIdentified", "communicationPlay", "proposedActions"]
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

  app.post("/api/timeblocks/optimize", async (req, res) => {
    // ... preexisting optimization stuff
    try {
      const { tasks, metrics, date } = req.body;
      const prompt = `You are Gazelle, a masterful daily planner. The user wants to map their active tasks to structured hourly time blocks.
      
      DATE: ${date}
      WHOOP & ENERGY LEVELS (IF CURRENT):
      ${JSON.stringify(metrics)}

      USER'S OPEN/SCHEDULED TASKS:
      ${JSON.stringify(tasks.map((t: any) => ({ id: t.id, title: t.title, priority: t.priority, description: t.description || '', isOneThing: t.isOneThing })))}

      Organize key tasks into morning focus blocks, mid-day admin, afternoon deep work, and evening reviews. Consider priority (always schedule One Thing in the high-energy Morning Focus block if possible!). Align with health indicators (if Whoop recovery is low, schedule lighter administrative blocks and more recovery time).`;

      const response = await generateContentWithFallback({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              energyReflection: { type: Type.STRING, description: "Short encouragement based on their Whoop recovery score" },
              blockPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    blockName: { type: Type.STRING, description: "e.g. 'Morning Focus (08:00 - 11:00)', 'Afternoon Strategy (14:00 - 17:00)'" },
                    blockStrategy: { type: Type.STRING },
                    allocatedTasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          taskId: { type: Type.STRING },
                          title: { type: Type.STRING },
                          blockSpecificGoal: { type: Type.STRING }
                        },
                        required: ["taskId", "title", "blockSpecificGoal"]
                      }
                    }
                  },
                  required: ["blockName", "blockStrategy", "allocatedTasks"]
                }
              }
            },
            required: ["energyReflection", "blockPlan"]
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

  // ============================================================================
  // BOLDI ASSISTANT & CHIEF OF STAFF POWER LAYER
  // ============================================================================

  function isStandardizeMetadataRequest(text: string): boolean {
    const t = text.toLowerCase();
    return (
      t.includes("scan all my tasks") ||
      t.includes("scan all tasks") ||
      t.includes("scan my tasks") ||
      t.includes("scan all my items") ||
      t.includes("scan all items") ||
      t.includes("standardize metadata") ||
      t.includes("standardize task") ||
      t.includes("standardize my task") ||
      (t.includes("add missing") && t.includes("priority") && t.includes("date"))
    );
  }

  function isProceedRequest(text: string): boolean {
    const t = text.toLowerCase().trim();
    const approvedWords = ["proceed", "apply", "approve", "aplica", "dale", "ejecuta", "do it"];
    if (t === "yes" || t === "y" || t === "si" || t === "sí") return true;
    return approvedWords.some(w => t.includes(w));
  }

  function normalizeProjectName(value: any): string {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function projectActionTitle(action: any): string {
    const proposed = action?.proposedChange || {};
    return String(proposed.title || proposed.name || proposed.projectTitle || proposed.projectName || action?.title || "");
  }

  function findExistingProjectForAction(action: any, workspaceContext: any): any | null {
    const proposed = action?.proposedChange || {};
    const projects = Array.isArray(workspaceContext?.projects) ? workspaceContext.projects : [];
    const contextProjects = Array.isArray(workspaceContext?.contextProjects) ? workspaceContext.contextProjects : [];
    const allProjects = [...projects, ...contextProjects].filter(Boolean);
    const byId = String(proposed.projectId || proposed.id || workspaceContext?.activeProjectId || workspaceContext?.activeProject?.id || "");
    if (byId) {
      const direct = allProjects.find((project: any) => String(project.id || "") === byId);
      if (direct) return direct;
    }
    const normalizedTitle = normalizeProjectName(projectActionTitle(action));
    if (!normalizedTitle) return workspaceContext?.activeProject || null;
    return allProjects.find((project: any) => {
      const existingTitle = normalizeProjectName(project.title || project.name);
      return existingTitle === normalizedTitle ||
        existingTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(existingTitle);
    }) || null;
  }

  function guardAssistantActionPlan(resultData: any, workspaceContext: any) {
    const actions = resultData?.actionPlan?.proposedActions;
    if (!Array.isArray(actions)) return resultData;
    resultData.actionPlan.proposedActions = actions.map((action: any) => {
      if (String(action?.type || "") !== "create_project") return action;
      const existingProject = findExistingProjectForAction(action, workspaceContext);
      if (!existingProject?.id) return action;
      return {
        ...action,
        type: "update_project",
        proposedChange: {
          ...(action.proposedChange || {}),
          projectId: existingProject.id,
          id: existingProject.id,
          title: (action.proposedChange?.title || existingProject.title || existingProject.name || "").trim(),
        },
        reason: `${action.reason || "Project already exists in this workspace."} Certo Work recognized an existing project and converted this from create_project to update_project.`,
      };
    });
    return resultData;
  }

  app.post("/api/boldi/chat", async (req, res) => {
    try {
      let { userId, workspaceId, messages, workspaceContext } = req.body;
      if (!userId) userId = workspaceContext?.userId;
      if (!workspaceId) workspaceId = workspaceContext?.workspaceId;
      
      const mode = workspaceContext?.mode || "tell_me";
      const lastUserMessage = messages && messages.length > 0 ? messages[messages.length - 1].content : "";
      
      if (isStandardizeMetadataRequest(lastUserMessage)) {
        if (!userId || !workspaceId) {
          return res.status(400).json({ error: "Missing userId or workspaceId for metadata audit" });
        }
        if (!dbAdmin) {
          return res.status(500).json({ error: "Firestore Admin is not initialized" });
        }
        
        // 1. Run real database audit
        const tasksSnap = await dbAdmin.collection("tasks")
          .where("userId", "==", userId)
          .where("workspaceId", "==", workspaceId)
          .get();
          
        const incompleteTasks: any[] = [];
        let totalScanned = 0;
        
        tasksSnap.docs.forEach((doc: any) => {
          const id = doc.id;
          const data = doc.data();
          
          // Exclude done or archived tasks
          if (data.status === "done" || data.status === "archived") {
            return;
          }
          
          totalScanned++;
          const missingFields: string[] = [];
          
          // Priority Check
          const priority = data.priority;
          const hasPriority = (priority !== undefined && priority !== null && priority !== "");
          if (!hasPriority) missingFields.push("priority");
          
          // Due Date Check
          if (!data.dueDate) missingFields.push("dueDate");
          
          // Action Type Check (itemType)
          if (!data.itemType || data.itemType === "task" || data.itemType === "") {
            missingFields.push("actionType");
          }
          
          // Context Check (gtdContext)
          if (!data.gtdContext || data.gtdContext === "" || data.gtdContext === "all") {
            missingFields.push("context");
          }
          
          // Tags Check
          if (!data.tags || !Array.isArray(data.tags) || data.tags.length === 0) {
            missingFields.push("tags");
          }
          
          const taskObj = {
            id,
            title: data.title || "Untitled Task",
            description: data.description || "",
            missingFields,
            currentValues: {
              priority: data.priority ?? null,
              dueDate: data.dueDate ?? null,
              actionType: data.itemType ?? null,
              context: data.gtdContext ?? null,
              tags: data.tags ?? [],
              projectId: data.projectId ?? null
            }
          };
          
          if (missingFields.length > 0) {
            incompleteTasks.push(taskObj);
          }
        });
        
        if (incompleteTasks.length === 0) {
          return res.json({
            reply: `I have performed a thorough audit of your task database and verified that all open items are 100% complete with required metadata (priority, due date, action type, context, and tags). Excellent work maintaining your GTD workspace!`,
            actionPlan: null
          });
        }
        
        // Slice to 20 to prevent token limits and maintain excellent performance
        const tasksToEnrich = incompleteTasks.slice(0, 20);
        
        // Get all projects for reference
        const projectsSnap = await dbAdmin.collection("projects")
          .where("userId", "==", userId)
          .where("workspaceId", "==", workspaceId)
          .get();
        const projectsList = projectsSnap.docs.map((d: any) => ({ id: d.id, title: d.data().title }));
        
        const currentServerDate = new Date().toISOString().slice(0, 10);
        const enrichPrompt = `
You are Boldi, an elite AI Productivity Analyst. Your job is to suggest high-fidelity metadata updates for ${principalDisplayName(req)}'s incomplete tasks.
The current reference date is ${currentServerDate}.
Analyze the following list of tasks that are missing metadata:
${JSON.stringify(tasksToEnrich, null, 2)}

Available Projects to optionally link:
${JSON.stringify(projectsList, null, 2)}

For each task, recommend the optimal missing metadata. Follow these rules strictly:
1. "priority": Suggest "P1" (urgent/executive-critical), "P2" (important/strategic), "P3" (normal operational), "P4" (low-value/optional), or null (if you cannot confidently infer it).
   CRITICAL: DO NOT default to P4. Leave as null if you are unsure or if the task is vague. Only assign P4 if you explicitly decide and explain why it is low priority.
2. "dueDate": Suggest a dynamic YYYY-MM-DD string or null.
   CRITICAL: Do not suggest a date in the past (before ${currentServerDate}). Derive "next week" from the current reference date.
3. "actionType": Must be one of ["next_action", "follow_up", "waiting_for", "decision", "project_task", "calendar", "delegated", "someday", "reference", "blocked", null].
4. "context": Must be one of ["office", "home", "computer", "phone", "meeting", "deep_work", "anywhere", "errands", "custom", null].
5. "tags": Suggest an array of 1-3 useful text tags (e.g., ["admin", "finance", "writing"]) to help organize this task. Do not say tags are unsupported. Keep tags short, simple, and in lowercase.

Respond in a JSON format matching this schema:
{
  "suggestions": [
    {
      "taskId": "string",
      "changes": {
        "priority": "P1 | P2 | P3 | P4 | null",
        "dueDate": "YYYY-MM-DD | null",
        "actionType": "string | null",
        "context": "string | null",
        "tags": ["string"]
      },
      "reason": "Brief, single-sentence high-level justification for your choice"
    }
  ]
}
        `;
        
        const enrichResponse = await generateContentWithFallback({
          model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: enrichPrompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.15,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      taskId: { type: Type.STRING },
                      changes: {
                        type: Type.OBJECT,
                        properties: {
                          priority: { type: Type.STRING, nullable: true },
                          dueDate: { type: Type.STRING, nullable: true },
                          actionType: { type: Type.STRING, nullable: true },
                          context: { type: Type.STRING, nullable: true },
                          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                      },
                      reason: { type: Type.STRING }
                    },
                    required: ["taskId", "changes", "reason"]
                  }
                }
              },
              required: ["suggestions"]
            }
          }
        });
        
        if (!enrichResponse.text) throw new Error("AI suggestion response is empty");
        const jsonResponse = parseCleanJSON(enrichResponse.text);
        const suggestions = jsonResponse.suggestions || [];
        
        const proposedActions = suggestions.map((sug: any) => {
          const task = tasksToEnrich.find(t => t.id === sug.taskId);
          return {
            type: "update_task",
            proposedChange: {
              id: sug.taskId,
              title: task ? task.title : "Update Task Metadata",
              priority: sug.changes.priority || null,
              dueDate: sug.changes.dueDate || null,
              actionType: sug.changes.actionType || null,
              context: sug.changes.context || null,
              tags: sug.changes.tags || []
            },
            reason: sug.reason,
            safetyLevel: 2,
            confidence: 0.95
          };
        });
        
        if (mode === "tell_me") {
          return res.json({
            reply: `I have scanned all your tasks and prepared a preview of metadata alignments for ${proposedActions.length} tasks. However, since we are in Tell Me (Read-Only) mode, I cannot persist or apply this plan. Please switch to **Co-Work Mode** in the header to execute this action plan.`,
            actionPlan: {
              title: "Standardize Task Metadata (Preview)",
              summary: `Metadata audit scanned ${totalScanned} tasks, found ${incompleteTasks.length} incomplete, and prepared recommendations for ${proposedActions.length} tasks.`,
              riskLevel: "medium",
              safetyLevel: 2,
              proposedActions
            }
          });
        }
        
        // Save the plan to boldi_action_plans in Co-Work mode
        const planRef = await dbAdmin.collection("boldi_action_plans").add({
          userId,
          workspaceId,
          title: "Standardize Task Metadata",
          summary: `Metadata audit scanned ${totalScanned} tasks, found ${incompleteTasks.length} incomplete. Prepared recommendations for ${proposedActions.length} tasks.`,
          status: "needs_approval",
          riskLevel: "medium",
          safetyLevel: 2,
          createdBy: userId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        
        // Save each action to boldi_actions
        for (const action of proposedActions) {
          await dbAdmin.collection("boldi_actions").add({
            userId,
            workspaceId,
            actionPlanId: planRef.id,
            type: "update_task",
            targetEntityType: "tasks",
            targetEntityId: action.proposedChange.id,
            proposedChange: action.proposedChange,
            reason: action.reason,
            confidence: 0.95,
            status: "needs_approval",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
        
        return res.json({
          reply: `I have scanned your task database and identified ${incompleteTasks.length} tasks missing key attributes (priority, due dates, contexts, action types, or tags). I have generated a customized alignment plan for ${proposedActions.length} items. Please review the proposed changes below and click "Proceed" or say "approve" to write them securely to your database.`,
          actionPlan: {
            id: planRef.id,
            title: "Standardize Task Metadata",
            summary: `Metadata audit scanned ${totalScanned} tasks, found ${incompleteTasks.length} incomplete. Prepared recommendations for ${proposedActions.length} tasks.`,
            riskLevel: "medium",
            safetyLevel: 2,
            proposedActions
          }
        });
      }

      if (isProceedRequest(lastUserMessage)) {
        if (!userId || !workspaceId) {
          return res.status(400).json({ error: "Missing userId or workspaceId to proceed" });
        }
        if (!dbAdmin) {
          return res.status(500).json({ error: "Firestore Admin is not initialized" });
        }
        
        // Find latest boldi_action_plan in current workspace with status needs_approval
        const latestPlansSnap = await dbAdmin.collection("boldi_action_plans")
          .where("workspaceId", "==", workspaceId)
          .where("status", "==", "needs_approval")
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();
          
        if (latestPlansSnap.empty) {
          return res.json({
            reply: `I do not have a pending action plan to apply. I can scan your workspace again and prepare a new plan for you if you'd like.`,
            actionPlan: null
          });
        }
        
        const planDoc = latestPlansSnap.docs[0];
        const planId = planDoc.id;
        
        // Load approved/proposed actions from boldi_actions
        const actionsSnap = await dbAdmin.collection("boldi_actions")
          .where("actionPlanId", "==", planId)
          .where("status", "==", "needs_approval")
          .get();
          
        const results: any[] = [];
        let requestedUpdates = actionsSnap.size;
        let appliedUpdates = 0;
        let verifiedUpdates = 0;
        let failedUpdates = 0;
        let skippedUpdates = 0;
        let needsReview = 0;
        
        for (const actionDoc of actionsSnap.docs) {
          const actionData = actionDoc.data();
          const taskId = actionData.targetEntityId;
          const changes = actionData.proposedChange;
          const reason = actionData.reason;
          
          try {
            const taskRef = dbAdmin.collection("tasks").doc(taskId);
            const taskDoc = await taskRef.get();
            
            if (!taskDoc.exists) {
              results.push({
                taskId,
                title: "Unknown Task",
                status: "failed",
                before: {},
                after: {},
                verified: false,
                error: "Task does not exist"
              });
              failedUpdates++;
              await actionDoc.ref.update({ status: "failed", updatedAt: FieldValue.serverTimestamp() });
              continue;
            }
            
            const beforeData = taskDoc.data();
            if (beforeData.workspaceId !== workspaceId) {
              results.push({
                taskId,
                title: beforeData.title || "Untitled Task",
                status: "failed",
                before: {},
                after: {},
                verified: false,
                error: "Unauthorized workspace mismatch"
              });
              failedUpdates++;
              await actionDoc.ref.update({ status: "failed", updatedAt: FieldValue.serverTimestamp() });
              continue;
            }
            
            // Build updates - writing ONLY missing fields by default!
            const dbUpdates: any = {
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: userId,
              boldiActionPlanId: planId
            };
            let changed = false;
            
            // 1. Priority
            const currentPriorityNorm = (beforeData.priority === undefined || beforeData.priority === null || beforeData.priority === "") ? null : beforeData.priority;
            if (currentPriorityNorm === null && changes.priority !== undefined && changes.priority !== null) {
              dbUpdates.priority = changes.priority;
              changed = true;
            }
            
            // 2. Due Date
            if (!beforeData.dueDate && changes.dueDate) {
              dbUpdates.dueDate = changes.dueDate;
              changed = true;
            }
            
            // 3. Action Type (itemType)
            if ((!beforeData.itemType || beforeData.itemType === "task" || beforeData.itemType === "") && changes.actionType) {
              dbUpdates.itemType = changes.actionType;
              changed = true;
            }
            
            // 4. Context (gtdContext)
            if ((!beforeData.gtdContext || beforeData.gtdContext === "" || beforeData.gtdContext === "all") && changes.context) {
              dbUpdates.gtdContext = changes.context;
              changed = true;
            }
            
            // 5. Tags
            const beforeTags = beforeData.tags || [];
            if (beforeTags.length === 0 && changes.tags && changes.tags.length > 0) {
              dbUpdates.tags = changes.tags;
              changed = true;
            }
            
            if (changed) {
              await taskRef.update(dbUpdates);
              appliedUpdates++;
              
              // Refetch for verification
              const refetchedDoc = await taskRef.get();
              const afterData = refetchedDoc.data();
              
              let verified = true;
              if (dbUpdates.priority !== undefined && afterData.priority !== dbUpdates.priority) verified = false;
              if (dbUpdates.dueDate !== undefined && afterData.dueDate !== dbUpdates.dueDate) verified = false;
              if (dbUpdates.itemType !== undefined && afterData.itemType !== dbUpdates.itemType) verified = false;
              if (dbUpdates.gtdContext !== undefined && afterData.gtdContext !== dbUpdates.gtdContext) verified = false;
              
              if (verified) {
                verifiedUpdates++;
                await actionDoc.ref.update({ status: "applied", verified: true, updatedAt: FieldValue.serverTimestamp() });
              } else {
                failedUpdates++;
                await actionDoc.ref.update({ status: "failed", verified: false, updatedAt: FieldValue.serverTimestamp() });
              }
              
              results.push({
                taskId,
                title: beforeData.title || "Untitled Task",
                status: verified ? "applied" : "failed",
                before: {
                  priority: beforeData.priority ?? null,
                  dueDate: beforeData.dueDate ?? null,
                  context: beforeData.gtdContext ?? null,
                  actionType: beforeData.itemType ?? null,
                  tags: beforeData.tags ?? []
                },
                after: {
                  priority: afterData.priority ?? null,
                  dueDate: afterData.dueDate ?? null,
                  context: afterData.gtdContext ?? null,
                  actionType: afterData.itemType ?? null,
                  tags: afterData.tags ?? []
                },
                verified,
                error: verified ? null : "Verification mismatch"
              });
            } else {
              skippedUpdates++;
              await actionDoc.ref.update({ status: "skipped", updatedAt: FieldValue.serverTimestamp() });
              results.push({
                taskId,
                title: beforeData.title || "Untitled Task",
                status: "skipped",
                before: {
                  priority: beforeData.priority ?? null,
                  dueDate: beforeData.dueDate ?? null,
                  context: beforeData.gtdContext ?? null,
                  actionType: beforeData.itemType ?? null,
                  tags: beforeData.tags ?? []
                },
                after: {
                  priority: beforeData.priority ?? null,
                  dueDate: beforeData.dueDate ?? null,
                  context: beforeData.gtdContext ?? null,
                  actionType: beforeData.itemType ?? null,
                  tags: beforeData.tags ?? []
                },
                verified: true,
                error: null
              });
            }
          } catch (err: any) {
            failedUpdates++;
            await actionDoc.ref.update({ status: "failed", error: err.message, updatedAt: FieldValue.serverTimestamp() });
            results.push({
              taskId,
              title: "Error Task",
              status: "failed",
              before: {},
              after: {},
              verified: false,
              error: err.message
            });
          }
        }
        
        // Mark plan as applied
        await planDoc.ref.update({
          status: "applied",
          updatedAt: FieldValue.serverTimestamp()
        });
        
        const isSuccess = failedUpdates === 0;
        const replyMessage = isSuccess 
          ? `Done. I verified ${verifiedUpdates} updates in the database.`
          : `Some updates failed. I applied ${appliedUpdates}, verified ${verifiedUpdates}, and ${failedUpdates} failed.`;
          
        return res.json({
          reply: replyMessage,
          actionPlan: null,
          metadataReport: {
            actionPlanId: planId,
            requestedUpdates,
            appliedUpdates,
            verifiedUpdates,
            failedUpdates,
            skippedUpdates,
            needsReview,
            results
          }
        });
      }

      // 1. DYNAMIC ASSISTANT SETTINGS AND PROFILE SYSTEM (Gazelle Core)
      let userSettings: any = {};
      let userProfile: any = null;
      let citationsList: any[] = [];
      let groundedContext = "";

      if (dbAdmin && userId) {
        try {
          const settingsDoc = await dbAdmin.collection("boldi_settings").doc(userId).get();
          if (settingsDoc.exists) {
            userSettings = settingsDoc.data();
          }
          const profileDoc = await dbAdmin.collection("boldi_profiles").doc(userId).get();
          if (profileDoc.exists) {
            userProfile = profileDoc.data();
          }
        } catch (dbErr) {
          console.error("Failed to load user settings or profile:", dbErr);
        }

        // 2. WORKSPACE-SCOPED MULTI-SOURCE RETRIEVAL LAYER
        try {
          const [knowledgeSnap, memorySnap] = await Promise.all([
            dbAdmin.collection("knowledge_items")
              .where("userId", "==", userId)
              .where("workspaceId", "==", workspaceId)
              .get(),
            dbAdmin.collection("boldi_messages")
              .where("userId", "==", userId)
              .where("workspaceId", "==", workspaceId)
              .limit(200)
              .get(),
          ]);

          const candidates: RetrievalCandidate[] = [];
          for (const docSnap of knowledgeSnap.docs) {
            const data = docSnap.data();
            if (data.status === "archived") continue;
            candidates.push({
              id: docSnap.id,
              workspaceId,
              source: "knowledge",
              title: data.title || "Untitled note",
              body: data.body || data.summary || "",
              tags: data.tags || [],
              updatedAt: data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null,
            });
          }
          for (const docSnap of memorySnap.docs) {
            const data = docSnap.data();
            if (!data.content || data.conversationId === req.body.conversationId) continue;
            candidates.push({
              id: docSnap.id,
              workspaceId,
              source: "conversation",
              title: data.role === "user" ? "Prior user commitment" : "Prior Chief of Staff context",
              body: String(data.content).slice(0, 4000),
              updatedAt: data.createdAt?.toDate?.() || null,
            });
          }
          for (const task of workspaceContext?.tasks || []) {
            candidates.push({
              id: task.id,
              workspaceId,
              source: "task",
              title: task.title || "Untitled task",
              body: task.description || `Priority: ${task.priority || "none"}. Due: ${task.dueDate || "none"}.`,
              tags: task.tags || [],
            });
          }
          for (const project of workspaceContext?.projects || []) {
            candidates.push({
              id: project.id,
              workspaceId,
              source: "project",
              title: project.title || project.name || "Untitled project",
              body: project.description || project.outcome || `Status: ${project.status || "unknown"}.`,
              tags: project.tags || [],
            });
          }
          for (const goal of workspaceContext?.goals || []) {
            candidates.push({
              id: goal.id,
              workspaceId,
              source: "goal",
              title: goal.title || "Untitled goal",
              body: goal.description || goal.type || "",
            });
          }

          const retrieved = rankRetrievalCandidates(lastUserMessage, candidates, 8);
          citationsList = retrieved.map((item) => ({
            id: item.id,
            title: item.title,
            type: item.source,
            score: Number(item.score.toFixed(2)),
          }));
          groundedContext = retrieved
            .map(
              (item) =>
                `\n--- ${item.source.toUpperCase()} EVIDENCE [${item.id}]: "${item.title}" (score ${item.score.toFixed(2)}) ---\n${item.body || ""}`,
            )
            .join("\n");
        } catch (ragErr) {
          console.error("RAG retrieval failed:", ragErr);
        }
      }

      // Personality Configuration Adjustments
      const assistantName = userSettings.name || "Laura";
      const warmth = userSettings.warmth !== undefined ? userSettings.warmth : 5;
      const playfulness = userSettings.playfulness !== undefined ? userSettings.playfulness : 5;
      const formality = userSettings.formality !== undefined ? userSettings.formality : 5;
      const challengeIntensity = userSettings.challengeIntensity !== undefined ? userSettings.challengeIntensity : 5;
      const proactivity = userSettings.proactivity !== undefined ? userSettings.proactivity : 5;
      const humorAllowed = userSettings.humorAllowed !== undefined ? userSettings.humorAllowed : true;
      const suggestsMedia = userSettings.suggestsMedia !== undefined ? userSettings.suggestsMedia : false;
      const enforcesWeekend = userSettings.enforcesWeekend !== undefined ? userSettings.enforcesWeekend : false;
      const kidsInteract = userSettings.kidsInteract !== undefined ? userSettings.kidsInteract : false;

      // Onboarding Status Checks
      const isOnboardingComplete = userProfile && userProfile.onboardingStep === "complete";
      const currentStep = userProfile ? userProfile.onboardingStep : "0";

      // Calendar physics workload audits for Judgment check
      const totalActiveTasks = workspaceContext?.tasks?.length || 0;
      const totalActiveProjects = workspaceContext?.projects?.length || 0;
      
      // Look for Client-B travel conflicts
      const clientBConflict = workspaceContext?.tasks?.some((t: any) => {
        const tTitle = (t.title || "").toLowerCase();
        return tTitle.includes("client-b") || tTitle.includes("client b");
      }) || false;

      const existingProjectsForPrompt = (workspaceContext?.projects || []).slice(0, 40).map((project: any) => ({
        id: project.id,
        title: project.title || project.name || "Untitled project",
        status: project.status || "unknown",
        outcome: project.outcome || project.objective || "",
      }));
      const activeProjectForPrompt = workspaceContext?.activeProject
        ? {
            id: workspaceContext.activeProject.id,
            title: workspaceContext.activeProject.title || workspaceContext.activeProject.name || "Untitled project",
            status: workspaceContext.activeProject.status || "unknown",
            outcome: workspaceContext.activeProject.outcome || workspaceContext.activeProject.objective || "",
          }
        : null;

      const prompt = `You are ${assistantName}, a personal productivity strategist inspired by Carl Pullein’s COD, Time Sector System, Weekly Planning Matrix, 2+8 prioritization, and Perfect Week blueprint.
      You are running inside ${principalDisplayName(req)}'s executive system, Gazelle, acting as Personal Chief of Staff.
      
      ABSOLUTE RULES:
      - Never mention Breeze, HubSpot, or any external platform references.
      - Your name is ${assistantName}.
      - Speak strictly in accordance with your configured personality metrics:
        * Warmth/Empathy: ${warmth}/10 (higher means more empathetic, encouraging rest; lower means more dry/analytical).
        * Playfulness/Humor: ${playfulness}/10 (higher means witty jokes allowed: ${humorAllowed ? "YES" : "NO"}; lower means strictly direct).
        * Formality: ${formality}/10 (higher means academic lexicon and executive honorifics; lower means simple business-casual).
        * Challenge Intensity: ${challengeIntensity}/10 (higher means actively pushes back, enforces WIP, challenges vague commitments).
        * Proactivity: ${proactivity}/10 (higher means suggesting adjacent calendar slots, outbox actions, or audits unprompted).
        * Weekend Boundary Enforcement: ${enforcesWeekend ? "STRICT" : "MODERATE"}. If enabled, firmly challenge any work planned for Saturdays/Sundays!
        * Kids Mode: ${kidsInteract ? "ACTIVE (simplify language, speak playfully, never schedule heavy business)" : "OFF"}.

      GAZELLE WORKSPACE ARCHITECTURE:
      - COD System: Capture, Organize, Do.
      - 2+8 Prioritization: Every day should hold at most 2 Must Dos (non-negotiable) and 8 Should Dos.
      - 8 Areas of Focus: Health & Fitness, Family & Relationships, Career / Core Work, Finances, Learning / Self-development, Purpose / Contribution, Spirituality / Inner Life, Lifestyle / Environment.

	      CURRENT WORKSPACE PHYSICS:
	      - Open active tasks load: ${totalActiveTasks} items.
	      - Active projects count: ${totalActiveProjects} items.
	      - Conflict: Tomorrow has a Client-B visit scheduled? ${clientBConflict ? "YES (Strict travel and energy conflict!)" : "NO"}.

	      EXISTING PROJECT REGISTRY:
	      - Active project in this conversation: ${activeProjectForPrompt ? JSON.stringify(activeProjectForPrompt) : "none"}.
	      - Existing workspace projects: ${JSON.stringify(existingProjectsForPrompt)}.
	      - If the user is already inside a project, or the requested project title matches an existing project, NEVER propose "create_project".
	      - For existing projects, use "update_project", "create_task", "update_task", "create_milestone", "create_risk", or "create_project_artifact" with the existing projectId.
	      - Do not ask the user to create a project foundation again after the project already exists. Continue by completing missing fields, planning work, or adding reviewable items to the current project.

	      WORK ITEM TAXONOMY:
	      - Agile/Jira hierarchy belongs in "workItemType": "epic", "feature", "pbi", "story", "bug", "task", or "subtask".
	      - GTD classification belongs in "actionType" and "gtdActionType": "next_action", "waiting_for", "someday", "reference", "decision", "delegated", or "follow_up".
	      - Do not use "itemType" for GTD if you can use "actionType" and "gtdActionType".
	      - Today / This week / Next week / This month / Next month / Later are computed from "dueDate"; do not propose manual time-sector changes unless the item has no due date and the user explicitly asks for Someday/Waiting/Reference.

      DETERMINISTIC JUDGMENT PREFLIGHT:
      ${JSON.stringify(workspaceContext?.judgment || { verdict: "not_run", signals: [] })}
      - Treat blocking and warning signals as evidence, not decoration.
      - Never silently override a blocking signal. Explain the trade-off and offer a reversible alternative.
      - The user retains final override authority after the conflict is made explicit.
      
      GROUNDED RETRIEVED KNOWLEDGE CONTEXT (RAG):
      ${groundedContext ? groundedContext : "No context matched for the query. Answer using general model context."}

      EXECUTIVE PROFILE MEMORY:
      ${userProfile ? JSON.stringify(userProfile) : "No profile saved yet. User requires onboarding."}

      BEHAVIOR RULES FOR SPECIFIC INTERFACES:

      1. ONBOARDING SEQUENCE (If onboarding is not complete: "isOnboardingComplete: false"):
         - Your absolute priority is to conduct a 5-step, friendly onboarding interview to configure profile.md.
         - Do NOT overwhelm the user. Ask exactly ONE question at a time.
         - Onboarding Steps:
           * Step "0" (Greeting): Introduce yourself as ${assistantName}, ask how they'd like you to call them, and choice of avatar color. Set 'requiresProfileUpdate: true' and return next step "1" in 'profileData.onboardingStep'.
           * Step "1" (Dimensions): Confirm name/avatar, list the 8 Focus Areas, and ask which ones to activate.
           * Step "2" (Goals): Confirm active focus areas, and ask for their top 3 goals for this year.
           * Step "3" (Ambition): Confirm goals, and ask for their 5-year ambition.
           * Step "4" (Struggles): Ask for weekly non-negotiables (family, sports) and current biggest struggle. When they answer, confirm onboarding is COMPLETE! Return 'onboardingStep: "complete"' in 'profileData'.
         - For every onboarding response, set 'requiresProfileUpdate: true' and populate 'profileData' with the accumulated parameters!
         - Keep conversational reply elegant and brief, using customized chips in 'suggestedChips' (e.g. ["Let's start onboarding", "Skip to dashboard"]).

      2. JUDGMENT ENGINE / CHALLENGE VERDICTS:
         - If ${principalDisplayName(req)} asks to schedule something, add a project, or make a commitment:
           * WIP LIMIT: If tasks > 5 for a single day, or projects > 3 active in the workspace, you MUST challenge the addition! State clearly: "${principalDisplayName(req)}, you are exceeding your active WIP limit. We need to focus on completing outstanding tasks first."
           * CALENDAR CONFLICT (Scenario 4): If he asks to schedule "lunch with Alexis tomorrow" and tomorrow already has "Client-B visit" (detected as YES), raise a structural conflict! Push back: "Tomorrow is your Client-B site visit, which requires travel and full energy. Adding lunch with Alexis tomorrow compromises your focus. I suggest Thursday or Monday instead." Propose an action plan to draft the WhatsApp message to Alexis for Thursday/Monday!
           * VAGUE COMMITMENTS: If he types vague objectives ("I want to write more" or "Need to exercise"), challenge him: "Vague intentions do not convert. Let's apply a concrete implementation plan (when, where, and how). Would you like to schedule 30 minutes on Thursday at 8 AM?"

      3. REPORTING ENGINE (Scenario 7):
         - If the user requests a "weekly report", "executive progress snapshot", or "summary report":
           * Produce a clean, gorgeous Markdown report inside your 'reply'. Include a Weekly Theme, Top 3 Objectives, Core Work blocks, Project Priorities, Risks, and Next Actions.
           * Let the user know they can click the "Download Weekly Report" button below to download it as a markdown file.

      4. COMMUNICATION OUTBOX DESIGN (Scenario 8):
         - If they say "Tell Cesar I need the ABC report today" or "Email Julian", draft a grounded message in YOUR assistant voice (e.g. "Hi Cesar, ${principalDisplayName(req)}'s assistant here. Just following up to see if we can get the ABC report today? Thank you!").
         - Propose a 'proposedActions' item of type: "outbox_communication" with 'proposedChange' containing:
           { "recipient": "Cesar", "channel": "whatsapp", "content": "[draft message]" }.

      5. GUIDED PROJECT INITIATION (Scenario 3):
         - If he says "I want to launch a customer-feedback tool", provide a detailed project plan containing:
           * Objective, 2-3 Key Results, Phases, and First Action.
           * Propose a 'proposedActions' plan containing:
             - Type "create_project" with proposedChange { title: "Customer-Feedback Tool Launch", projectType: "implementation", reason: "Gather consumer reviews" }
             - Type "create_task" with proposedChange { title: "Draft feedback survey questions", priority: "P2", dueDate: "a realistic future YYYY-MM-DD", reason: "First next action" }.

      Keep your answers concise, practical, challenging, and action-oriented. Provide 4 helpful, dynamic button chips in 'suggestedChips' for every message. No corporate fluff or generic AI statements.`;

      const selectedProvider = resolveAssistantProvider();
      let resultData: any;
      let providerMetadata: { provider: string; model: string };

      if (selectedProvider === "openai") {
        try {
          const response = await generateWithOpenAI({
            instructions: `${prompt}

Return one valid JSON object with this top-level contract:
{
  "reply": "string",
  "toolName": "string (optional)",
  "actionPlan": {
    "title": "string",
    "summary": "string",
    "riskLevel": "low | medium | high",
    "safetyLevel": 1,
    "proposedActions": [{
	            "type": "create_task | reschedule_task | update_task | create_decision | create_followup | kill_or_archive | create_project | update_project | create_milestone | update_milestone | create_risk | update_risk | create_project_artifact | outbox_communication",
      "proposedChange": {},
      "reason": "string",
      "safetyLevel": 1,
      "confidence": 0.9
    }]
  },
  "suggestedChips": ["string"],
  "citations": [{"id": "string", "title": "string", "type": "string"}],
  "requiresProfileUpdate": false,
  "profileData": {}
}
Omit optional fields when they do not apply. Do not wrap the object in Markdown.`,
            messages: messages.map((message: any) => ({
              role: message.role === "assistant" ? "assistant" : "user",
              content: String(message.content || ""),
            })),
          });
          resultData = parseCleanJSON(response.text);
          providerMetadata = { provider: response.provider, model: response.model };
        } catch (openAIError) {
          if (!process.env.GEMINI_API_KEY) throw openAIError;
          console.warn("[Boldi Provider] OpenAI failed; preserving the request through Gemini fallback.");
          const fallbackResponse = await generateContentWithFallback({
            model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
            contents: messages.map((message: any) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: String(message.content || "") }],
            })),
            config: {
              systemInstruction: `${prompt}\nReturn one valid JSON object with a required "reply" string. Do not use Markdown fences.`,
              responseMimeType: "application/json",
              temperature: userSettings.modelTemperature !== undefined ? userSettings.modelTemperature : 0.3,
            },
          });
          if (!fallbackResponse.text) throw new Error("Gemini fallback returned no assistant text");
          resultData = parseCleanJSON(fallbackResponse.text);
          providerMetadata = {
            provider: "gemini",
            model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
          };
        }
      } else {
        const response = await generateContentWithFallback({
          model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
          contents: messages.map((m: any) => ({
            role: m.role === "assistant" ? "model" : m.role,
            parts: [{ text: m.content }]
          })),
          config: {
            systemInstruction: prompt,
            responseMimeType: "application/json",
            temperature: userSettings.modelTemperature !== undefined ? userSettings.modelTemperature : 0.3,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING, description: "Your conversational reply to the executive" },
                toolName: { type: Type.STRING, description: "The internal tool you executed if any (e.g. onboarding, search_tasks, challenge_wip)" },
                actionPlan: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Action Plan Title" },
                    summary: { type: Type.STRING, description: "Executive summary of the changes" },
                    riskLevel: { type: Type.STRING, description: "low or medium or high" },
                    safetyLevel: { type: Type.INTEGER, description: "The maximum safety level of any action in the plan (1-5)" },
                    proposedActions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
	                          type: { type: Type.STRING, description: "create_task, reschedule_task, update_task, create_decision, create_followup, kill_or_archive, create_project, update_project, create_milestone, update_milestone, create_risk, update_risk, create_project_artifact, outbox_communication" },
                          proposedChange: { type: Type.OBJECT, description: "Arguments/properties to apply" },
                          reason: { type: Type.STRING, description: "Strategic justification" },
                          safetyLevel: { type: Type.INTEGER, description: "Safety level from 1 to 5" },
                          confidence: { type: Type.NUMBER }
                        },
                        required: ["type", "proposedChange", "reason", "safetyLevel"]
                      }
                    }
                  },
                  required: ["title", "summary", "riskLevel", "safetyLevel", "proposedActions"]
                },
                suggestedChips: { type: Type.ARRAY, items: { type: Type.STRING } },
                citations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      type: { type: Type.STRING }
                    },
                    required: ["id", "title"]
                  }
                },
                requiresProfileUpdate: { type: Type.BOOLEAN },
                profileData: { type: Type.OBJECT }
              },
              required: ["reply"]
            }
          }
        });

        if (!response.text) throw new Error("No response from AI");
        resultData = parseCleanJSON(response.text);
        providerMetadata = {
          provider: "gemini",
          model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
        };
      }

	      if (citationsList.length > 0 && !resultData.citations) {
	        resultData.citations = citationsList;
	      }
	      resultData = guardAssistantActionPlan(resultData, workspaceContext);
	      resultData.provider = providerMetadata;
      res.json(resultData);
    } catch (e: any) {
      console.error("[Boldi Chat Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/warroom/chat-orchestrate", async (req, res) => {
    try {
      const { chatId, messageId, workspaceId, userId, threadId } = req.body;
      if (!chatId || !messageId || !workspaceId || !userId) {
        return res.status(400).json({ error: "Missing required orchestration parameters" });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not initialized" });
      }

      // 1. Get user message
      const msgSnap = await dbAdmin.collection("war_room_messages").doc(messageId).get();
      if (!msgSnap.exists) {
        return res.status(404).json({ error: "Source message not found" });
      }
      const userMsg = msgSnap.data();

      // 2. Get chat document
      const chatSnap = await dbAdmin.collection("war_room_chats").doc(chatId).get();
      if (!chatSnap.exists) {
        return res.status(404).json({ error: "Chat room not found" });
      }
      const chatData = chatSnap.data();
      const linkedProjectId = chatData.linkedProjectId || null;

      // 3. Get workspace agents
      const agentsSnap = await dbAdmin.collection("boldi_agents")
        .where("workspaceId", "==", workspaceId)
        .where("status", "==", "active")
        .get();
      const workspaceAgents = agentsSnap.docs.map((d: any) => d.data());

      // 4. Retrieve linked project context if available
      let projectContextString = "";
      if (linkedProjectId) {
        const projDoc = await dbAdmin.collection("projects").doc(linkedProjectId).get();
        if (projDoc.exists) {
          const projData = projDoc.data();
          // Also fetch active tasks
          const tasksSnap = await dbAdmin.collection("tasks")
            .where("projectId", "==", linkedProjectId)
            .get();
          const tasksList = tasksSnap.docs.map((d: any) => ({
            id: d.id,
            title: d.data().title,
            status: d.data().status,
            priority: d.data().priority,
            dueDate: d.data().dueDate
          }));
          projectContextString = `Linked Project Context:\nProject Title: ${projData.title}\nDescription: ${projData.description || 'none'}\nHealth: ${projData.health || 'unknown'}\nTasks:\n${JSON.stringify(tasksList, null, 2)}`;
        }
      }

      // 5. Get recent chat history
      let historyQuery = dbAdmin.collection("war_room_messages")
        .where("chatId", "==", chatId);
      
      if (threadId) {
        historyQuery = historyQuery.where("threadId", "==", threadId);
      } else {
        // Only fetch main channel messages
        historyQuery = historyQuery.where("threadId", "==", null);
      }

      const historySnap = await historyQuery.orderBy("createdAt", "desc").limit(15).get();
      const recentMessages = historySnap.docs.map((d: any) => ({
        id: d.id,
        senderType: d.data().senderType,
        senderAgentId: d.data().senderAgentId,
        content: d.data().content,
        messageType: d.data().messageType
      })).reverse();

      // 6. Multi-agent Orchestration queue
      // Determine which agents should participate.
      // Rule A: If user explicitly @mentioned some agents, queue them in order.
      // Rule B: If no explicit @mentions, run the "orchestrator" agent to coordinate.
      let executionQueue: any[] = [];
      const mentionedAgentIds = userMsg.mentionsAgentIds || [];
      
      if (mentionedAgentIds.length > 0) {
        executionQueue = workspaceAgents.filter((a: any) => mentionedAgentIds.includes(a.id));
      } else {
        // Default to Orchestrator
        const orchestrator = workspaceAgents.find((a: any) => a.slug === "orchestrator") || workspaceAgents[0];
        if (orchestrator) executionQueue.push(orchestrator);
      }

      if (executionQueue.length === 0) {
        return res.json({ status: "ok", message: "No active agents selected for execution" });
      }

      let turnCount = 0;
      const maxTurns = 3;
      const processedAgentIds = new Set<string>();

      while (executionQueue.length > 0 && turnCount < maxTurns) {
        const currentAgent = executionQueue.shift();
        if (!currentAgent || processedAgentIds.has(currentAgent.id)) continue;
        
        processedAgentIds.add(currentAgent.id);
        turnCount++;

        // a. Create Agent Run record
        const runRef = await dbAdmin.collection("agent_runs").add({
          workspaceId,
          chatId,
          threadId: threadId || null,
          agentId: currentAgent.id,
          triggerMessageId: messageId,
          runType: "reply",
          status: "running",
          inputSummary: userMsg.content,
          modelProvider: currentAgent.modelProvider || "google",
          modelName: currentAgent.modelName || process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // b. Generate content with Fallback
        const currentServerDate = new Date().toISOString().slice(0, 10);
        const systemPrompt = `
You are ${currentAgent.name}, a highly specialized AI collaborator.
Your specialized persona guidelines:
${currentAgent.systemPrompt}

Current Date: ${currentServerDate}
${projectContextString}

Recent Conversation History:
${JSON.stringify(recentMessages, null, 2)}

Your task:
Analyze the user's input: "${userMsg.content}" and the previous conversation context.
Formulate a highly strategic, professional response conforming to your persona.

Optional Deliverables:
1. "widget_payload": If this conversation requires a high-fidelity deliverable (like a structured project plan, roadmaps, research brief, decision matrix, comparative tables, metrics table), generate a structured Widget. If not, set it to null.
2. "action_plan_proposed": If you propose concrete modifications to the workspace database (such as creating tasks or milestone schedules for projects), draft an Action Plan. Ensure all safety levels and metrics are populated.

Respond STRICTLY in a valid JSON schema:
{
  "response_text": "Your direct reply content. Use markdown inside if needed.",
  "mentions_agents": ["slug1", "slug2"], // Mention other specialized agents (e.g., "leo_engineer", "ava_pm") only if their expert input is required for the next turn. Leave empty if the thread is concluded.
  "action_plan_proposed": null or {
    "title": "strategic plan title",
    "summary": "overall action summary",
    "riskLevel": "low | medium | high",
    "proposed_actions": [
      {
        "type": "create_task",
        "payload": {
          "title": "task title",
          "priority": "P1 | P2 | P3",
          "dueDate": "YYYY-MM-DD",
          "gtdContext": "deep_work | computer | office",
          "itemType": "next_action"
        }
      }
    ]
  },
  "widget_payload": null or {
    "document_title": "title of the deliverable",
    "version_tag": "v1.0.0",
    "hero_metrics": [
      { "label": "Label name", "value": "Value text", "subtext": "optional detail" }
    ],
    "navigation_tabs": [
      { "tab_id": "tab1", "tab_title": "tab title", "markdown_body": "full detailed markdown" }
    ],
    "source_summary": "grounding sources",
    "confidence": "high | medium | low",
    "open_questions": ["questions"]
  }
}
`;

        try {
          const aiResponse = await generateContentWithFallback({
            model: currentAgent.modelName || process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          });

          const resText = aiResponse?.text || aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!resText) throw new Error(`Empty response from Gemini API for agent ${currentAgent.name}`);

          const parsed = parseCleanJSON(resText);
          if (!parsed) throw new Error(`Failed to parse valid JSON from Gemini response`);

          let linkedWidgetId: string | null = null;
          let messageType = "text";

          // Create Widget Deliverable if proposed
          if (parsed.widget_payload) {
            const wPayload = parsed.widget_payload;
            
            // Check if a widget with this title already exists in the chat to mutate it (v2, v3, etc.)
            const existingWidgetsSnap = await dbAdmin.collection("war_room_widgets")
              .where("chatId", "==", chatId)
              .where("title", "==", wPayload.document_title)
              .get();
            
            let widgetId = "";
            let nextVersionNumber = 1;

            if (!existingWidgetsSnap.empty) {
              const extW = existingWidgetsSnap.docs[0];
              widgetId = extW.id;
              // Get current versions count
              const versSnap = await dbAdmin.collection("war_room_widget_versions")
                .where("widgetId", "==", widgetId)
                .get();
              nextVersionNumber = versSnap.size + 1;
            } else {
              const widgetRef = await dbAdmin.collection("war_room_widgets").add({
                workspaceId,
                chatId,
                threadId: threadId || null,
                title: wPayload.document_title,
                widgetType: "document",
                status: "active",
                createdByAgentId: currentAgent.id,
                linkedProjectId,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              widgetId = widgetRef.id;
            }

            // Write version
            const verRef = await dbAdmin.collection("war_room_widget_versions").add({
              workspaceId,
              widgetId,
              versionNumber: nextVersionNumber,
              versionTag: `v${nextVersionNumber}.0.0`,
              title: wPayload.document_title,
              heroMetrics: wPayload.hero_metrics || [],
              navigationTabs: wPayload.navigation_tabs || [],
              markdownBody: wPayload.navigation_tabs?.map((t: any) => `### ${t.tab_title}\n${t.markdown_body}`).join("\n\n") || "",
              jsonPayload: wPayload,
              sourceAgentRunId: runRef.id,
              changedByAgentId: currentAgent.id,
              createdAt: new Date()
            });

            // Update widget currentVersionId
            await dbAdmin.collection("war_room_widgets").doc(widgetId).update({
              currentVersionId: verRef.id,
              updatedAt: new Date()
            });

            linkedWidgetId = widgetId;
          }

          // Create Action Plan if proposed
          if (parsed.action_plan_proposed) {
            const plan = parsed.action_plan_proposed;
            const planRef = await dbAdmin.collection("war_room_action_plans").add({
              workspaceId,
              chatId,
              threadId: threadId || null,
              title: plan.title,
              summary: plan.summary,
              proposedByAgentId: currentAgent.id,
              status: "needs_approval",
              proposedActions: plan.proposed_actions || [],
              affectedEntityTypes: ["tasks"],
              affectedRecordCount: plan.proposed_actions?.length || 0,
              riskLevel: plan.riskLevel || "medium",
              createdBy: userId,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            messageType = "action_plan";
          }

          // Save agent's message doc
          const agentMsgRef = await dbAdmin.collection("war_room_messages").add({
            workspaceId,
            chatId,
            threadId: threadId || null,
            senderType: "agent",
            senderAgentId: currentAgent.id,
            messageType,
            content: parsed.response_text || "",
            linkedWidgetId: linkedWidgetId || null,
            status: "sent",
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // Log run completion
          await dbAdmin.collection("agent_runs").doc(runRef.id).update({
            status: "completed",
            outputSummary: parsed.response_text?.substring(0, 200),
            completedAt: new Date(),
            updatedAt: new Date()
          });

          // Append newly generated message to history
          recentMessages.push({
            id: agentMsgRef.id,
            senderType: "agent",
            senderAgentId: currentAgent.id,
            content: parsed.response_text || "",
            messageType
          });

          // Queue newly mentioned agents if any
          if (parsed.mentions_agents && Array.isArray(parsed.mentions_agents)) {
            parsed.mentions_agents.forEach((slug: string) => {
              const matchedAgent = workspaceAgents.find((a: any) => a.slug === slug);
              if (matchedAgent && !processedAgentIds.has(matchedAgent.id)) {
                executionQueue.push(matchedAgent);
              }
            });
          }

        } catch (runErr: any) {
          console.error(`[Agent Run Failure] Agent: ${currentAgent.name}`, runErr);
          await dbAdmin.collection("agent_runs").doc(runRef.id).update({
            status: "failed",
            error: runErr.message || "Unknown error",
            completedAt: new Date(),
            updatedAt: new Date()
          });
          // Also save standard system error message
          await dbAdmin.collection("war_room_messages").add({
            workspaceId,
            chatId,
            threadId: threadId || null,
            senderType: "system",
            messageType: "system",
            content: `Agent ${currentAgent.name} failed to complete run. Reason: ${runErr.message || 'stateless exception'}`,
            status: "sent",
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      res.json({ status: "ok", turnsExecuted: turnCount });

    } catch (err: any) {
      console.error("[Chat Orchestration Endpoint Error]", err);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", err);
    }
  });

  app.post("/api/warroom/apply-action-plan", async (req, res) => {
    try {
      const { actionPlanId, workspaceId, userId } = req.body;
      if (!actionPlanId || !workspaceId || !userId) {
        return res.status(400).json({ error: "Missing action execution variables" });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured" });
      }

      const planDoc = await dbAdmin.collection("war_room_action_plans").doc(actionPlanId).get();
      if (!planDoc.exists) {
        return res.status(404).json({ error: "Action plan document not found" });
      }
      const plan = planDoc.data();

      const createdTasksIds: string[] = [];

      for (const act of plan.proposedActions) {
        if (act.type === "create_task") {
          const taskRef = await dbAdmin.collection("tasks").add({
            userId,
            workspaceId,
            title: act.payload.title || "Strategic Draft Task",
            status: "todo",
            priority: act.payload.priority || "P3",
            dueDate: act.payload.dueDate || null,
            gtdContext: act.payload.gtdContext || "computer",
            itemType: act.payload.itemType || "next_action",
            tags: ["war-room-automated"],
            boldiActionPlanId: actionPlanId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          createdTasksIds.push(taskRef.id);
        }
      }

      await dbAdmin.collection("war_room_action_plans").doc(actionPlanId).update({
        status: "applied",
        appliedAt: new Date(),
        updatedAt: new Date()
      });

      // Write system announcement message back to chat
      await dbAdmin.collection("war_room_messages").add({
        workspaceId,
        chatId: plan.chatId,
        threadId: plan.threadId || null,
        senderType: "system",
        messageType: "system",
        content: `Action Plan applied. Created database Tasks: ${createdTasksIds.join(", ")}. Verification complete.`,
        status: "sent",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      res.json({ status: "ok", createdTasksCount: createdTasksIds.length });

    } catch (err: any) {
      console.error("[Apply Action Plan Error]", err);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", err);
    }
  });

  app.post("/api/boldi/audit-task-metadata", async (req, res) => {
    try {
      const { workspaceId, userId, filters } = req.body;
      if (!userId || !workspaceId) {
        return res.status(400).json({ error: "Missing userId or workspaceId" });
      }

      if (!dbAdmin) {
        return res.status(500).json({ error: "Firestore Admin SDK is not initialized" });
      }

      let queryRef: any = dbAdmin.collection("tasks")
        .where("userId", "==", userId)
        .where("workspaceId", "==", workspaceId);

      const snapshot = await queryRef.get();
      
      let totalScanned = 0;
      let incompleteCount = 0;
      let completeCount = 0;
      const items: any[] = [];

      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data();
        const id = docSnap.id;
        
        // Skip subtasks
        if (data.parentId) return;

        const isCompleted = data.status === "done" || data.stageId === "done";
        
        const includeCompleted = filters?.includeCompleted ?? false;
        const includeArchived = filters?.includeArchived ?? false;

        if (isCompleted && !includeCompleted) return;
        if (data.status === "archived" && !includeArchived) return;

        totalScanned++;

        const missingFields: string[] = [];
        
        // Priority
        const p = data.priority;
        if (p === undefined || p === null || p === "") {
          missingFields.push("priority");
        }
        
        // Due Date
        if (!data.dueDate) {
          missingFields.push("dueDate");
        }
        
        // Action type
        if (!data.itemType || data.itemType === "task" || data.itemType === "") {
          missingFields.push("actionType");
        }
        
        // Context
        if (!data.gtdContext || data.gtdContext === "" || data.gtdContext === "all") {
          missingFields.push("context");
        }
        
        // Project
        if (!data.projectId) {
          missingFields.push("projectId");
        }

        // Stakeholder
        if (!data.stakeholderIds || data.stakeholderIds.length === 0) {
          missingFields.push("stakeholder");
        }

        // Category
        if ((!data.categoryIds || data.categoryIds.length === 0) && !data.categoryId) {
          missingFields.push("category");
        }

        const isIncomplete = missingFields.length > 0;
        if (isIncomplete) {
          incompleteCount++;
          items.push({
            id,
            title: data.title || "Untitled Task",
            missingFields,
            currentValues: {
              priority: data.priority ?? null,
              dueDate: data.dueDate ?? null,
              context: data.gtdContext ?? null,
              actionType: data.itemType ?? null,
              projectId: data.projectId ?? null,
              stakeholderIds: data.stakeholderIds ?? [],
              categoryIds: data.categoryIds ?? (data.categoryId ? [data.categoryId] : []),
              tags: data.tags ?? [],
              status: data.status ?? "open"
            }
          });
        } else {
          completeCount++;
        }
      });

      res.json({
        totalScanned,
        incompleteCount,
        completeCount,
        items
      });
    } catch (e: any) {
      console.error("[Audit Metadata Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/boldi/bulk-enrich-tasks", async (req, res) => {
    try {
      const { userId, workspaceId } = req.body;
      if (!userId || !workspaceId) {
        return res.status(400).json({ error: "Missing userId or workspaceId" });
      }

      if (!dbAdmin) {
        return res.status(500).json({ error: "Firestore Admin SDK is not initialized" });
      }

      // 1. Fetch incomplete tasks
      const tasksSnapshot = await dbAdmin.collection("tasks")
        .where("userId", "==", userId)
        .where("workspaceId", "==", workspaceId)
        .get();

      const incompleteTasks: any[] = [];
      tasksSnapshot.forEach((docSnap: any) => {
        const data = docSnap.data();
        if (data.parentId) return; // Skip subtasks
        const isCompleted = data.status === "done" || data.stageId === "done";
        if (isCompleted) return;
        if (data.status === "archived") return;

        const hasPriority = data.priority !== undefined && data.priority !== null && data.priority !== "";
        const hasDueDate = !!data.dueDate;
        const hasContext = data.gtdContext && data.gtdContext !== "" && data.gtdContext !== "all";
        const hasActionType = data.itemType && data.itemType !== "task" && data.itemType !== "";

        if (!hasPriority || !hasDueDate || !hasContext || !hasActionType) {
          incompleteTasks.push({
            id: docSnap.id,
            title: data.title || "Untitled Task",
            description: data.description || "",
            priority: data.priority ?? null,
            dueDate: data.dueDate ?? null,
            gtdContext: data.gtdContext ?? null,
            itemType: data.itemType ?? null,
            projectId: data.projectId ?? null,
            tags: data.tags ?? []
          });
        }
      });

      if (incompleteTasks.length === 0) {
        return res.json({ message: "No incomplete tasks found to enrich", count: 0, updatedTasks: [] });
      }

      // Limit to 15 tasks per request to prevent token limits and ensure high accuracy
      const tasksToEnrich = incompleteTasks.slice(0, 15);

      // 2. Fetch projects
      const projectsSnapshot = await dbAdmin.collection("projects")
        .where("workspaceId", "==", workspaceId)
        .get();
      
      const projects: any[] = [];
      projectsSnapshot.forEach((docSnap: any) => {
        projects.push({
          id: docSnap.id,
          name: docSnap.data().name || "Untitled Project"
        });
      });

      // 3. Prompt Gemini
      const prompt = `You are Boldi, an elite AI organization assistant.
      We have ${tasksToEnrich.length} tasks that are missing essential GTD/Gazelle attributes (Priority, Due Date, GTD Context, Action Type, Project, or Tags).
      Analyze each task and suggest optimal metadata attributes.

      TASKS TO ANALYZE:
      ${JSON.stringify(tasksToEnrich.map(t => ({ id: t.id, title: t.title, description: t.description })))}

      AVAILABLE PROJECTS:
      ${JSON.stringify(projects)}

      INFERENCE RULES:
      - Priority: Use 1 (P1-Urgent), 2 (P2-Important), 3 (P3-Normal), 4 (P4-Low), or null. Avoid default P4.
      - Due Date: Suggest YYYY-MM-DD or null. If urgent, suggest this week. If normal, suggest next week. Use current date (${new Date().toISOString().slice(0, 10)}) as reference.
      - Context: One of [@computer, @home, @office, @calls, @anywhere] or null.
      - Action Type: One of [next_action, waiting_for, someday, routine_follow_up] or null.
      - Project: Link to one of the available project IDs if relevant, or null.
      - Tags: Array of 1-3 short strings (e.g. ["marketing", "finance", "quick-win"]).
      - Reason: A brief 1-sentence strategic justification.

      You must return your response in JSON format matching this schema:
      {
        "suggestions": [
          {
            "taskId": "string",
            "priority": number | null,
            "dueDate": "string" | null,
            "context": "string" | null,
            "actionType": "string" | null,
            "projectId": "string" | null,
            "tags": ["string"],
            "reason": "string"
          }
        ]
      }`;

      const aiResponse = await generateContentWithFallback({
        model: "gemini-3.1-flash-lite", // Fallback to Lite first as Flash is hitting daily quotas
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      if (!aiResponse.text) {
        throw new Error("No response from AI agent");
      }

      let cleanText = aiResponse.text.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/```\s*$/g, "").trim();
      }
      const payload = JSON.parse(cleanText);
      const suggestions = payload.suggestions || [];

      // 4. Batch-apply updates
      const updatedTasks = [];
      const batch = dbAdmin.batch();

      for (const sugg of suggestions) {
        const task = tasksToEnrich.find(t => t.id === sugg.taskId);
        if (!task) continue;

        const docRef = dbAdmin.collection("tasks").doc(sugg.taskId);
        const updates: any = {
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
          boldiActionPlanId: "bulk-enrichment"
        };

        if (sugg.priority !== undefined && sugg.priority !== null) updates.priority = sugg.priority;
        if (sugg.dueDate !== undefined && sugg.dueDate !== null) updates.dueDate = sugg.dueDate;
        if (sugg.context !== undefined && sugg.context !== null) updates.gtdContext = sugg.context;
        if (sugg.actionType !== undefined && sugg.actionType !== null) updates.itemType = sugg.actionType;
        if (sugg.projectId !== undefined && sugg.projectId !== null) updates.projectId = sugg.projectId;
        
        // Merge tags
        if (sugg.tags && Array.isArray(sugg.tags)) {
          const mergedTags = Array.from(new Set([...(task.tags || []), ...sugg.tags]));
          updates.tags = mergedTags;
        }

        batch.update(docRef, updates);
        updatedTasks.push({
          id: sugg.taskId,
          title: task.title,
          updates: {
            priority: sugg.priority,
            dueDate: sugg.dueDate,
            context: sugg.context,
            actionType: sugg.actionType,
            projectId: sugg.projectId,
            tags: sugg.tags
          },
          reason: sugg.reason
        });
      }

      await batch.commit();

      res.json({
        message: `Successfully enriched \${updatedTasks.length} tasks in bulk`,
        count: updatedTasks.length,
        updatedTasks
      });

    } catch (e: any) {
      console.error("[Bulk Enrich Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/boldi/apply-task-metadata-updates", async (req, res) => {
    try {
      const { updates, userId, workspaceId } = req.body;
      if (!userId || !workspaceId) {
        return res.status(400).json({ error: "Missing userId or workspaceId" });
      }

      if (!dbAdmin) {
        return res.status(500).json({ error: "Firestore Admin SDK is not initialized" });
      }

      const results: any[] = [];
      let requestedUpdates = updates?.length || 0;
      let appliedUpdates = 0;
      let failedUpdates = 0;
      let verifiedUpdates = 0;

      for (const update of (updates || [])) {
        const { taskId, changes, reason } = update;
        try {
          const taskRef = dbAdmin.collection("tasks").doc(taskId);
          const taskDoc = await taskRef.get();

          if (!taskDoc.exists) {
            results.push({
              taskId,
              title: "Unknown Task",
              status: "failed",
              error: "Task does not exist",
              verified: false
            });
            failedUpdates++;
            continue;
          }

          const beforeData = taskDoc.data();
          if (beforeData.workspaceId !== workspaceId) {
            results.push({
              taskId,
              title: beforeData.title || "Untitled Task",
              status: "failed",
              error: "Unauthorized workspace mismatch",
              verified: false
            });
            failedUpdates++;
            continue;
          }

          const dbUpdates: any = {
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: userId,
            boldiActionPlanId: update.boldiActionPlanId || "standardization"
          };

          if (changes.priority !== undefined) {
            dbUpdates.priority = changes.priority === null ? FieldValue.delete() : changes.priority;
          }
          if (changes.dueDate !== undefined) {
            dbUpdates.dueDate = changes.dueDate === null ? FieldValue.delete() : changes.dueDate;
          }
          if (changes.actionType !== undefined) {
            dbUpdates.itemType = changes.actionType === null ? FieldValue.delete() : changes.actionType;
          }
          if (changes.context !== undefined) {
            dbUpdates.gtdContext = changes.context === null ? FieldValue.delete() : changes.context;
          }
          if (changes.projectId !== undefined) {
            dbUpdates.projectId = changes.projectId === null ? FieldValue.delete() : changes.projectId;
          }
          if (changes.tags !== undefined) {
            dbUpdates.tags = changes.tags;
          }

          await taskRef.update(dbUpdates);
          appliedUpdates++;

          // Verification post-write refetch
          const refetchedDoc = await taskRef.get();
          const afterData = refetchedDoc.data();

          let verified = true;
          if (changes.priority !== undefined && changes.priority !== (afterData.priority ?? null)) {
            verified = false;
          }
          if (changes.dueDate !== undefined && changes.dueDate !== (afterData.dueDate ?? null)) {
            verified = false;
          }
          if (changes.actionType !== undefined && changes.actionType !== (afterData.itemType ?? null)) {
            verified = false;
          }
          if (changes.context !== undefined && changes.context !== (afterData.gtdContext ?? null)) {
            verified = false;
          }
          if (changes.projectId !== undefined && changes.projectId !== (afterData.projectId ?? null)) {
            verified = false;
          }

          if (verified) {
            verifiedUpdates++;
          }

          results.push({
            taskId,
            title: beforeData.title || "Untitled Task",
            status: "applied",
            before: {
              priority: beforeData.priority ?? null,
              dueDate: beforeData.dueDate ?? null,
              context: beforeData.gtdContext ?? null,
              actionType: beforeData.itemType ?? null,
              projectId: beforeData.projectId ?? null
            },
            after: {
              priority: afterData.priority ?? null,
              dueDate: afterData.dueDate ?? null,
              context: afterData.gtdContext ?? null,
              actionType: afterData.itemType ?? null,
              projectId: afterData.projectId ?? null
            },
            verified,
            error: null
          });

          await dbAdmin.collection("boldi_actions").add({
            userId,
            workspaceId,
            type: "update_task",
            targetEntityType: "tasks",
            targetEntityId: taskId,
            beforeState: {
              priority: beforeData.priority ?? null,
              dueDate: beforeData.dueDate ?? null,
              context: beforeData.gtdContext ?? null,
              itemType: beforeData.itemType ?? null,
              projectId: beforeData.projectId ?? null
            },
            proposedChange: {
              priority: changes.priority ?? null,
              dueDate: changes.dueDate ?? null,
              gtdContext: changes.context ?? null,
              itemType: changes.actionType ?? null,
              projectId: changes.projectId ?? null
            },
            reason: reason || "Bulk standardization update",
            confidence: 1.0,
            status: "applied",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });

        } catch (taskErr: any) {
          console.error(`Failed updating task ${taskId}`, taskErr);
          results.push({
            taskId,
            title: "Unknown Title",
            status: "failed",
            error: taskErr.message,
            verified: false
          });
          failedUpdates++;
        }
      }

      res.json({
        requestedUpdates,
        appliedUpdates,
        failedUpdates,
        verifiedUpdates,
        results
      });
    } catch (e: any) {
      console.error("[Apply Updates Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/boldi/daily-brief", async (req, res) => {
    try {
      const { tasks, projects, goals, stakeholders, alerts, claritySession, dailyMetric } = req.body;
      
      const prompt = `You are Gazelle, ${principalDisplayName(req)}'s Chief of Staff. Generate an exceptional, cohesive Daily Executive briefing using the real workspace data provided.
      
      CURRENT DATE: ${new Date().toLocaleDateString()}
      ACTIVE STRATEGIC GOALS / WIGs:
      ${JSON.stringify(goals)}
      
      ACTIVE PROJECTS & DEALS:
      ${JSON.stringify(projects)}
      
      OPEN TASKS / BACKLOG:
      ${JSON.stringify(tasks)}
      
      KEY STAKEHOLDERS:
      ${JSON.stringify(stakeholders)}
      
      ACTIVE DRIFT ALERTS / SYSTEM ALERTS:
      ${JSON.stringify(alerts)}

      CLARITY SESSIONS / WHOOP METRIC ENTRYS:
      ${JSON.stringify({ claritySession, dailyMetric })}

      Synthesize all of this context. Answer:
      1. What is the single highest leverage Strategic Objective or WIG focus today?
      2. Recommand the absolute ONE Thing ${principalDisplayName(req)} must complete today. Provide a very clear justification.
      3. Recommend up to 3 highly critical "Should Dos" tasks (Top 3) with justifications.
      4. Detect active project alerts or stagnation risks.
      5. Identify outstanding stakeholder commitments or follow-ups.
      6. Draft clean, responsive calendar time-blocking slots (deep work, meetings, planning, recoveries) that fit the day.
      7. Provide high-level recommendations (keep, delegate, kill tasks).
      If some workspace collections are empty, provide appropriate recommendations and note "Not enough data yet" for that specific section.`;

      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              strategicObjective: { type: Type.STRING },
              recommendedOneThing: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  linkedGoalIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  linkedTaskId: { type: Type.STRING }
                },
                required: ["title", "reason"]
              },
              recommendedTop3: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    linkedTaskId: { type: Type.STRING },
                    linkedProjectId: { type: Type.STRING }
                  },
                  required: ["title", "reason"]
                }
              },
              projectAlerts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    projectId: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    riskLevel: { type: Type.STRING },
                    suggestedAction: { type: Type.STRING }
                  },
                  required: ["projectId", "reason", "riskLevel"]
                }
              },
              stakeholderFollowUps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stakeholderId: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    suggestedAction: { type: Type.STRING }
                  },
                  required: ["stakeholderId", "reason", "suggestedAction"]
                }
              },
              timeBlockSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, description: "deep_work or admin or follow_up or meetings or planning or recovery" },
                    durationMinutes: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                    linkedTaskIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "type", "durationMinutes", "reason"]
                }
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, description: "task, decision, project_review, stakeholder_followup, time_block, delegate, kill" },
                    reason: { type: Type.STRING }
                  },
                  required: ["title", "type", "reason"]
                }
              },
              missingData: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "strategicObjective", "recommendedOneThing", "recommendedTop3", "projectAlerts", "stakeholderFollowUps", "timeBlockSuggestions", "recommendations"]
          }
        }
      });

      if (!response.text) throw new Error("No response from AI");
      let jsonStr = response.text.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (e: any) {
      console.error("[Boldi Daily Brief Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/boldi/process-meeting", async (req, res) => {
    try {
      const { rawInput, title, meetingDate, projectContext } = req.body;
      
      const prompt = `You are a masterful Chief of Staff and elite productivity strategist. Your task is to process this executive meeting transcript, raw notes, or notes dump into highly structured, actionable intelligence.
      
      MEETING TITLE: ${title || "Default Sync"}
      DATE: ${meetingDate || new Date().toLocaleDateString()}
      PROJECT DETAILS IF ASSOCIATED: ${JSON.stringify(projectContext)}
      
      RAW INPUT:
      "${rawInput}"
      
      CRITICAL INSTRUCTIONS:
      1. Exhaustive Extraction: You MUST extract EVERY SINGLE action item, commitment, task, next step, or follow-up mentioned in the notes. Do not miss or summarize multiple distinct tasks into one. If there are 15 tasks, list all 15.
      2. Infer Implicit Actions: Think beyond the explicit words. If a discussion logically requires preparation, follow-up, or a specific next step that wasn't explicitly stated, infer it and add it as a necessary action item.
      3. Rephrase for Clarity: Rephrase each extracted item into a well-crafted, robust, actionable task statement. It MUST start with a strong action verb (e.g., "Review", "Email", "Draft", "Schedule").
      4. Analyze the ENTIRE text from beginning to end to ensure absolutely nothing falls through the cracks.
      
      Extract and structure the output into the following:
      1. One short, concise summary of the session.
      2. Key Decisions (with titles, justification, owners, and dates).
      3. Action Items / Tasks (including titles starting with a verb, description, project references, owner, and due dates).
      4. Outstanding "Waiting For" elements.
      5. Project updates & health adjustments.
      6. Stakeholder follow-ups.
      7. Identified risks and blockers.
      8. Open Questions remaining.
      9. Knowledge candidates/SOP notes that should be retained for future reference.`;

      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              decisions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    owner: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["title", "description", "reason"]
                }
              },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    owner: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    projectId: { type: Type.STRING }
                  },
                  required: ["title", "description"]
                }
              },
              waitingFor: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    person: { type: Type.STRING },
                    dueDate: { type: Type.STRING }
                  },
                  required: ["title"]
                }
              },
              projectUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    projectId: { type: Type.STRING },
                    update: { type: Type.STRING },
                    healthSignal: { type: Type.STRING, description: "on_track or at_risk or blocked or unknown" }
                  },
                  required: ["update", "healthSignal"]
                }
              },
              stakeholderFollowUps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stakeholderId: { type: Type.STRING },
                    name: { type: Type.STRING },
                    suggestedFollowUp: { type: Type.STRING }
                  },
                  required: ["name", "suggestedFollowUp"]
                }
              },
              risks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    severity: { type: Type.STRING, description: "low or medium or high" }
                  },
                  required: ["title", "description", "severity"]
                }
              },
              openQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              knowledgeCandidates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    body: { type: Type.STRING },
                    type: { type: Type.STRING, description: "project_context or client_context or decision_record or meeting_insight or sop or note" }
                  },
                  required: ["title", "body", "type"]
                }
              }
            },
            required: ["summary", "decisions", "actionItems", "waitingFor", "projectUpdates", "stakeholderFollowUps", "risks", "openQuestions", "knowledgeCandidates"]
          }
        }
      });

      if (!response.text) throw new Error("No response from AI");
      let jsonStr = response.text.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (e: any) {
      console.error("[Process Meeting Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/boldi/align-work", async (req, res) => {
    try {
      const { tasks, projects, goals } = req.body;
      
      const prompt = `You are a strategic alignment engine. Auditing ${principalDisplayName(req)}'s current task list and projects against the highest priority WIGs and OKR objectives.
      
      WIGs & OKRs:
      ${JSON.stringify(goals)}
      
      PROJECTS:
      ${JSON.stringify(projects)}
      
      TASKS:
      ${JSON.stringify(tasks)}
      
      Analyze each task and project. Suggest links to specific active WIGs/Goals/Strategic Initiatives.
      Assign a strategic alignment score (0-100) based on actual impact on goals.
      Propose strategic actions such as: Keep, Schedule, Delegate (if busywork), Kill (if completely unaligned), Clarify, Link to Goal.
      Explain the strategic alignment reasoning clinically.`;

      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING, description: "Task or Project ID" },
                    itemType: { type: Type.STRING, description: "task or project or milestone" },
                    suggestedGoalIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    suggestedInitiativeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    strategicAlignmentScore: { type: Type.NUMBER, description: "0-100 score" },
                    reason: { type: Type.STRING },
                    suggestedAction: { type: Type.STRING, description: "keep, schedule, delegate, kill, clarify, link_to_goal" },
                    confidence: { type: Type.NUMBER }
                  },
                  required: ["itemId", "itemType", "suggestedGoalIds", "strategicAlignmentScore", "reason", "suggestedAction", "confidence"]
                }
              }
            },
            required: ["suggestions"]
          }
        }
      });

      if (!response.text) throw new Error("No response from AI");
      let jsonStr = response.text.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (e: any) {
      console.error("[Strategic Alignment Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.post("/api/boldi/weekly-review", async (req, res) => {
    try {
      const { tasks, projects, goals, timeBlocks, previousReview } = req.body;
      
      const prompt = `You are Gazelle, performing a Strategic Weekly Executive Review for ${principalDisplayName(req)}.
      
      COMPLETED & OPEN TASKS:
      ${JSON.stringify(tasks)}
      
      PROJECTS & STATUS:
      ${JSON.stringify(projects)}
      
      WIG STATE:
      ${JSON.stringify(goals)}
      
      TIME BLOCKED BLOCKS DETECTED:
      ${JSON.stringify(timeBlocks)}

      PREVIOUS WEEK BRIEF:
      ${JSON.stringify(previousReview)}

      Synthesize and calculate:
      - WIG / OKR Movement and key results achievements.
      - Strategic busywork ratio (High priority tasks completed vs total petty/P3/P4 tasks completed).
      - Highlight stuck or slow projects with suggested alignment overrides.
      - Stakeholder risks.
      - Recommandations on what to Kill, Defer, or Delegate.
      - Next week's theme and main focal objectives.`;

      const response = await generateContentWithFallback({
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              weeklyTheme: { type: Type.STRING },
              summary: { type: Type.STRING },
              wigMovement: { type: Type.STRING },
              busyworkRatio: { type: Type.NUMBER, description: "Percentage of time spent on high leverage vs busywork" },
              completedOneThings: { type: Type.ARRAY, items: { type: Type.STRING } },
              projectReviews: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    projectId: { type: Type.STRING },
                    status: { type: Type.STRING },
                    stuckReason: { type: Type.STRING },
                    actionNeeded: { type: Type.STRING }
                  },
                  required: ["projectId", "status", "actionNeeded"]
                }
              },
              stakeholderRisks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    risk: { type: Type.STRING },
                    mitigation: { type: Type.STRING }
                  },
                  required: ["name", "risk", "mitigation"]
                }
              },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              nextWeekObjectives: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["weeklyTheme", "summary", "wigMovement", "busyworkRatio", "completedOneThings", "projectReviews", "stakeholderRisks", "recommendations", "nextWeekObjectives"]
          }
        }
      });

      if (!response.text) throw new Error("No response from AI");
      let jsonStr = response.text.replace(/^```json\n?/g, '').replace(/```\n?$/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (e: any) {
      console.error("[Weekly Review Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // ==========================================
  // GAZELLE DATABASE & DATA MANAGEMENT ENDPOINTS
  // ==========================================

  const DATA_MANAGEMENT_COLLECTIONS = [
    "projects",
    "tasks",
    "milestones",
    "stakeholders",
    "meetings",
    "decisions",
    "waiting_for",
    "playbooks",
    "skills",
    "knowledge_items",
    "review_candidates",
    "habits",
    "workout_sessions"
  ];

  function normalizeString(str: string): string {
    if (!str) return "";
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  }

  // 1. Live Data Quality Audit
  app.post("/api/data-management/audit", async (req, res) => {
    try {
      const { userId, workspaceId } = req.body;
      if (!userId || !workspaceId) {
        return res.status(400).json({ error: "userId and workspaceId are required in body." });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured. Database operations are unavailable." });
      }

      const issues: any[] = [];
      const stats: any = {};
      let criticalCount = 0;
      let totalCount = 0;

      // Map to hold known project IDs to detect orphaned tasks/milestones
      const projectIdsSet = new Set<string>();
      const projectWorkspaceMap = new Map<string, string>();

      // Pre-scan projects
      try {
        const projSnap = await dbAdmin.collection("projects").where("userId", "==", userId).get();
        projSnap.forEach((doc: any) => {
          projectIdsSet.add(doc.id);
          const data = doc.data();
          if (data.workspaceId) {
            projectWorkspaceMap.set(doc.id, data.workspaceId);
          }
        });
      } catch (err) {
        console.error("Failed to pre-scan projects:", err);
      }

      // Scan each collection
      for (const col of DATA_MANAGEMENT_COLLECTIONS) {
        try {
          const snapshot = await dbAdmin.collection(col).where("userId", "==", userId).get();
          stats[col] = snapshot.size;
          totalCount += snapshot.size;

          const tagsSeenInWorkspace = new Set<string>();
          const categoriesSeenInWorkspace = new Set<string>();

          snapshot.forEach((doc: any) => {
            const data = doc.data();
            const recordId = doc.id;

            // Check Workspace Scope
            if (!data.workspaceId) {
              criticalCount++;
              issues.push({
                id: `ws-${col}-${recordId}`,
                severity: "critical",
                collection: col,
                recordId,
                issueType: "missing_workspace_id",
                description: `Record is missing its workspaceId. This violates multi-tenant isolation.`,
                suggestedFix: `Assign default workspaceId: ${workspaceId}`,
                autoFixAvailable: true
              });
            } else if (data.workspaceId !== workspaceId) {
              // Not an issue if they are in another valid workspace, but we log if it has a mismatch
            }

            // Check Timestamps
            if (!data.createdAt) {
              issues.push({
                id: `ts-create-${col}-${recordId}`,
                severity: "medium",
                collection: col,
                recordId,
                issueType: "missing_created_at",
                description: `Record is missing its createdAt timestamp.`,
                suggestedFix: `Assign current server timestamp.`,
                autoFixAvailable: true
              });
            }
            if (!data.updatedAt && !data.createdAt) {
              issues.push({
                id: `ts-update-${col}-${recordId}`,
                severity: "low",
                collection: col,
                recordId,
                issueType: "missing_updated_at",
                description: `Record is missing its updatedAt timestamp.`,
                suggestedFix: `Set updatedAt to createdAt.`,
                autoFixAvailable: true
              });
            }

            // Specific validation rules for Projects
            if (col === "projects") {
              const title = data.title || "";
              if (!title) {
                issues.push({
                  id: `proj-title-${recordId}`,
                  severity: "high",
                  collection: col,
                  recordId,
                  issueType: "empty_title",
                  description: `Project is missing a title.`,
                  suggestedFix: `Assign a placeholder title.`,
                  autoFixAvailable: true
                });
              }

              // Check normalization
              if (title && !data.normalizedTitle) {
                issues.push({
                  id: `proj-norm-${recordId}`,
                  severity: "low",
                  collection: col,
                  recordId,
                  issueType: "missing_normalization",
                  description: `Project is missing its search-optimized normalizedTitle.`,
                  suggestedFix: `Generate normalizedTitle from "${title}"`,
                  autoFixAvailable: true
                });
              }

              // Duplicate Tags inside projects
              if (Array.isArray(data.tags)) {
                data.tags.forEach((tag: string) => {
                  const norm = normalizeString(tag);
                  if (tagsSeenInWorkspace.has(norm)) {
                    issues.push({
                      id: `proj-tag-dup-${recordId}-${norm}`,
                      severity: "low",
                      collection: col,
                      recordId,
                      issueType: "duplicate_tag",
                      description: `Case-insensitive duplicate tag "${tag}" exists in the same project workspace.`,
                      suggestedFix: `Merge duplicate tags.`,
                      autoFixAvailable: true
                    });
                  } else {
                    tagsSeenInWorkspace.add(norm);
                  }
                });
              }
            }

            // Specific validation rules for Tasks
            if (col === "tasks") {
              const title = data.title || "";
              if (!title) {
                issues.push({
                  id: `task-title-${recordId}`,
                  severity: "high",
                  collection: col,
                  recordId,
                  issueType: "empty_title",
                  description: `Task is missing a title.`,
                  suggestedFix: `Assign a placeholder title.`,
                  autoFixAvailable: true
                });
              }

              // Orphaned Tasks pointing to non-existent projects
              if (data.projectId && !projectIdsSet.has(data.projectId)) {
                issues.push({
                  id: `task-orphan-${recordId}`,
                  severity: "high",
                  collection: col,
                  recordId,
                  issueType: "orphaned_project_reference",
                  description: `Task points to non-existent projectId "${data.projectId}".`,
                  suggestedFix: `Remove project reference or move to an active project.`,
                  autoFixAvailable: true
                });
              }

              // Cross-workspace mismatch
              if (data.projectId && projectIdsSet.has(data.projectId)) {
                const pWs = projectWorkspaceMap.get(data.projectId);
                if (pWs && data.workspaceId && pWs !== data.workspaceId) {
                  criticalCount++;
                  issues.push({
                    id: `task-ws-mismatch-${recordId}`,
                    severity: "critical",
                    collection: col,
                    recordId,
                    issueType: "workspace_isolation_breach",
                    description: `Task workspaceId ("${data.workspaceId}") does not match its parent project workspaceId ("${pWs}").`,
                    suggestedFix: `Update task workspaceId to align with parent project.`,
                    autoFixAvailable: true
                  });
                }
              }

              // Check priority: "P4" or 4 fallback checks
              if (data.priority === 4 || data.priority === "P4") {
                issues.push({
                  id: `task-priority-fallback-${recordId}`,
                  severity: "medium",
                  collection: col,
                  recordId,
                  issueType: "priority_fallback_p4",
                  description: `Task has priority P4. Priority null should represent Unprioritized. P4 is reserved for intentional distraction level only.`,
                  suggestedFix: `Convert priority value to null (Unprioritized).`,
                  autoFixAvailable: true
                });
              }

              if (title && !data.normalizedTitle) {
                issues.push({
                  id: `task-norm-${recordId}`,
                  severity: "low",
                  collection: col,
                  recordId,
                  issueType: "missing_normalization",
                  description: `Task is missing its search-optimized normalizedTitle.`,
                  suggestedFix: `Generate normalizedTitle from "${title}"`,
                  autoFixAvailable: true
                });
              }
            }

            // Specific validation rules for Milestones
            if (col === "milestones") {
              if (data.projectId && !projectIdsSet.has(data.projectId)) {
                issues.push({
                  id: `milestone-orphan-${recordId}`,
                  severity: "high",
                  collection: col,
                  recordId,
                  issueType: "orphaned_project_reference",
                  description: `Milestone points to non-existent projectId "${data.projectId}".`,
                  suggestedFix: `Clean up milestone reference.`,
                  autoFixAvailable: true
                });
              }
            }

            // Generic search normalization checks
            const name = data.name || "";
            if (name && !data.normalizedName && ["stakeholders", "skills"].includes(col)) {
              issues.push({
                id: `norm-name-${col}-${recordId}`,
                severity: "low",
                collection: col,
                recordId,
                issueType: "missing_normalization",
                description: `Record is missing its search-optimized normalizedName.`,
                suggestedFix: `Generate normalizedName from "${name}"`,
                autoFixAvailable: true
              });
            }
          });
        } catch (e) {
          console.error(`Error auditing collection ${col}:`, e);
        }
      }

      // Fetch latest run info
      let latestMigration: any = null;
      try {
        const migSnap = await dbAdmin.collection("migration_runs")
          .where("userId", "==", userId)
          .where("workspaceId", "==", workspaceId)
          .orderBy("completedAt", "desc")
          .limit(1)
          .get();
        if (!migSnap.empty) {
          latestMigration = migSnap.docs[0].data();
          latestMigration.id = migSnap.docs[0].id;
        }
      } catch (e) {
        console.warn("Could not read latest migration runs:", e);
      }

      let latestExport: any = null;
      try {
        const expSnap = await dbAdmin.collection("backup_runs")
          .where("userId", "==", userId)
          .where("workspaceId", "==", workspaceId)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();
        if (!expSnap.empty) {
          latestExport = expSnap.docs[0].data();
          latestExport.id = expSnap.docs[0].id;
        }
      } catch (e) {
        console.warn("Could not read latest export runs:", e);
      }

      res.json({
        workspaceId,
        checkedAt: new Date().toISOString(),
        totalCount,
        criticalCount,
        stats,
        issues,
        latestMigration,
        latestExport
      });

    } catch (e: any) {
      console.error("[Database Audit Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // 2. Dry Run & Apply Database Migrations
  app.post("/api/data-management/migrate", async (req, res) => {
    try {
      const { userId, workspaceId, mode } = req.body; // mode is "dry" or "apply"
      if (!userId || !workspaceId || !mode) {
        return res.status(400).json({ error: "userId, workspaceId, and mode are required in body." });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const isDry = mode === "dry";
      const logs: string[] = [];
      let recordsScanned = 0;
      let recordsChanged = 0;
      const errors: string[] = [];

      // Pre-fetch projects for validation mapping
      const projectIdsSet = new Set<string>();
      const projectWorkspaceMap = new Map<string, string>();
      try {
        const projSnap = await dbAdmin.collection("projects").where("userId", "==", userId).get();
        projSnap.forEach((doc: any) => {
          projectIdsSet.add(doc.id);
          const d = doc.data();
          if (d.workspaceId) {
            projectWorkspaceMap.set(doc.id, d.workspaceId);
          }
        });
      } catch (e) {
        console.error("Failed to pre-fetch projects:", e);
      }

      // Loop through and perform migration
      for (const col of DATA_MANAGEMENT_COLLECTIONS) {
        try {
          const snapshot = await dbAdmin.collection(col).where("userId", "==", userId).get();
          logs.push(`Scanning collection "${col}"... Found ${snapshot.size} records.`);

          for (const doc of snapshot.docs) {
            recordsScanned++;
            const data = doc.data();
            let changed = false;
            const updateData: any = {};

            // 1. Missing workspaceId
            if (!data.workspaceId) {
              updateData.workspaceId = workspaceId;
              changed = true;
              logs.push(`[${col}:${doc.id}] Adding missing workspaceId: ${workspaceId}`);
            }

            // 2. Missing timestamps
            if (!data.createdAt) {
              updateData.createdAt = FieldValue.serverTimestamp();
              changed = true;
              logs.push(`[${col}:${doc.id}] Set missing createdAt to serverTimestamp`);
            }
            if (!data.updatedAt) {
              updateData.updatedAt = FieldValue.serverTimestamp();
              changed = true;
              logs.push(`[${col}:${doc.id}] Set missing updatedAt to serverTimestamp`);
            }

            // 3. Normalized Title / Name
            if (col === "projects" || col === "tasks") {
              const title = data.title || "";
              if (title && !data.normalizedTitle) {
                updateData.normalizedTitle = normalizeString(title);
                changed = true;
                logs.push(`[${col}:${doc.id}] Setting normalizedTitle: "${updateData.normalizedTitle}"`);
              }
            }
            if (["stakeholders", "skills"].includes(col)) {
              const name = data.name || "";
              if (name && !data.normalizedName) {
                updateData.normalizedName = normalizeString(name);
                changed = true;
                logs.push(`[${col}:${doc.id}] Setting normalizedName: "${updateData.normalizedName}"`);
              }
            }

            // 4. Task specific priority conversions (P4/4 fallback to null)
            if (col === "tasks") {
              if (data.priority === 4 || data.priority === "P4") {
                updateData.priority = null;
                changed = true;
                logs.push(`[tasks:${doc.id}] Resetting default priority P4 to null (Unprioritized)`);
              }

              // Align task workspaceId with its parent project
              if (data.projectId && projectIdsSet.has(data.projectId)) {
                const parentWs = projectWorkspaceMap.get(data.projectId);
                const currentWs = data.workspaceId || updateData.workspaceId || workspaceId;
                if (parentWs && parentWs !== currentWs) {
                  updateData.workspaceId = parentWs;
                  changed = true;
                  logs.push(`[tasks:${doc.id}] Correcting workspaceId mismatch to match parent project: ${parentWs}`);
                }
              }
            }

            // Write back if we are applying and have changes
            if (changed) {
              recordsChanged++;
              if (!isDry) {
                try {
                  await doc.ref.update({
                    ...updateData,
                    updatedAt: FieldValue.serverTimestamp()
                  });
                } catch (writeErr: any) {
                  errors.push(`Error writing doc ${col}:${doc.id}: ${writeErr.message}`);
                }
              }
            }
          }
        } catch (colErr: any) {
          errors.push(`Error processing collection ${col}: ${colErr.message}`);
        }
      }

      // Record run in database
      const runPayload = {
        userId,
        workspaceId,
        migrationName: "Gazelle Database Hardening Migration v1",
        status: isDry ? "dry_run" : (errors.length > 0 ? "completed_with_errors" : "completed"),
        recordsScanned,
        recordsChanged,
        errors,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      if (!isDry) {
        await dbAdmin.collection("migration_runs").add(runPayload);
        await dbAdmin.collection("schema_migrations").doc("gazelle_hardening_v1").set({
          name: "Gazelle Database Hardening",
          version: 1,
          appliedAt: new Date().toISOString(),
          appliedBy: userId,
          status: "success"
        });
      }

      res.json({
        status: "success",
        mode,
        recordsScanned,
        recordsChanged,
        errors,
        logs
      });

    } catch (e: any) {
      console.error("[Database Migration Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // 3. Export Workspace Data (Excluding Sensitive Credentials)
  app.post("/api/data-management/export", async (req, res) => {
    try {
      const { userId, workspaceId } = req.body;
      if (!userId || !workspaceId) {
        return res.status(400).json({ error: "userId and workspaceId are required." });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const backupData: any = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        userId,
        workspaceId,
        collections: {}
      };

      let totalRecords = 0;

      for (const col of DATA_MANAGEMENT_COLLECTIONS) {
        try {
          const snapshot = await dbAdmin.collection(col)
            .where("userId", "==", userId)
            .where("workspaceId", "==", workspaceId)
            .get();

          const records: any[] = [];
          snapshot.forEach((doc: any) => {
            const rawData = doc.data();
            const cleanData: any = {};

            // Security: Exclude credentials, keys, passwords, and tokens
            Object.keys(rawData).forEach((key) => {
              const lowerKey = key.toLowerCase();
              const isSensitive = lowerKey.includes("secret") || 
                                  lowerKey.includes("key") || 
                                  lowerKey.includes("token") || 
                                  lowerKey.includes("password") ||
                                  lowerKey.includes("auth") ||
                                  lowerKey.includes("credential");
              if (!isSensitive) {
                cleanData[key] = rawData[key];
              }
            });

            records.push({
              id: doc.id,
              ...cleanData
            });
          });

          backupData.collections[col] = records;
          totalRecords += records.length;
        } catch (e) {
          console.warn(`Skipped exporting collection ${col}:`, e);
        }
      }

      // Log export activity
      await dbAdmin.collection("backup_runs").add({
        userId,
        workspaceId,
        type: "api_export",
        format: "json",
        status: "success",
        recordCount: totalRecords,
        createdAt: FieldValue.serverTimestamp()
      });

      res.json(backupData);

    } catch (e: any) {
      console.error("[Workspace Export Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // 4. Get Audit Logs
  app.get("/api/data-management/audit-logs", async (req, res) => {
    try {
      const { workspaceId, limit = "50" } = req.query;
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId is required as a query parameter." });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const snapshot = await dbAdmin.collection("audit_logs")
        .where("workspaceId", "==", workspaceId)
        .orderBy("createdAt", "desc")
        .limit(parseInt(limit as string, 10))
        .get();

      const logs: any[] = [];
      snapshot.forEach((doc: any) => {
        const d = doc.data();
        logs.push({
          id: doc.id,
          ...d,
          createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt) : null
        });
      });

      res.json(logs);
    } catch (e: any) {
      console.error("[Get Audit Logs Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // 5. Create Audit Log (Server-side helper endpoint)
  app.post("/api/data-management/log-audit", async (req, res) => {
    try {
      const { workspaceId, actorId, actorType, action, entityType, entityId, before, after, metadata } = req.body;
      if (!workspaceId || !actorId || !action) {
        return res.status(400).json({ error: "workspaceId, actorId, and action are required." });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const logDoc = {
        workspaceId,
        actorId,
        actorType: actorType || "user",
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        before: before || null,
        after: after || null,
        metadata: metadata || null,
        createdAt: FieldValue.serverTimestamp()
      };

      const docRef = await dbAdmin.collection("audit_logs").add(logDoc);
      res.json({ id: docRef.id, status: "logged" });
    } catch (e: any) {
      console.error("[Log Audit Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // 6. Create Platform Event (Server-side helper endpoint)
  app.post("/api/data-management/log-event", async (req, res) => {
    try {
      const { workspaceId, actorId, eventType, entityType, entityId, payload } = req.body;
      if (!workspaceId || !eventType) {
        return res.status(400).json({ error: "workspaceId and eventType are required." });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      const eventDoc = {
        workspaceId,
        actorId: actorId || "system",
        eventType,
        entityType: entityType || null,
        entityId: entityId || null,
        payload: payload || null,
        createdAt: FieldValue.serverTimestamp()
      };

      const docRef = await dbAdmin.collection("platform_events").add(eventDoc);
      res.json({ id: docRef.id, status: "logged" });
    } catch (e: any) {
      console.error("[Log Event Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  // Seed Agent Workspace Endpoint
  app.post("/api/workspaces/:workspaceId/seed-agent-workspace", async (req, res) => {
    try {
      const { workspaceId } = req.params;
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId is required." });
      }

      if (!dbAdmin) {
        return res.status(503).json({ error: "Firebase Admin is not configured." });
      }

      // Check if workspace exists
      const wsDoc = await dbAdmin.collection("workspaces").doc(workspaceId).get();
      if (!wsDoc.exists) {
        return res.status(404).json({ error: "Workspace not found." });
      }

      // Check if already seeded
      const settingsRef = dbAdmin.collection("workspace_settings").doc(workspaceId);
      const settingsSnap = await settingsRef.get();
      if (settingsSnap.exists && settingsSnap.data()?.agentWorkspaceSeededAt) {
        return res.json({ seeded: true, message: "Workspace already seeded." });
      }

      const batch = dbAdmin.batch();

      // Seed Boldi Agents (8 agents)
      const agents = [
        {
          slug: "orchestrator",
          name: "Orchestrator",
          description: "SOP-driven meta-orchestrator coordinating expert roles.",
          avatarEmoji: "🤖",
          systemPrompt: "You are the master conductor and SOP-driven agent.",
          agentType: "general"
        },
        {
          slug: "ava_pm",
          name: "Ava (Project Manager)",
          description: "GTD-aligned timeline, milestone, and priority planner.",
          avatarEmoji: "📅",
          systemPrompt: "You are Ava, the GTD-aligned Project Manager.",
          agentType: "project_manager"
        },
        {
          slug: "leo_engineer",
          name: "Leo (Technical Architect)",
          description: "Detailed systems designer and software engineer.",
          avatarEmoji: "💻",
          systemPrompt: "You are Leo, the Technical Architect and software expert.",
          agentType: "engineer"
        },
        {
          slug: "maya_designer",
          name: "Maya (UX Specialist)",
          description: "User experience designer and brand guardian.",
          avatarEmoji: "🎨",
          systemPrompt: "You are Maya, the expert UX/UI designer.",
          agentType: "designer"
        },
        {
          slug: "deep_research",
          name: "Deep Research (Analyst)",
          description: "Information discovery and competitive analyst.",
          avatarEmoji: "🔍",
          systemPrompt: "You are Deep Research, the critical intelligence analyst.",
          agentType: "researcher"
        },
        {
          slug: "reviewer",
          name: "Reviewer (Quality Assurance)",
          description: "Critical evaluator, risk detector, and code auditor.",
          avatarEmoji: "🕵️",
          systemPrompt: "You are the Reviewer, responsible for quality control.",
          agentType: "reviewer"
        },
        {
          slug: "project_manager",
          name: "Project Manager",
          description: "Strategic timeline supervisor.",
          avatarEmoji: "💼",
          systemPrompt: "You are the PM, organizing milestones and critical paths.",
          agentType: "project_manager"
        },
        {
          slug: "data_analyst",
          name: "Data Analyst",
          description: "Quantitative trend analyzer.",
          avatarEmoji: "📊",
          systemPrompt: "You are the Data Analyst, extracting metrics and trends.",
          agentType: "data_analyst"
        }
      ];

      for (const ag of agents) {
        const docId = `${ag.slug}_${workspaceId}`;
        const ref = dbAdmin.collection("boldi_agents").doc(docId);
        batch.set(ref, {
          id: docId,
          workspaceId,
          slug: ag.slug,
          name: ag.name,
          description: ag.description,
          avatarEmoji: ag.avatarEmoji,
          systemPrompt: ag.systemPrompt,
          agentType: ag.agentType,
          modelProvider: "google",
          modelName: "gemini-2.5-flash",
          toolsAllowed: ["search_tasks", "prioritize", "schedule_block"],
          permissionsProfile: "read_write",
          memoryPolicy: "persistent",
          status: "active",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      // Seed Agent Resources (2 resources)
      const resources = [
        {
          slug: "manifesto",
          title: "Gazelle & Boldi Productivity Manifesto",
          resourceType: "doc",
          markdownContent: "# Gazelle & Boldi Productivity Manifesto\n\nWelcome to your agent-integrated high-performance workspace. This manifesto outlines how humans and AI agents work together to execute strategy with clinical precision using the Carl Pullein-inspired systems...\n\n## 1. COD: Collect, Organize, Do\nEvery input must be collected immediately. No item stays in memory.\n\n## 2. Time-Based Action\nTasks are grouped by Time Sectors, not by bloated project backlogs.\n\n## 3. The 2+8 Rule\nEvery day starts with up to 2 Must Dos and up to 8 Should Dos. Nothing more.",
          tags: ["strategy", "manifesto", "onboarding"]
        },
        {
          slug: "launch_canvas",
          title: "Launch Strategy Canvas",
          resourceType: "canvas",
          jsonCanvas: { nodes: [{ id: "1", type: "text", text: "Launch Goals" }, { id: "2", type: "text", text: "Target Audience" }] },
          tags: ["canvas", "planning", "launch"]
        }
      ];

      for (const resItem of resources) {
        const docId = `${resItem.slug}_${workspaceId}`;
        const ref = dbAdmin.collection("agent_resources").doc(docId);
        batch.set(ref, {
          id: docId,
          workspaceId,
          title: resItem.title,
          resourceType: resItem.resourceType,
          markdownContent: (resItem as any).markdownContent || null,
          jsonCanvas: (resItem as any).jsonCanvas || null,
          tags: resItem.tags,
          contentAvailable: true,
          extractedTextAvailable: true,
          createdBy: "system",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      // Seed Contacts (David Miller)
      const contactId = `david_miller_${workspaceId}`;
      batch.set(dbAdmin.collection("contacts").doc(contactId), {
        id: contactId,
        workspaceId,
        displayName: "David Miller (Ops Lead)",
        email: "david.miller@operations.org",
        contactType: "human",
        status: "active",
        createdBy: "system",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      // Seed Contact Requests (Sarah Chen, Marcus Aurelius)
      const requests = [
        {
          slug: "sarah_chen",
          displayName: "Sarah Chen (FinTech Lead)",
          toEmail: "sarah.chen@fintech.io",
          contactType: "human",
          status: "pending",
          message: "Hey, would love to join your agent workspace to sync on the Q3 financial roadmap.",
          createdBy: "external"
        },
        {
          slug: "marcus_aurelius",
          displayName: "Marcus Aurelius (Stoic Coach)",
          toEmail: "marcus.stoic@gazelle.ai",
          contactType: "agent_reference",
          status: "pending",
          message: "Greetings. I can assist you as a Stoic philosophy advisor to align your quarterly work with inner life principles.",
          createdBy: "external"
        }
      ];

      for (const reqItem of requests) {
        const docId = `${reqItem.slug}_${workspaceId}`;
        batch.set(dbAdmin.collection("contact_requests").doc(docId), {
          id: docId,
          workspaceId,
          displayName: reqItem.displayName,
          toEmail: reqItem.toEmail,
          contactType: reqItem.contactType,
          status: reqItem.status,
          message: reqItem.message,
          createdBy: reqItem.createdBy,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      // Seed Agent Groups (Executive Strategy Squad)
      const groupId = `executive_strategy_${workspaceId}`;
      batch.set(dbAdmin.collection("agent_groups").doc(groupId), {
        id: groupId,
        workspaceId,
        name: "Executive Strategy Squad",
        description: "A pre-configured board to coordinate high-level corporate roadmap decisions and feasibility reviews.",
        groupType: "workspace",
        visibility: "workspace",
        status: "active",
        createdBy: "system",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      // Seed Agent Moments (Q2 Strategy Pitch Alignment Session)
      const momentId = `strategy_pitch_${workspaceId}`;
      batch.set(dbAdmin.collection("agent_moments").doc(momentId), {
        id: momentId,
        workspaceId,
        title: "Q2 Strategy Pitch Alignment Session",
        description: "Saved transcript showing Boldi Orchestrator and David Miller aligning on operations budget approval.",
        createdBy: "system",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      // Save seeded state in workspace_settings
      batch.set(settingsRef, {
        workspaceId,
        agentWorkspaceSeededAt: FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();

      res.json({ seeded: true, message: "Workspace successfully seeded" });
    } catch (e: any) {
      console.error("[Seed Agent Workspace Error]", e);
      sendPublicError(req, res, 500, "internal_error", "Internal server error", e);
    }
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(errorHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const origin = `${req.protocol}://${req.get("host")}`;
      const indexHtml = fs
        .readFileSync(path.join(distPath, "index.html"), "utf8")
        .replaceAll("__GAZELLE_ORIGIN__", origin);
      res.type("html").send(indexHtml);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
