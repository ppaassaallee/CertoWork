import {
  compareHierarchySiblings,
  hierarchyKind,
  presentItemIds,
  visibleParentId,
  type HierarchyKind,
} from "./itemHierarchy";

export type RelationshipLens = "client" | "delivery" | "people" | "project";

export type RelationshipRoot = {
  id: string;
  label: string;
  lens: RelationshipLens;
  projectIds: string[];
  itemIds: string[];
  meta?: string;
};

export type RelationshipTreeNode = {
  id: string;
  kind: "project" | HierarchyKind;
  record: any;
  children: RelationshipTreeNode[];
};

function text(value: unknown) {
  return String(value || "").trim();
}

function title(record: any) {
  return text(record?.title || record?.name) || "Untitled";
}

function normalized(value: unknown) {
  return text(value).toLocaleLowerCase();
}

function entityValue(record: any, lens: "client" | "delivery") {
  return lens === "client"
    ? text(record?.clientEntity || record?.client)
    : text(record?.deliveryEntity || record?.bpo || record?.delivery);
}

function uniqueRecords(records: any[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const id = text(record?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function buildRelationshipRoots({
  lens,
  projects,
  tasks,
  stakeholders,
}: {
  lens: RelationshipLens;
  projects: any[];
  tasks: any[];
  stakeholders: any[];
}): RelationshipRoot[] {
  if (lens === "project") {
    return projects
      .map((project) => ({
        id: text(project.id),
        label: title(project),
        lens,
        projectIds: [text(project.id)],
        itemIds: tasks.filter((task) => text(task.projectId) === text(project.id)).map((task) => text(task.id)),
        meta: entityValue(project, "client") || entityValue(project, "delivery") || undefined,
      }))
      .filter((root) => root.id)
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  if (lens === "people") {
    return stakeholders
      .map((stakeholder) => {
        const personTasks = tasks.filter((task) =>
          Array.isArray(task?.stakeholderIds) && task.stakeholderIds.map(String).includes(String(stakeholder.id)),
        );
        return {
          id: text(stakeholder.id),
          label: text(stakeholder.name) || text(stakeholder.email) || "Unnamed person",
          lens,
          projectIds: [...new Set(personTasks.map((task) => text(task.projectId)).filter(Boolean))],
          itemIds: personTasks.map((task) => text(task.id)),
          meta: text(stakeholder.role || stakeholder.email) || undefined,
        };
      })
      .filter((root) => root.id)
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  const labels = new Map<string, string>();
  for (const record of [...projects, ...tasks]) {
    const value = entityValue(record, lens);
    if (value && !labels.has(normalized(value))) labels.set(normalized(value), value);
  }

  return [...labels.entries()]
    .map(([id, label]) => {
      const directProjects = projects.filter((project) => normalized(entityValue(project, lens)) === id);
      const directTasks = tasks.filter((task) => normalized(entityValue(task, lens)) === id);
      const projectIds = new Set(directProjects.map((project) => text(project.id)));
      directTasks.forEach((task) => {
        if (text(task.projectId)) projectIds.add(text(task.projectId));
      });
      const relatedTasks = tasks.filter(
        (task) => projectIds.has(text(task.projectId)) || normalized(entityValue(task, lens)) === id,
      );
      return {
        id,
        label,
        lens,
        projectIds: [...projectIds],
        itemIds: relatedTasks.map((task) => text(task.id)),
      } as RelationshipRoot;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function buildItemForest(items: any[]): RelationshipTreeNode[] {
  const unique = uniqueRecords(items);
  const ids = presentItemIds(unique);
  const children = new Map<string, any[]>();
  const roots: any[] = [];
  for (const item of unique) {
    const parent = visibleParentId(item, ids);
    if (!parent) roots.push(item);
    else children.set(parent, [...(children.get(parent) || []), item]);
  }

  const walk = (item: any, path = new Set<string>()): RelationshipTreeNode => {
    const id = text(item.id);
    if (path.has(id)) return { id, kind: hierarchyKind(item), record: item, children: [] };
    const nextPath = new Set(path).add(id);
    return {
      id,
      kind: hierarchyKind(item),
      record: item,
      children: [...(children.get(id) || [])]
        .sort(compareHierarchySiblings)
        .map((child) => walk(child, nextPath)),
    };
  };

  return roots.sort(compareHierarchySiblings).map((item) => walk(item));
}

export function buildRelationshipTree({
  root,
  projects,
  tasks,
}: {
  root: RelationshipRoot;
  projects: any[];
  tasks: any[];
}): RelationshipTreeNode[] {
  const projectIds = new Set(root.projectIds.map(String));
  const explicitItemIds = new Set(root.itemIds.map(String));
  const relatedProjects = projects.filter((project) => projectIds.has(String(project.id)));

  const nodes = relatedProjects.map((project) => {
    const projectTasks = tasks.filter((task) => String(task.projectId || "") === String(project.id));
    return {
      id: String(project.id),
      kind: "project" as const,
      record: project,
      children: buildItemForest(projectTasks),
    };
  });

  const standalone = tasks.filter(
    (task) => explicitItemIds.has(String(task.id)) && !projectIds.has(String(task.projectId || "")),
  );
  return [
    ...nodes.sort((left, right) => title(left.record).localeCompare(title(right.record))),
    ...buildItemForest(standalone),
  ];
}

export function relationshipNodeCount(nodes: RelationshipTreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + relationshipNodeCount(node.children), 0);
}

export function relationshipBranchIds(nodes: RelationshipTreeNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.children.length ? [node.id] : []),
    ...relationshipBranchIds(node.children),
  ]);
}
