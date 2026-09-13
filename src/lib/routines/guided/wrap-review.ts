import type { RecipeManifest } from "../manifest";

export const WRAP_REVIEW_MANIFEST: RecipeManifest = {
  id: "wrap-review",
  name: "WRAP Review",
  tagline: "Wins · Results · Alignment · Plan — cada viernes",
  domain: "personal",
  class: "guided",
  cadence: {
    default: "Fri 16:00",
    cron: "0 16 * * 5",
    humanText: "Viernes 16:00",
  },
  estimatedMinutes: 12,
  expiresWeekday: 1,
  summaryStepIds: ["cierre", "wins", "plan"],
  activationSentence:
    "Cada viernes a las 4 guiame por mi revisión de la semana.",
  prepare: {
    gather: [
      "planned_items",
      "done_items",
      "undone_items",
      "blocked_items",
      "win_signals",
      "prior_goals",
      "protected_blocks",
    ],
  },
  steps: [
    {
      id: "cierre",
      label: "Cierre",
      question: "¿Qué quedó sin hacer?",
      hint: "Mové a la próxima semana, archivá lo que ya no aplica, o dejalo para hoy.",
      skippable: true,
      cards: [{ type: "ItemTriage", id: "undone-triage", props: { source: "undone_items" } }],
    },
    {
      id: "wins",
      label: "Wins",
      question: "¿Qué vale la pena celebrar esta semana?",
      hint: "Odysseus encontró estos en tu semana. Dejá los que sientas como logros y agregá los tuyos.",
      skippable: true,
      savesAs: { blockType: "wins" },
      cards: [
        { type: "Finding", id: "win-findings", props: { source: "win_signals" } },
        {
          type: "Reflection",
          id: "my-wins",
          props: { label: "Mis wins", blockType: "wins" },
        },
      ],
    },
    {
      id: "results",
      label: "Results",
      question: "¿Qué planeaste y qué pasó?",
      hint: "Mirada honesta: planeado vs hecho.",
      skippable: true,
      skipInSummary: true,
      savesAs: { blockType: "resultados" },
      cards: [
        { type: "MetricStrip", id: "results-metrics", props: { source: "metrics" } },
        {
          type: "Reflection",
          id: "results-notes",
          props: { label: "Resultados", draftFrom: "ai", maxLines: 2 },
        },
      ],
    },
    {
      id: "alignment",
      label: "Alignment",
      question: "¿El trabajo de esta semana te acerca a donde querés ir?",
      skippable: true,
      skipInSummary: true,
      savesAs: { blockType: "alineacion" },
      cards: [
        {
          type: "Reflection",
          id: "alignment",
          props: { label: "Alineación", scale: true, rememberDirection: true },
        },
      ],
    },
    {
      id: "plan",
      label: "Plan",
      question: "La próxima semana",
      hint: "Encadena al Plan semanal (metas + tiempo protegido).",
      skippable: true,
      savesAs: { blockType: "plan" },
      cards: [{ type: "Summary", id: "plan-bridge", props: { mode: "chain" } }],
    },
    {
      id: "cierre-final",
      label: "Cierre",
      question: "Listo",
      skippable: false,
      skipInSummary: true,
      cards: [{ type: "Summary", id: "wrap-summary", props: { mode: "finish" } }],
    },
  ],
  output: {
    note: {
      notebook: "Revisiones",
      titleTemplate: "WRAP · {weekLabel}",
      blocks: ["wins", "resultados", "alineacion", "plan"],
    },
    actions: [
      { type: "move_due", fromStep: "cierre" },
      { type: "archive", fromStep: "cierre" },
      { type: "remember_fact", fromStep: "alignment" },
    ],
  },
  chainsTo: "weekly-plan",
};
