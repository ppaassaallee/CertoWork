import { formatSemanticBlock, type SemanticBlockType } from "../semanticBlocks";
import type { NoteType } from "./types";

function blocks(parts: Array<{ type: SemanticBlockType; text?: string }>) {
  return parts.map((part) => formatSemanticBlock(part.type, part.text || "…")).join("\n\n");
}

export function noteTemplate(
  type: NoteType,
  ctx: { date: string; week?: string; name?: string },
): { title: string; content: string } {
  if (type === "meeting") {
    return {
      title: `Reunión · ${ctx.date}`,
      content: blocks([
        { type: "objetivo" },
        { type: "paso", text: "- …" }, // Agenda
        { type: "decision" },
        { type: "paso", text: "- …" }, // Próximos pasos
        { type: "notas" },
      ]),
    };
  }
  if (type === "idea") {
    return {
      title: "Idea",
      content: blocks([
        { type: "oportunidad" },
        { type: "solucion_nueva" },
        { type: "riesgo" },
      ]),
    };
  }
  if (type === "spec") {
    return {
      title: "Spec",
      content: blocks([
        { type: "objetivo" },
        { type: "rol" },
        { type: "dolor" },
        { type: "criterios_aceptacion" },
        { type: "notas_tecnicas" },
      ]),
    };
  }
  if (type === "journal") {
    return { title: `Día · ${ctx.date}`, content: "" };
  }
  if (type === "review") {
    return { title: `WRAP · ${ctx.week || ctx.date}`, content: "" };
  }
  if (type === "client") {
    return {
      title: `Cliente · ${ctx.name || ""}`.trim(),
      content: blocks([
        { type: "objetivo" },
        { type: "feedback_cliente" },
        { type: "decision" },
        { type: "paso", text: "- …" },
      ]),
    };
  }
  return { title: "Nota", content: "" };
}
