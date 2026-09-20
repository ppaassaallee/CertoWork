import type { Column, SoftTint, StatusOption, TableGroup } from "../types";
import type { StructuredRoutine } from "../../routines/structured";
import { PROPERTY_MGMT_TEMPLATE } from "./propertyManagement";

export type SystemTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  cover: string;
  tables: Array<{
    key: string;
    name: string;
    icon?: string;
    nounSingular?: string;
    columns: Column[];
    groups?: TableGroup[];
    sampleRecords?: Array<Record<string, unknown>>;
    views?: unknown[];
    forms?: unknown[];
  }>;
  links?: Array<{ fromTable: string; column: string; toTable: string; twoWay?: boolean }>;
  automations?: Array<Partial<StructuredRoutine> & { sentence: string }>;
  dashboard?: { name: string; widgets: Array<{ id: string; title: string; kind: string; metric?: string }> };
};

function simpleTemplate(
  id: string,
  name: string,
  category: string,
  columns: Column[],
  sample?: Array<Record<string, unknown>>,
): SystemTemplate {
  return {
    id,
    name,
    description: name,
    category,
    cover: "#2547C4",
    tables: [
      {
        key: "main",
        name,
        icon: "▦",
        nounSingular: "record",
        columns,
        groups: [{ id: "g-default", name: "Main", color: "#2547C4", order: 0 }],
        sampleRecords: sample,
      },
    ],
    automations: [],
  };
}

function opt(id: string, label: string, color: SoftTint = "gray"): StatusOption {
  return { id, label, tone: "neutral", color };
}

export const BUILTIN_SYSTEM_TEMPLATES: SystemTemplate[] = [
  PROPERTY_MGMT_TEMPLATE as unknown as SystemTemplate,
  simpleTemplate("client-onboarding", "Client onboarding", "sales", [
    { id: "name", name: "Client", type: "text", required: true },
    { id: "stage", name: "Stage", type: "status", options: [opt("new", "New", "blue"), opt("active", "Active", "green"), opt("done", "Done", "gray")] },
    { id: "owner", name: "Owner", type: "people" },
    { id: "kickoff", name: "Kickoff", type: "date" },
  ], [{ name: "Acme Co", stage: "new" }]),
  simpleTemplate("vendor-payments", "Vendor payments", "finance", [
    { id: "name", name: "Vendor", type: "text", required: true },
    { id: "amount", name: "Amount", type: "number", summary: "sum", config: { format: "currency", currency: "USD" } },
    { id: "status", name: "Status", type: "status", options: [opt("due", "Due", "orange"), opt("paid", "Paid", "green")] },
    { id: "due", name: "Due date", type: "date" },
  ]),
  simpleTemplate("recruiting", "Recruiting pipeline", "hr", [
    { id: "name", name: "Candidate", type: "text", required: true },
    { id: "role", name: "Role", type: "text" },
    { id: "stage", name: "Stage", type: "status", options: [opt("applied", "Applied", "blue"), opt("interview", "Interview", "purple"), opt("offer", "Offer", "green")] },
  ]),
  simpleTemplate("maintenance-it", "Maintenance / IT requests", "ops", [
    { id: "name", name: "Request", type: "text", required: true },
    { id: "priority", name: "Priority", type: "status", options: [opt("low", "Low"), opt("high", "High", "orange"), opt("emergency", "Emergency", "red")] },
    { id: "status", name: "Status", type: "status", options: [opt("new", "New", "blue"), opt("done", "Completed", "green")] },
  ]),
  simpleTemplate("inventory", "Inventory & assets", "ops", [
    { id: "name", name: "Asset", type: "text", required: true },
    { id: "qty", name: "Qty", type: "number", summary: "sum" },
    { id: "location", name: "Location", type: "text" },
  ]),
  simpleTemplate("simple-crm", "Simple CRM", "sales", [
    { id: "name", name: "Lead", type: "text", required: true },
    { id: "stage", name: "Stage", type: "status", options: [opt("lead", "Lead", "blue"), opt("deal", "Deal", "green")] },
    { id: "value", name: "Value", type: "number", summary: "sum", config: { format: "currency", currency: "USD" } },
  ]),
  simpleTemplate("event-planning", "Event planning", "ops", [
    { id: "name", name: "Task", type: "text", required: true },
    { id: "owner", name: "Owner", type: "people" },
    { id: "due", name: "Due", type: "date" },
    { id: "status", name: "Status", type: "status", options: [opt("todo", "To do"), opt("done", "Done", "green")] },
  ]),
  simpleTemplate("okrs", "OKRs", "strategy", [
    { id: "name", name: "Objective", type: "text", required: true },
    { id: "kr", name: "Key result", type: "text" },
    { id: "progress", name: "Progress", type: "number", config: { format: "percent" } },
  ]),
];

export function getSystemTemplate(id: string) {
  return BUILTIN_SYSTEM_TEMPLATES.find((t) => t.id === id) || null;
}
