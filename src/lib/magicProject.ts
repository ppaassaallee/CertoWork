import { parseBulkPasteItems, type BulkPasteNode } from "./bulkPasteItems";
import { splitProjectWizardLines, type ProjectMethodology } from "./delivereeSkills";

export type MagicProjectItem = {
  title: string;
  kind: "epic" | "feature" | "pbi" | "subtask" | "task";
  dueDate?: string;
  children?: MagicProjectItem[];
};

export type MagicProjectMeeting = {
  title: string;
  date?: string;
  time?: string;
  durationMinutes?: number;
  description?: string;
};

export type MagicProjectBlueprint = {
  title: string;
  outcome: string;
  why: string;
  methodology: ProjectMethodology;
  owner: string;
  targetDate: string;
  noTargetDate: boolean;
  successCriteria: string[];
  definitionOfDone: string;
  phases: Array<{ title: string; description?: string; targetDate?: string }>;
  milestones: Array<{ title: string; targetDate?: string }>;
  items: MagicProjectItem[];
  meetings: MagicProjectMeeting[];
  kickoff: { title: string; date?: string; description?: string };
  noteTitle: string;
  noteContent: string;
  sourceText: string;
};

const EMPTY: MagicProjectBlueprint = {
  title: "",
  outcome: "",
  why: "",
  methodology: "Hybrid",
  owner: "",
  targetDate: "",
  noTargetDate: true,
  successCriteria: [],
  definitionOfDone: "",
  phases: [],
  milestones: [],
  items: [],
  meetings: [],
  kickoff: { title: "Project kickoff" },
  noteTitle: "Project definition",
  noteContent: "",
  sourceText: "",
};

const SECTION_NAMES = [
  "outcome",
  "objective",
  "goal",
  "what success looks like",
  "why",
  "why it matters",
  "purpose",
  "rationale",
  "success criteria",
  "success",
  "acceptance criteria",
  "definition of done",
  "done when",
  "dod",
  "backlog",
  "items",
  "pbis",
  "work items",
  "tasks",
  "scope",
  "epics",
  "milestones",
  "phases",
  "meetings",
  "workshops",
  "ceremonies",
  "kickoff",
];

function section(text: string, names: string[]) {
  const terminator = SECTION_NAMES.filter((name) => !names.includes(name)).join("|");
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:#{1,3}\\s*)?(?:${names.join("|")})\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:#{1,3}\\s*)?(?:${terminator})\\s*:?\\s*\\n|$)`,
    "i",
  );
  return text.match(pattern)?.[1]?.trim() || "";
}

