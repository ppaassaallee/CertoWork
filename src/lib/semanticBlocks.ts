/** Typed semantic blocks for notes & item bodies (DunTasks Prompt 3). */

export type SemanticBlockType =
  | "objetivo"
  | "criterios_aceptacion"
  | "criterio_exito"
  | "paso"
  | "notas_tecnicas"
  | "must_have"
  | "should_have"
  | "could_have"
  | "wont_have"
  | "rol"
  | "dolor"
  | "beneficio"
  | "oportunidad"
  | "feedback_cliente"
  | "solucion_existente"
  | "solucion_nueva"
  | "riesgo"
  | "decision"
  | "bloqueo"
  | "notas_odysseus"
  | "notas";

export type SemanticBlock = {
  type: SemanticBlockType;
  text: string;
};

export type SemanticBlockDef = {
  type: SemanticBlockType;
  labelEs: string;
  labelEn: string;
  hue: string;
  group: "definition" | "priority" | "discovery" | "control" | "ai";
  aiOnly?: boolean;
};

export const SEMANTIC_BLOCKS: SemanticBlockDef[] = [
  { type: "objetivo", labelEs: "Objetivo", labelEn: "Goal", hue: "blue", group: "definition" },
  {
    type: "criterios_aceptacion",
    labelEs: "Criterios de aceptación",
    labelEn: "Acceptance criteria",
    hue: "teal",
    group: "definition",
  },
  {
    type: "criterio_exito",
    labelEs: "Criterio de éxito",
    labelEn: "Success criteria",
    hue: "green",
    group: "definition",
  },
  { type: "paso", labelEs: "Paso", labelEn: "Step", hue: "indigo", group: "definition" },
  {
    type: "notas_tecnicas",
    labelEs: "Notas técnicas",
    labelEn: "Technical notes",
    hue: "gray",
    group: "definition",
  },
  { type: "must_have", labelEs: "Must have", labelEn: "Must have", hue: "red", group: "priority" },
  {
    type: "should_have",
    labelEs: "Should have",
    labelEn: "Should have",
    hue: "orange",
    group: "priority",
  },
  {
    type: "could_have",
    labelEs: "Could have",
    labelEn: "Could have",
    hue: "amber",
    group: "priority",
  },
  {
    type: "wont_have",
    labelEs: "Won't have",
    labelEn: "Won't have",
    hue: "brown",
    group: "priority",
  },
  { type: "rol", labelEs: "Rol", labelEn: "Role", hue: "purple", group: "discovery" },
  { type: "dolor", labelEs: "Dolor", labelEn: "Pain", hue: "red", group: "discovery" },
  {
    type: "beneficio",
    labelEs: "Beneficio",
    labelEn: "Benefit",
    hue: "green",
    group: "discovery",
  },
  {
    type: "oportunidad",
    labelEs: "Oportunidad",
    labelEn: "Opportunity",
    hue: "lime",
    group: "discovery",
  },
  {
    type: "feedback_cliente",
    labelEs: "Feedback del cliente",
    labelEn: "Customer feedback",
    hue: "pink",
    group: "discovery",
  },
  {
    type: "solucion_existente",
    labelEs: "Solución existente",
    labelEn: "Existing solution",
    hue: "gray",
    group: "discovery",
  },
  {
    type: "solucion_nueva",
    labelEs: "Solución nueva",
    labelEn: "New solution",
    hue: "blue",
    group: "discovery",
  },
  { type: "riesgo", labelEs: "Riesgo", labelEn: "Risk", hue: "amber", group: "control" },
  { type: "decision", labelEs: "Decisión", labelEn: "Decision", hue: "indigo", group: "control" },
  { type: "bloqueo", labelEs: "Bloqueo", labelEn: "Blocker", hue: "red", group: "control" },
  {
    type: "notas_odysseus",
    labelEs: "Notas de ✦ Odysseus",
    labelEn: "Notes from ✦ Odysseus",
    hue: "pink",
    group: "ai",
    aiOnly: true,
  },
];

const TYPE_SET = new Set(SEMANTIC_BLOCKS.map((block) => block.type));

export function blockDef(type: string) {
  return SEMANTIC_BLOCKS.find((block) => block.type === type) || null;
}

export function formatSemanticBlock(type: SemanticBlockType, text: string) {
  const def = blockDef(type);
  const label = def?.labelEs || type;
  return `:::${type}\n**${label}**\n${String(text || "").trim()}\n:::`;
}

const FENCE_RE = /:::([a-z0-9_]+)\s*\n([\s\S]*?)\n:::/g;

export function getBlocks(
  source: { description?: unknown; content?: unknown; acceptanceCriteria?: unknown } | string | null | undefined,
): SemanticBlock[] {
  const text =
    typeof source === "string"
      ? source
      : [source?.description, source?.content, source?.acceptanceCriteria]
          .map((value) => String(value || ""))
          .filter(Boolean)
          .join("\n\n");
  const blocks: SemanticBlock[] = [];
  const re = new RegExp(FENCE_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const type = match[1] as SemanticBlockType;
    if (!TYPE_SET.has(type)) continue;
    const body = match[2]
      .replace(/^\*\*[^*]+\*\*\s*/m, "")
      .trim();
    if (body) blocks.push({ type, text: body });
  }
  // Mirror legacy acceptanceCriteria field when no fence present
  if (
    typeof source === "object" &&
    source &&
    source.acceptanceCriteria &&
    !blocks.some((block) => block.type === "criterios_aceptacion")
  ) {
    const legacy = String(source.acceptanceCriteria).trim();
    if (legacy) blocks.push({ type: "criterios_aceptacion", text: legacy });
  }
  return blocks;
}

export function hasAcceptanceCriteria(source: Parameters<typeof getBlocks>[0]) {
  return getBlocks(source).some((block) => block.type === "criterios_aceptacion");
}

export function insertBlockIntoMarkdown(
  markdown: string,
  type: SemanticBlockType,
  text = "",
) {
  const fence = formatSemanticBlock(type, text || "…");
  const base = String(markdown || "").trim();
  return base ? `${base}\n\n${fence}` : fence;
}
