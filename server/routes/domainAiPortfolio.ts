import type { Express } from "express";
import { Type } from "@google/genai";
import { generateContentWithFallback } from "../lib/ai";
import { sendPublicError } from "../middleware/errors";

export function registerDomainAiPortfolioRoutes(app: Express) {
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
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
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
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
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
        model: process.env.BOLDI_GEMINI_MODEL || "gemini-2.5-flash-lite",
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
}
