/**
 * Collab ↔ routines recipes and event filters.
 * Trigger: tableEvents type `message.created` (from onMessageCreated).
 */
export type CollabRoutineRecipeId =
  | "daily_standup_post"
  | "client_reply_sla"
  | "checkpoint_reminder"
  | "close_the_loop";

export const COLLAB_ROUTINE_RECIPES: Array<{
  id: CollabRoutineRecipeId;
  title: string;
  description: string;
  trigger: string;
  action: string;
}> = [
  {
    id: "daily_standup_post",
    title: "Daily standup post",
    description: "Each project room at 09:00: open items due today, blocked, yesterday's completions.",
    trigger: "schedule.daily",
    action: "postToProjectRoom",
  },
  {
    id: "client_reply_sla",
    title: "Client reply SLA",
    description: "External message unanswered 4h → signal + internal reminder.",
    trigger: "message.created + delay",
    action: "postMessage + signal",
  },
  {
    id: "checkpoint_reminder",
    title: "Checkpoint reminder",
    description: "3 days before checkpoint → project room.",
    trigger: "schedule",
    action: "postToProjectRoom",
  },
  {
    id: "close_the_loop",
    title: "Close the loop",
    description: "Item completed → system message in item thread and project room.",
    trigger: "item.completed",
    action: "postMessage",
  },
];

export function isMessageCreatedEvent(event: { type?: string }) {
  return event.type === "message.created";
}
