import {
  DELIVERY_PHASES_BY_STAGE,
  DELIVERY_STAGES,
  deliveryPhaseLabels,
  deliveryStageLabels,
} from "./projectDelivery";

export type ControlledListGroup =
  | "delivery_entity"
  | "client_entity"
  | "tag"
  | "project_stage"
  | "project_phase"
  | "project_status"
  | "project_health"
  | "gtd_action";

export type ControlledListOption = {
  id?: string;
  name: string;
  group: ControlledListGroup;
  locked?: boolean;
  source?: "master" | "discovered" | "system";
};

export const controlledListLabels: Record<ControlledListGroup, string> = {
  delivery_entity: "Delivery Entity",
  client_entity: "Client Entity",
  tag: "Tags",
  project_stage: "Stage",
  project_phase: "Phase",
  project_status: "Status",
  project_health: "Health",
  gtd_action: "GTD",
};

export const editableControlledGroups: ControlledListGroup[] = [
  "delivery_entity",
  "client_entity",
  "tag",
];

export const lockedControlledGroups: ControlledListGroup[] = [
  "project_stage",
  "project_phase",
  "project_status",
  "project_health",
  "gtd_action",
];

export const projectStatusOptions = [
  "Planning",
  "Active",
  "Paused",
  "Completed",
  "Archived",
  "Deleted",
];

export const projectHealthOptions = ["On track", "At risk", "Blocked"];

export const gtdActionOptions = [
  "N/A",
  "Next action",
  "Waiting for",
  "Someday",
  "Reference",
  "Decision",
  "Delegated",
  "Follow-up",
];

export function categoryGroup(category: any): ControlledListGroup {
  const group = String(category?.group || "tag").toLowerCase();
  if (group === "tags" || group === "category") return "tag";
  if (group === "bpo") return "delivery_entity";
  if (group === "client") return "client_entity";
  if (
    [
      "delivery_entity",
      "client_entity",
      "tag",
      "project_stage",
      "project_phase",
      "project_status",
      "project_health",
      "gtd_action",
    ].includes(group)
  )
    return group as ControlledListGroup;
  return "tag";
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function unique(values: string[]) {
  return [...new Set(values.map(clean).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function controlledOptions(
  categories: any[],
  group: ControlledListGroup,
  discoveredValues: string[] = [],
): ControlledListOption[] {
  const master = categories
    .filter((category) => categoryGroup(category) === group)
    .map((category) => ({
      id: category.id,
      name: clean(category.name || category.title),
      group,
      source: "master" as const,
    }))
    .filter((option) => option.name);
  const masterKeys = new Set(
    master.flatMap((option) => [option.name, option.id || ""]),
  );
  const discovered = unique(discoveredValues)
    .filter((name) => !masterKeys.has(name))
    .map((name) => ({
      name,
      group,
      source: "discovered" as const,
    }));
  return [...master, ...discovered];
}

export function controlledOptionNames(
  categories: any[],
  group: ControlledListGroup,
  discoveredValues: string[] = [],
) {
  return controlledOptions(categories, group, discoveredValues).map(
    (option) => option.name,
  );
}

export function systemControlledOptions(
  group: ControlledListGroup,
): ControlledListOption[] {
  if (group === "project_stage")
    return DELIVERY_STAGES.map((stage) => ({
      name: deliveryStageLabels[stage],
      group,
      locked: true,
      source: "system" as const,
    }));
  if (group === "project_phase")
    return Object.values(DELIVERY_PHASES_BY_STAGE)
      .flat()
      .map((phase) => ({
        name: deliveryPhaseLabels[phase],
        group,
        locked: true,
        source: "system" as const,
      }));
  if (group === "project_status")
    return projectStatusOptions.map((name) => ({
      name,
      group,
      locked: true,
      source: "system" as const,
    }));
  if (group === "project_health")
    return projectHealthOptions.map((name) => ({
      name,
      group,
      locked: true,
      source: "system" as const,
    }));
  if (group === "gtd_action")
    return gtdActionOptions.map((name) => ({
      name,
      group,
      locked: true,
      source: "system" as const,
    }));
  return [];
}
