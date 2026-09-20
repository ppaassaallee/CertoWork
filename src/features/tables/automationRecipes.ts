export type TableRecipe = {
  id: string;
  sentence: string;
  category: string;
  icon: string;
  uses: number;
  actionType: "set" | "notify" | "createRecord";
  defaultTriggerColumnHint?: string;
  defaultTo?: string;
  defaultSetColumnHint?: string;
};

export const TABLE_AUTOMATION_RECIPES: TableRecipe[] = [
  {
    id: "status-set-date",
    sentence: "When Status changes to Completed, set Completion date to today",
    category: "Status",
    icon: "📅",
    uses: 128,
    actionType: "set",
    defaultTo: "completed",
    defaultSetColumnHint: "completion",
  },
  {
    id: "status-notify-person",
    sentence: "When Status changes, notify the person column",
    category: "Status",
    icon: "🔔",
    uses: 96,
    actionType: "notify",
  },
  {
    id: "status-move-group",
    sentence: "When Status changes to Done, move to Completed group",
    category: "Status",
    icon: "📦",
    uses: 54,
    actionType: "set",
  },
  {
    id: "status-create-linked",
    sentence: "When Status changes to Completed, create a record in the linked table",
    category: "Status",
    icon: "🔗",
    uses: 41,
    actionType: "createRecord",
  },
  {
    id: "priority-notify",
    sentence: "When Priority changes to Emergency, notify owner",
    category: "Priority",
    icon: "🚨",
    uses: 73,
    actionType: "notify",
    defaultTo: "emergency",
  },
  {
    id: "date-n-days",
    sentence: "When a date is N days away, notify",
    category: "Date",
    icon: "⏳",
    uses: 88,
    actionType: "notify",
  },
  {
    id: "date-reached-status",
    sentence: "When date is reached, set Status",
    category: "Date",
    icon: "✅",
    uses: 35,
    actionType: "set",
  },
  {
    id: "created-assign",
    sentence: "When a record is created, assign to me",
    category: "Created",
    icon: "👤",
    uses: 62,
    actionType: "set",
  },
  {
    id: "created-notify",
    sentence: "When a record is created, notify editors",
    category: "Created",
    icon: "📣",
    uses: 47,
    actionType: "notify",
  },
  {
    id: "monthly-rent",
    sentence: "Every month, create records for each matching filter",
    category: "Schedule",
    icon: "🔁",
    uses: 29,
    actionType: "createRecord",
  },
  {
    id: "form-submit",
    sentence: "When intake form is submitted, notify and set Status to New",
    category: "Form",
    icon: "📝",
    uses: 51,
    actionType: "notify",
  },
  {
    id: "number-threshold",
    sentence: "When number goes over threshold, notify",
    category: "Number",
    icon: "📈",
    uses: 22,
    actionType: "notify",
  },
  {
    id: "button-item",
    sentence: "When button is clicked, create an item",
    category: "Button",
    icon: "▶️",
    uses: 18,
    actionType: "createRecord",
  },
  {
    id: "status-invoice",
    sentence: "When Status is Complete and type is Invoice, create Billing invoice",
    category: "Billing",
    icon: "💵",
    uses: 14,
    actionType: "createRecord",
  },
];
