import type { Express } from "express";
import { Type } from "@google/genai";
import { generateContentWithFallback } from "../lib/ai";
import { parseCleanJSON } from "../lib/json";
import { sendPublicError } from "../middleware/errors";
import { registerDomainAiPortfolioRoutes } from "./domainAiPortfolio";

export function registerDomainAiRoutes(app: Express) {
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
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
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
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
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
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
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
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
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

  registerDomainAiPortfolioRoutes(app);
}
