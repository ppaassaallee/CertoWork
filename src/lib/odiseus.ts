/** Odiseus — Certo Work's AI employee (internal identity for Chief of Staff). */

export const ODISEUS_NAME = "Odiseus";
export const ODISEUS_MARK = "O";
export const ODISEUS_TAGLINE = "Not a tool. A hire.";
export const ODISEUS_SUBLINE =
  "The AI employee that lives inside Certo Work — proposes the next step, asks before anything it can't undo.";
export const ODISEUS_SIDEBAR_BLURB = "Does the work you can't get to";
export const ODISEUS_CONVERSATION_TITLE = "Odiseus";
export const ODISEUS_APP_LABEL = "APP";
export const ODISEUS_HANDOFF_PREFIX = "Handoff from Odiseus";

/** Firestore / routing keep this key for compatibility. */
export const ODISEUS_CONVERSATION_TYPE = "chief_of_staff" as const;

export function isOdiseusConversation(conversation?: {
  conversationType?: string | null;
  isChiefOfStaff?: boolean;
} | null) {
  return Boolean(
    conversation?.isChiefOfStaff ||
      conversation?.conversationType === ODISEUS_CONVERSATION_TYPE,
  );
}
