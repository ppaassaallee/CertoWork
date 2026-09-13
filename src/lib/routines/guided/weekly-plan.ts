import type { RecipeManifest } from "../manifest";

export const WEEKLY_PLAN_MANIFEST: RecipeManifest = {
  id: "weekly-plan",
  name: "Plan semanal",
  tagline: "2–3 metas, acciones y tiempo protegido — cada lunes",
  domain: "personal",
  class: "guided",
  cadence: {
    default: "Mon 08:00",
    cron: "0 8 * * 1",
    humanText: "Lunes 08:00",
  },
  estimatedMinutes: 7,
  activationSentence:
    "Cada lunes a las 8 ayudame a planear la semana con 2 o 3 metas y tiempo protegido.",
  prepare: {
    gather: [
      "undone_items",
      "week_deadlines",
      "epic_candidates",
      "calendar_load",
      "last_alignment",
    ],
  },
  steps: [
    {
      id: "metas",
      label: "Metas",
      question: "¿Cuáles son las 2 o 3 cosas que hacen que esta semana valga?",
      hint: "Metas sugeridas + texto libre. Hasta 4 acciones por meta.",
      skippable: false,
      savesAs: { blockType: "metas" },
      cards: [
        { type: "Finding", id: "goal-suggestions", props: { source: "epic_candidates" } },
        { type: "GoalComposer", id: "goals", props: { maxGoals: 3, maxActions: 4 } },
      ],
    },
    {
      id: "proteger",
      label: "Proteger",
      question: "¿Cuándo vas a trabajar en esto sin interrupciones?",
      hint: "Bloques por meta y un día libre. Si no hay calendario, se guardan igual.",
      skippable: true,
      savesAs: { blockType: "tiempo_protegido" },
      cards: [{ type: "TimeBlocks", id: "blocks", props: { days: 5 } }],
    },
    {
      id: "capacidad",
      label: "Capacidad",
      question: "¿Entra?",
      hint: "Horas disponibles vs ET de las acciones.",
      skippable: true,
      cards: [{ type: "Capacity", id: "capacity" }],
    },
    {
      id: "compromiso",
      label: "Compromiso",
      question: "Tu semana",
      skippable: false,
      cards: [{ type: "Summary", id: "plan-summary", props: { mode: "finish" } }],
    },
  ],
  output: {
    note: {
      notebook: "Revisiones",
      titleTemplate: "Plan · {weekLabel}",
      blocks: ["metas", "tiempo_protegido"],
    },
    actions: [
      { type: "create_item", fromStep: "metas" },
      { type: "link_week", fromStep: "metas" },
      { type: "store_blocks", fromStep: "proteger" },
    ],
  },
};