function firstLineValue(text: string, names: string[]) {
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:${names.join("|")})\\s*[:：-]\\s*(.+)`, "i");
  return text.match(pattern)?.[1]?.trim() || "";
}

function isoDate(value: string) {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function methodologyFrom(text: string): ProjectMethodology {
  const lower = text.toLowerCase();
  if (/\bscrum|agile\b/.test(lower)) return "Scrum";
  if (/\bpmi|waterfall\b/.test(lower)) return "PMI";
  return "Hybrid";
}

function nodesToItems(nodes: BulkPasteNode[], kind: MagicProjectItem["kind"] = "pbi"): MagicProjectItem[] {
  return nodes.map((node) => ({
    title: node.title,
    kind: node.depth > 0 ? "subtask" : kind,
    children: nodesToItems(node.children, "subtask"),
  }));
}

export function fallbackMagicProject(text: string): MagicProjectBlueprint {
  const source = String(text || "").trim();
  const heading = source.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title =
    heading ||
    firstLineValue(source, ["project", "project name", "name", "title"]) ||
    source.split(/\n/).map((line) => line.trim()).find(Boolean) ||
    "Untitled project";
  const outcome =
    section(source, ["outcome", "objective", "goal", "what success looks like"]) ||
    firstLineValue(source, ["outcome", "objective", "goal"]);
  const why =
    section(source, ["why", "why it matters", "purpose", "rationale"]) ||
    firstLineValue(source, ["why", "purpose"]);
  const criteriaText = section(source, ["success criteria", "success", "acceptance criteria"]);
  const dod =
    section(source, ["definition of done", "done when", "dod"]) ||
    firstLineValue(source, ["definition of done"]);
  const owner = firstLineValue(source, ["owner", "accountable", "project manager", "pm"]);
  const targetDate = isoDate(source);
  const itemSection =
    section(source, ["backlog", "items", "pbis", "work items", "tasks", "scope"]) || "";
  const epicSection = section(source, ["epics"]);
  const milestoneSection = section(source, ["milestones"]);
  const phaseSection = section(source, ["phases"]);
  const meetingSection = section(source, ["meetings", "workshops", "ceremonies"]);
  const parsedItems = parseBulkPasteItems(itemSection || source);
  const items = itemSection ? nodesToItems(parsedItems) : nodesToItems(parsedItems).slice(0, 40);
  const milestones = parseBulkPasteItems(milestoneSection).map((node) => ({ title: node.title }));
  const phases = parseBulkPasteItems(phaseSection).map((node) => ({
    title: node.title,
    description: node.children.map((child) => child.title).join("\n"),
  }));
  const meetings = parseBulkPasteItems(meetingSection).map((node) => ({
    title: node.title,
    date: isoDate(node.title),
  }));
  const kickoffDate = isoDate(firstLineValue(source, ["kickoff", "kick-off", "kick off"])) || targetDate;
  return {
    ...EMPTY,
    title: title.slice(0, 160),
    outcome: outcome || `Deliver ${title}`,
    why: why || `This project exists to make ${title} real and usable.`,
    methodology: methodologyFrom(source),
    owner,
    targetDate,
    noTargetDate: !targetDate,
    successCriteria: splitProjectWizardLines(criteriaText),
    definitionOfDone: dod || `The team can operate ${title} without a working session.`,
    phases,
    milestones,
    items: epicSection
      ? [
          ...nodesToItems(parseBulkPasteItems(epicSection), "epic"),
          ...items,
        ]
      : items,
    meetings,
    kickoff: {
      title: `Kickoff ${title}`,
      date: kickoffDate,
      description: "Align on outcome, method, owners, and the first next actions.",
    },
    noteTitle: `${title} definition`,
    noteContent: source,
    sourceText: source,
  };
}

export function normalizeMagicProject(raw: any, sourceText: string): MagicProjectBlueprint {
  const fallback = fallbackMagicProject(sourceText);
  const title = String(raw?.title || fallback.title).trim() || fallback.title;
  const successCriteria = Array.isArray(raw?.successCriteria)
    ? raw.successCriteria.map((item: unknown) => String(item || "").trim()).filter(Boolean)
    : fallback.successCriteria;
  const items = Array.isArray(raw?.items) && raw.items.length
    ? raw.items.map(normalizeItem)
    : fallback.items;
  return {
    title: title.slice(0, 160),
    outcome: String(raw?.outcome || fallback.outcome).trim() || fallback.outcome,
    why: String(raw?.why || fallback.why).trim() || fallback.why,
    methodology: /scrum/i.test(String(raw?.methodology || ""))
      ? "Scrum"
      : /pmi|waterfall/i.test(String(raw?.methodology || ""))
        ? "PMI"
        : fallback.methodology,
    owner: String(raw?.owner || fallback.owner).trim(),
    targetDate: isoDate(String(raw?.targetDate || fallback.targetDate)),
    noTargetDate: !isoDate(String(raw?.targetDate || fallback.targetDate)),
    successCriteria,
    definitionOfDone: String(raw?.definitionOfDone || fallback.definitionOfDone).trim(),
    phases: Array.isArray(raw?.phases)
      ? raw.phases.map((phase: any) => ({
          title: String(phase?.title || "").trim(),
          description: String(phase?.description || "").trim(),
          targetDate: isoDate(String(phase?.targetDate || "")),
        })).filter((phase: { title: string }) => phase.title)
      : fallback.phases,
    milestones: Array.isArray(raw?.milestones)
      ? raw.milestones.map((item: any) => ({
          title: String(item?.title || "").trim(),
          targetDate: isoDate(String(item?.targetDate || "")),
        })).filter((item: { title: string }) => item.title)
      : fallback.milestones,
    items,
    meetings: Array.isArray(raw?.meetings)
      ? raw.meetings.map((item: any) => ({
          title: String(item?.title || "").trim(),
          date: isoDate(String(item?.date || "")),
          time: String(item?.time || "").trim(),
          durationMinutes: Number(item?.durationMinutes || 60) || 60,
          description: String(item?.description || "").trim(),
        })).filter((item: { title: string }) => item.title)
      : fallback.meetings,
    kickoff: {
      title: String(raw?.kickoff?.title || fallback.kickoff.title).trim() || `Kickoff ${title}`,
      date: isoDate(String(raw?.kickoff?.date || fallback.kickoff.date || "")),
      description: String(raw?.kickoff?.description || fallback.kickoff.description || "").trim(),
    },
    noteTitle: String(raw?.noteTitle || fallback.noteTitle).trim() || `${title} definition`,
    noteContent: String(raw?.noteContent || sourceText).trim() || sourceText,
    sourceText,
  };
}

function normalizeItem(raw: any): MagicProjectItem {
  const kindRaw = String(raw?.kind || raw?.type || "pbi").toLowerCase();
  const kind: MagicProjectItem["kind"] =
    kindRaw === "epic" || kindRaw === "feature" || kindRaw === "subtask" || kindRaw === "task"
      ? kindRaw
      : "pbi";
  return {
    title: String(raw?.title || "").trim().slice(0, 500),
    kind,
    dueDate: isoDate(String(raw?.dueDate || "")),
    children: Array.isArray(raw?.children) ? raw.children.map(normalizeItem) : [],
  };
}

export async function extractMagicProject(input: {
  text: string;
  token: string;
  userId: string;
  workspaceId: string;
}): Promise<{ blueprint: MagicProjectBlueprint; usedAi: boolean }> {
  const source = String(input.text || "").trim();
  const fallback = fallbackMagicProject(source);
  if (!source) return { blueprint: fallback, usedAi: false };
  try {
    const response = await fetch("/api/certo/magic-project", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: input.userId,
        workspaceId: input.workspaceId,
        text: source,
      }),
    });
    const result = await response.json();
    if (!response.ok) return { blueprint: fallback, usedAi: false };
    return {
      blueprint: normalizeMagicProject(result?.blueprint || result, source),
      usedAi: true,
    };
  } catch {
    return { blueprint: fallback, usedAi: false };
  }
}
