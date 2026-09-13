/**
 * Field inventory → UI group mapping for ItemModal v2.
 * Every field the WorkItemsCenter modal reads/writes must appear here.
 * Unlisted discovery fields go to "classification".
 */
export type ItemModalGroup =
  | "bar"
  | "content"
  | "properties"
  | "classification"
  | "planning"
  | "routines"
  | "activity";

export type FieldMapEntry = {
  key: string;
  group: ItemModalGroup;
  writeKeys: string[];
};

export const ITEM_MODAL_FIELD_MAP: FieldMapEntry[] = [
  { key: "workItemType", group: "bar", writeKeys: ["workItemType", "itemType", "taskType"] },
  { key: "key", group: "bar", writeKeys: [] },
  { key: "parentId", group: "bar", writeKeys: ["parentId", "epicId", "featureId"] },
  { key: "title", group: "content", writeKeys: ["title"] },
  { key: "description", group: "content", writeKeys: ["description"] },
  { key: "checklist", group: "content", writeKeys: ["checklist"] },
  { key: "comments", group: "content", writeKeys: ["comments", "mentionedNames"] },
  { key: "status", group: "properties", writeKeys: ["status", "statusHistory", "completedAt"] },
  { key: "priority", group: "properties", writeKeys: ["priority"] },
  { key: "assignee", group: "properties", writeKeys: ["assigneeIds", "assignees", "owner", "assignee", "assigneeId"] },
  { key: "collaborators", group: "classification", writeKeys: ["collaboratorMemberIds", "collaborators"] },
  { key: "startDate", group: "properties", writeKeys: ["startDate"] },
  { key: "dueDate", group: "properties", writeKeys: ["dueDate", "timeSector", "timeSectorDate", "timeSectorExpiresAt"] },
  { key: "sprintId", group: "properties", writeKeys: ["sprintId"] },
  { key: "estimateHours", group: "properties", writeKeys: ["estimateHours"] },
  { key: "tags", group: "properties", writeKeys: ["tagIds", "tags", "labels"] },
  { key: "parent", group: "properties", writeKeys: ["parentId", "epicId", "featureId"] },
  { key: "deliveryEntity", group: "classification", writeKeys: ["deliveryEntity", "bpo"] },
  { key: "clientEntity", group: "classification", writeKeys: ["clientEntity", "client"] },
  { key: "workCategory", group: "classification", writeKeys: ["workCategory"] },
  { key: "productPhase", group: "classification", writeKeys: ["productPhase"] },
  { key: "projectId", group: "classification", writeKeys: ["projectId"] },
  { key: "storyPoints", group: "classification", writeKeys: ["storyPoints"] },
  { key: "loggedHours", group: "classification", writeKeys: ["loggedHours"] },
  { key: "recurrence", group: "classification", writeKeys: ["recurrenceType", "isRoutineTask", "recurrenceStatus"] },
  { key: "gtdType", group: "planning", writeKeys: ["actionType", "gtdActionType", "globalStageId"] },
  { key: "actionBoardBucket", group: "planning", writeKeys: [] },
];

export const REQUIRED_FIELD_KEYS = ITEM_MODAL_FIELD_MAP.map((entry) => entry.key);
