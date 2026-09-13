import { z } from "zod";
import { parseBulkPasteItems, type BulkPasteNode } from "../../lib/bulkPasteItems";

export const CaptureBlockSchema = z.object({
  type: z.enum([
    "objetivo",
    "criterios_aceptacion",
    "notas_tecnicas",
    "riesgo",
    "paso",
    "notas",
  ]),
  text: z.string().min(1),
});

export const CompileItemResultSchema = z.object({
  title: z.string().min(1),
  blocks: z.array(CaptureBlockSchema).default([]),
  description: z.string().default(""),
});

export type CaptureBlock = z.infer<typeof CaptureBlockSchema>;
export type CompileItemResult = z.infer<typeof CompileItemResultSchema>;

const HEADING_MAP: Array<{ re: RegExp; type: CaptureBlock["type"] }> = [
  { re: /^(objetivo|goal|outcome)\s*[:\-–]\s*/i, type: "objetivo" },
  {
    re: /^(criterios?(?:\s+de)?\s+aceptaci[oó]n|acceptance\s*criteria|ac)\s*[:\-–]\s*/i,
    type: "criterios_aceptacion",
  },
  { re: /^(notas?\s+t[eé]cnicas?|tech(?:nical)?\s+notes?)\s*[:\-–]\s*/i, type: "notas_tecnicas" },
  { re: /^(riesgo|risk)\s*[:\-–]\s*/i, type: "riesgo" },
  { re: /^(paso|step)\s*[:\-–]\s*/i, type: "paso" },
];

/**
 * Deterministic item compile (routines-style). Used by ✦ Estructurar until
 * a shared worker endpoint with mode:"item" exists.
 */
export function compileItemSentence(input: {
  title: string;
  body?: string;
}): CompileItemResult {
  const title = String(input.title || "").trim() || "Untitled";
  const body = String(input.body || "").trim();
  const blocks: CaptureBlock[] = [];
  const leftovers: string[] = [];

  if (body) {
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      let matched = false;
      for (const rule of HEADING_MAP) {
        if (rule.re.test(line)) {
          const text = line.replace(rule.re, "").trim() || line;
          blocks.push({ type: rule.type, text });
          matched = true;
          break;
        }
      }
      if (!matched) leftovers.push(line.replace(/^[-*•]\s+/, ""));
    }
  }

  if (!blocks.some((block) => block.type === "objetivo") && leftovers.length) {
    blocks.unshift({ type: "objetivo", text: leftovers[0] });
    leftovers.shift();
  }
  if (leftovers.length) {
    const criteria = leftovers.filter((line) => /debe|should|must|acept/i.test(line));
    const rest = leftovers.filter((line) => !criteria.includes(line));
    if (criteria.length) {
      blocks.push({
        type: "criterios_aceptacion",
        text: criteria.join("\n"),
      });
    }
    if (rest.length) {
      blocks.push({ type: "notas", text: rest.join("\n") });
    }
  }

  const description = blocks
    .map((block) => {
      const label =
        block.type === "objetivo"
          ? "Objetivo"
          : block.type === "criterios_aceptacion"
            ? "Criterios de aceptación"
            : block.type === "notas_tecnicas"
              ? "Notas técnicas"
              : block.type === "riesgo"
                ? "Riesgo"
                : block.type === "paso"
                  ? "Paso"
                  : "Notas";
      return `:::${block.type}\n**${label}**\n${block.text}\n:::`;
    })
    .join("\n\n");

  return CompileItemResultSchema.parse({ title, blocks, description });
}

export function clipboardToCaptureDraft(text: string): {
  mode: "single" | "list";
  title: string;
  body: string;
  nodes: BulkPasteNode[];
} {
  const raw = String(text || "").trim();
  if (!raw) return { mode: "single", title: "", body: "", nodes: [] };
  const nodes = parseBulkPasteItems(raw);
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (nodes.length > 1 || (nodes.length === 1 && nodes[0].children.length > 0) || lines.length >= 3) {
    return {
      mode: "list",
      title: nodes[0]?.title || lines[0] || "",
      body: raw,
      nodes,
    };
  }
  if (lines.length === 1) {
    return { mode: "single", title: lines[0], body: "", nodes };
  }
  return {
    mode: "single",
    title: lines[0] || "",
    body: lines.slice(1).join("\n"),
    nodes,
  };
}

export function blocksToAcceptanceCriteria(blocks: CaptureBlock[]) {
  const block = blocks.find((entry) => entry.type === "criterios_aceptacion");
  return block?.text || "";
}
