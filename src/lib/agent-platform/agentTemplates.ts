/**
 * System AgentTemplate seeds for Track B.
 */
import type { AgentTemplate } from "./types";
import { persistTemplateRemote, seedTemplate } from "./agentStore";

export const SYSTEM_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "tmpl-standup",
    name: "Standup Agent",
    description: "Weekday standup summary posted to each project room.",
    owns: "Daily standup narrative",
    outcome: "Every project has a crisp morning update",
    worksOn: ["Projects", "Rooms"],
    skillNames: ["Progress tracking", "Team summarization"],
    system: true,
    versionSeed: {
      instructions:
        "Each weekday morning, summarize progress, blockers, and next steps per project. Post to the project room. Ask before tagging people.",
      icon: { emoji: "☀️", color: "#2547C4" },
      model: { provider: "certo", name: "odysseus", tier: "fast" },
    },
    triggerSeeds: [
      {
        type: "schedule",
        enabled: true,
        schedule: "45 8 * * 1-5",
        timezone: "America/Tegucigalpa",
      },
    ],
  },
  {
    id: "tmpl-delivery-risk",
    name: "Delivery Risk Agent",
    description: "Flags stalls, slipped dates, and blocked dependencies.",
    owns: "Delivery risk on active work",
    outcome: "No slipped date goes unnoticed",
    worksOn: ["Work items", "Signals"],
    skillNames: ["Risk detection", "Progress tracking"],
    system: true,
    versionSeed: {
      instructions:
        "Watch state changes and due dates. Flag stalls and propose reassignments. Raise Signals for slipped dates.",
      icon: { emoji: "⚠️", color: "#F2620F" },
      model: { provider: "certo", name: "odysseus", tier: "balanced" },
    },
    triggerSeeds: [
      {
        type: "domain_event",
        enabled: true,
        events: ["updated", "state_changed"],
      },
      {
        type: "schedule",
        enabled: true,
        schedule: "0 9 * * *",
        timezone: "America/Tegucigalpa",
      },
    ],
  },
  {
    id: "tmpl-spec",
    name: "Spec Agent",
    description: "Turns a rough item into structured requirements.",
    owns: "Requirements quality",
    outcome: "Every assigned item has clear acceptance criteria",
    worksOn: ["Work items"],
    skillNames: ["Requirements structuring"],
    system: true,
    versionSeed: {
      instructions:
        "When assigned or mentioned, structure the item into problem, goals, requirements, gaps, and open questions. Ask in the thread.",
      icon: { emoji: "📋", color: "#8B5CF6" },
      model: { provider: "certo", name: "odysseus", tier: "deep" },
    },
    triggerSeeds: [
      { type: "manual", enabled: true, events: ["assigned_to_agent"] },
      { type: "domain_event", enabled: true, events: ["mentioned"] },
    ],
  },
  {
    id: "tmpl-request-triage",
    name: "Request Triage Agent",
    description: "Routes Intake/Collab requests to the right team.",
    owns: "Incoming request triage",
    outcome: "Requests land with context and a home",
    worksOn: ["Intake", "Collab"],
    skillNames: ["Duplicate detection", "Team summarization"],
    system: true,
    versionSeed: {
      instructions:
        "On create in Intake/Collab, check duplicates, gather context, and route to team/project. Ask before creating items.",
      icon: { emoji: "📥", color: "#0EA5A5" },
      model: { provider: "certo", name: "odysseus", tier: "balanced" },
    },
    triggerSeeds: [
      {
        type: "domain_event",
        enabled: true,
        events: ["created"],
        filters: { types: ["request", "intake"] },
      },
    ],
  },
  {
    id: "tmpl-customer-feedback",
    name: "Customer Feedback Agent",
    description: "Clusters feedback themes and links them to work items.",
    owns: "Feedback themes",
    outcome: "Feedback becomes actionable themes",
    worksOn: ["Collab", "Feedback"],
    skillNames: ["Team summarization"],
    system: true,
    versionSeed: {
      instructions:
        "When Collab conversations are labelled feedback, cluster themes and link to related items.",
      icon: { emoji: "💬", color: "#EC4899" },
      model: { provider: "certo", name: "odysseus", tier: "balanced" },
    },
    triggerSeeds: [
      {
        type: "domain_event",
        enabled: true,
        events: ["created", "updated"],
        filters: { labels: ["feedback"] },
      },
    ],
  },
  {
    id: "tmpl-weekly-portfolio",
    name: "Weekly portfolio report",
    description: "Executive portfolio summary every week.",
    owns: "Portfolio narrative",
    outcome: "Leaders get a weekly portfolio brief",
    worksOn: ["Portfolio"],
    skillNames: ["Portfolio reporting", "Team summarization"],
    system: true,
    versionSeed: {
      instructions: "Compile health, risks, and wins across the portfolio. Draft only — ask before sending.",
      icon: { emoji: "📊", color: "#2547C4" },
      model: { provider: "certo", name: "odysseus", tier: "deep" },
    },
    triggerSeeds: [
      {
        type: "schedule",
        enabled: true,
        schedule: "0 17 * * 5",
        timezone: "America/Tegucigalpa",
      },
    ],
  },
  {
    id: "tmpl-collections",
    name: "Collections follow-up",
    description: "Drafts reminders for overdue Billing invoices.",
    owns: "Collections reminders",
    outcome: "Overdue invoices get a drafted follow-up",
    worksOn: ["Billing"],
    skillNames: ["Collections follow-up"],
    system: true,
    versionSeed: {
      instructions: "When Billing marks overdue, draft a reminder. Never send without approval.",
      icon: { emoji: "💵", color: "#E8B23A" },
      model: { provider: "certo", name: "odysseus", tier: "fast" },
    },
    triggerSeeds: [
      {
        type: "domain_event",
        enabled: true,
        events: ["updated"],
        filters: { labels: ["overdue"] },
      },
    ],
  },
  {
    id: "tmpl-duplicate-finder",
    name: "Duplicate finder",
    description: "Surfaces likely duplicate work items.",
    owns: "Duplicate hygiene",
    outcome: "Fewer duplicate items stay open",
    worksOn: ["Work items"],
    skillNames: ["Duplicate detection"],
    system: true,
    versionSeed: {
      instructions: "On create/update, scan for near-duplicates and propose a link or merge ask.",
      icon: { emoji: "🔎", color: "#6B7280" },
      model: { provider: "certo", name: "odysseus", tier: "fast" },
    },
    triggerSeeds: [
      { type: "domain_event", enabled: true, events: ["created", "updated"] },
    ],
  },
  {
    id: "tmpl-checkpoint-chaser",
    name: "Checkpoint chaser",
    description: "Nudges owners when checkpoints slip.",
    owns: "Checkpoint follow-through",
    outcome: "Missed checkpoints get a chase",
    worksOn: ["Work items", "Projects"],
    skillNames: ["Progress tracking", "Risk detection"],
    system: true,
    versionSeed: {
      instructions: "Find missed checkpoints and draft a chase note to the owner. Ask before posting.",
      icon: { emoji: "🏁", color: "#3AAE6C" },
      model: { provider: "certo", name: "odysseus", tier: "balanced" },
    },
    triggerSeeds: [
      {
        type: "schedule",
        enabled: true,
        schedule: "0 10 * * 1-5",
        timezone: "America/Tegucigalpa",
      },
    ],
  },
];

export function ensureSystemTemplatesSeeded() {
  for (const template of SYSTEM_AGENT_TEMPLATES) {
    seedTemplate(template);
  }
}

export async function seedSystemTemplatesRemote() {
  ensureSystemTemplatesSeeded();
  for (const template of SYSTEM_AGENT_TEMPLATES) {
    await persistTemplateRemote(template);
  }
}
