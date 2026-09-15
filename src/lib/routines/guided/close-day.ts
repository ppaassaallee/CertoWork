import type { RecipeManifest } from "../manifest";

export const CLOSE_DAY_MANIFEST: RecipeManifest = {
  id: "close-day",
  name: "Cerrar el día",
  tagline: "Noventa segundos para cerrar bien y empezar mejor mañana.",
  domain: "personal",
  class: "guided",
  cadence: { default: "Lun–Vie 18:00", cron: "0 18 * * 1-5", humanText: "Lun–Vie 18:00" },
  estimatedMinutes: 2,
  expiresWeekday: undefined,          // expira a medianoche local (ver 8c)
  summaryStepIds: ["feel", "carry"],
  prepare: { gather: ["day_summary"] },
  steps: [
    {
      id: "feel",
      label: "Cómo se sintió",
      question: "¿Cómo se sintió el día?",
      skippable: false,
      cards: [{
        type: "Choice", id: "feel-choice",
        props: { columns: 3, options: [
          { id: "strong", title: "Fuerte", hint: "Avancé en lo que importa", tone: "success" },
          { id: "normal", title: "Normal", hint: "Algo de progreso", tone: "neutral" },
          { id: "weak", title: "Flojo", hint: "Se me fue el día", tone: "warning" },
        ] },
      }],
    },
    {
      id: "energy",
      label: "Energía",
      question: "¿Qué te dio y qué te quitó energía?",
      hint: "Tocá E o D en cada ítem. Sin pensarlo mucho.",
      skippable: true,
      skipInSummary: true,
      cards: [{ type: "EnergyTag", id: "energy-tags", props: { source: "day_summary" } }],
    },
    {
      id: "deadline",
      label: "Deadline",
      question: "Tu deadline más cercano no recibió tiempo hoy. ¿Cómo lo ves?",
      hint: "Esta pregunta solo aparece si aplica.",
      skippable: true,
      skipInSummary: true,
      cards: [{
        type: "Choice", id: "deadline-choice",
        props: { columns: 3, options: [
          { id: "on_track", title: "En fecha", tone: "success" },
          { id: "worried", title: "Me preocupa", tone: "warning" },
          { id: "move", title: "Lo voy a mover", tone: "neutral" },
        ] },
      }],
    },
    {
      id: "carry",
      label: "Mañana",
      question: "¿Qué querés llevar a mañana?",
      skippable: true,
      cards: [{ type: "Reflection", id: "carry-text", props: { label: "Una línea", maxLines: 2, blockType: "carry" } }],
      savesAs: { blockType: "carry" },
    },
    {
      id: "done",
      label: "Listo",
      question: "Día cerrado",
      skippable: false,
      cards: [{ type: "Summary", id: "close-summary", props: { mode: "finish" } }],
    },
  ],
  output: {
    note: { notebook: "Diario", titleTemplate: "Día · {date}", blocks: ["feel", "energy", "carry"] },
    actions: [{ type: "store_blocks" }],
  },
  activationSentence: "Cada día laboral a las 6 ayudame a cerrar el día en un minuto",
};
