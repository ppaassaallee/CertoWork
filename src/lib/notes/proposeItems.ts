import { z } from "zod";

export const ProposedNoteItemSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["pbi", "subtask", "bug", "task"]).default("pbi"),
  assigneeName: z.string().optional(),
  dueText: z.string().optional(),
  sourceLine: z.string(),
  selected: z.boolean().default(true),
});

export type ProposedNoteItem = z.infer<typeof ProposedNoteItemSchema>;

const BLOCK_PRIORITY = [
  "proximos_pasos",
  "proximos-pasos",
  "decisiones",
  "acciones",
  "criterios_aceptacion",
];

/**
 * Deterministic proposal of items from note markdown (no LLM).
 * Prefers lines inside Próximos pasos / Decisiones fences; else bullets.
 */
export function proposeItemsFromNote(content: string): ProposedNoteItem[] {
  const source = String(content || "");
  const fromBlocks: string[] = [];
  const fence = /:::([a-z0-9_-]+)\s*\n([\s\S]*?)\n:::/gi;
  let match: RegExpExecArray | null;
  const blockBodies: Array<{ type: string; body: string }> = [];
  while ((match = fence.exec(source))) {
    blockBodies.push({ type: match[1].toLowerCase(), body: match[2] });
  }
  const preferred = BLOCK_PRIORITY.flatMap((id) =>
    blockBodies.filter((b) => b.type === id || b.type.includes(id.replace(/_/g, ""))).map((b) => b.body),
  );
  const bodies = preferred.length ? preferred : blockBodies.map((b) => b.body);
  for (const body of bodies) {
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.replace(/^\*\*[^*]+\*\*\s*/, "").replace(/^[-*•]\s+/, "").trim();
      if (!line || line.length < 3) continue;
      if (/^(objetivo|agenda|notas|riesgo)\b/i.test(line)) continue;
      fromBlocks.push(line);
    }
  }
  let lines = fromBlocks;
  if (!lines.length) {
    lines = source
      .split(/\r?\n/)
      .map((raw) => raw.replace(/^[-*•]\s+/, "").trim())
      .filter((line) => line.length >= 4 && !line.startsWith("#") && !line.startsWith(":::"));
  }
  const unique = [...new Set(lines)].slice(0, 12);
  return unique.map((line) =>
    ProposedNoteItemSchema.parse({
      title: line.slice(0, 160),
      type: "pbi",
      sourceLine: line,
      selected: true,
    }),
  );
}

export function upsertProximosPasosBlock(
  content: string,
  itemLines: string[],
): string {
  const blockBody = itemLines.map((line) => `- ${line}`).join("\n");
  const fence = `:::proximos_pasos\n**Próximos pasos**\n${blockBody}\n:::`;
  if (/:::proximos_pasos\s*\n[\s\S]*?\n:::/i.test(content)) {
    return content.replace(/:::proximos_pasos\s*\n[\s\S]*?\n:::/i, fence);
  }
  const trimmed = String(content || "").trim();
  return trimmed ? `${trimmed}\n\n${fence}` : fence;
}
