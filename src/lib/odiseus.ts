/** Odysseus — Certo Work's AI employee (internal identity for Chief of Staff). */

export const ODISEUS_NAME = "Odysseus";
export const ODISEUS_MARK = "O";
export const ODISEUS_TAGLINE = "Not a tool. A hire.";
export const ODISEUS_SUBLINE =
  "Assign an outcome. Odysseus can investigate, organize, execute and return the finished work.";
export const ODISEUS_SIDEBAR_BLURB = "Does the work you can't get to";
export const ODISEUS_CONVERSATION_TITLE = "Odysseus";
export const ODISEUS_APP_LABEL = "APP";
export const ODISEUS_HANDOFF_PREFIX = "Handoff from Odysseus";

/** Firestore / routing keep this key for compatibility. */
export const ODISEUS_CONVERSATION_TYPE = "chief_of_staff" as const;

export function isOdysseusConversation(conversation?: {
  conversationType?: string | null;
  isChiefOfStaff?: boolean;
} | null) {
  return Boolean(
    conversation?.isChiefOfStaff ||
      conversation?.conversationType === ODISEUS_CONVERSATION_TYPE,
  );
}
