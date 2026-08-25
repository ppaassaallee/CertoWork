import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import type { Workspace } from "../lib/AuthContext";
import {
  buildProjectTemplate,
  instantiateTemplateItems,
  type TemplateRole,
} from "../lib/projectTemplates";
import { projectWorkKey } from "../lib/workspaceDisplay";
import { nextWorkItemKey } from "../lib/workItemKey";
import {
  buildOwnedAccessPatch,
  buildTaskAccessPatch,
} from "../lib/accessControl";
import { withCreatorAssignee } from "../lib/myWorkItems";
import type { WorkspaceMember } from "../lib/workspaceCollaboration";
import type { TemplateApplication } from "../components/ProjectTemplatesPanel";
import type {
  CenterView,
  Message,
  Panel,
} from "../components/DelivereeWorkspace";

export type UseProjectTemplatesDeps = {
  user: User | null;
  workspace: Workspace | null;
  projects: any[];
  tasks: any[];
  workspaceMembers: WorkspaceMember[];
  setNotice: (notice: string) => void;
  memberLabel: (member: WorkspaceMember) => string;
  setConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  setProjectConsoleId: (id: string | null) => void;
  setPanel: (next: Panel) => void;
  goCenterView: (next: CenterView) => void;
  navigate: (path: string) => void;
};

export function useProjectTemplates({
  user,
  workspace,
  projects,
  tasks,
  workspaceMembers,
  setNotice,
  memberLabel,
  setConversationId,
  setMessages,
  setProjectConsoleId,
  setPanel,
  goCenterView,
  navigate,
}: UseProjectTemplatesDeps) {
  const createCostTemplate = async (template: any) => {
    if (!user || !workspace || !template?.name?.trim()) return;
    await addDoc(collection(db, "cost_templates"), {
      name: template.name.trim(),
      description: String(template.description || "").trim(),
      rows: Array.isArray(template.rows) ? template.rows : [],
      userId: user.uid,
      workspaceId: workspace.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice("Cost template saved for this workspace.");
  };

  const updateCostTemplate = async (
    templateId: string,
    patch: Record<string, unknown>,
  ) => {
    await updateDoc(doc(db, "cost_templates", templateId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    setNotice("Cost template updated.");
  };

  const createProjectTemplate = async (
    sourceProjectId: string,
    name: string,
    description: string,
  ) => {
    if (!user || !workspace) return;
    const source = projects.find((project) => project.id === sourceProjectId);
    if (!source || !name.trim()) return;
    const template = buildProjectTemplate(source, tasks, name, description);
    await addDoc(collection(db, "agent_templates"), {
      ...template,
      userId: user.uid,
      workspaceId: workspace.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNotice(`${name.trim()} saved to the workspace template library.`);
  };

  const deleteProjectTemplate = async (templateId: string) => {
    if (!templateId) return;
    await deleteDoc(doc(db, "agent_templates", templateId));
    setNotice("Project template deleted.");
  };

  const applyProjectTemplate = async (
    template: any,
    application: TemplateApplication,
  ) => {
    if (!user || !workspace || !application.title.trim()) return;
    const member = (id: string) =>
      workspaceMembers.find((candidate) => candidate.id === id);
    const roleAssignment = (id: string) => {
      const selected = member(id);
      return selected
        ? { id: selected.id, name: memberLabel(selected) }
        : undefined;
    };
    const roleAssignments: Partial<
      Record<TemplateRole, { id: string; name: string }>
    > = {
      project_manager: roleAssignment(application.projectManagerId),
      product_owner: roleAssignment(application.productOwnerId),
      sponsor: roleAssignment(application.sponsorId),
    };
    const instantiatedItems = instantiateTemplateItems(
      template,
      application.startDate,
      roleAssignments,
    );
    const projectRef = doc(collection(db, "projects"));
    const conversationRef = doc(collection(db, "boldi_conversations"));
    const taskRefs = new Map<string, ReturnType<typeof doc>>();
    const taskByKey = new Map<string, any>();
    instantiatedItems.forEach((item: any) => {
      taskRefs.set(item.templateKey, doc(collection(db, "tasks")));
      taskByKey.set(item.templateKey, item);
    });
    const projectManager = roleAssignments.project_manager;
    const productOwner = roleAssignments.product_owner;
    const sponsor = roleAssignments.sponsor;
    const dueDates = instantiatedItems
      .map((item: any) => item.dueDate)
      .filter(Boolean)
      .sort();
    const batch = writeBatch(db);
    batch.set(projectRef, {
      ...(template.projectDefaults || {}),
      userId: user.uid,
      workspaceId: workspace.id,
      ...buildOwnedAccessPatch({ userId: user.uid, email: user.email }),
      title: application.title.trim(),
      name: application.title.trim(),
      normalizedTitle: application.title.trim().toLowerCase().replace(/\s+/g, " "),
      projectKey: `${projectWorkKey({ title: application.title })}-${projectRef.id.slice(0, 4).toUpperCase()}`,
      client: application.client || "Internal",
      bpo: application.bpo || "Internal",
      status: "planning",
      startDate: application.startDate,
      plannedStartDate: application.startDate,
      targetDate: dueDates[dueDates.length - 1] || null,
      dueDate: dueDates[dueDates.length - 1] || null,
      projectManagerId: projectManager?.id || null,
      projectManager: projectManager?.name || "",
      productOwnerId: productOwner?.id || null,
      productOwner: productOwner?.name || "",
      sponsorId: sponsor?.id || null,
      sponsor: sponsor?.name || "",
      sponsorIds: sponsor?.id ? [sponsor.id] : [],
      sponsors: sponsor?.name ? [sponsor.name] : [],
      sourceTemplateId: template.id,
      sourceTemplateName: template.name,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const issuedItemKeys: string[] = [];
    instantiatedItems.forEach((item: any, index: number) => {
      const taskRef = taskRefs.get(item.templateKey)!;
      const parentRef = item.parentTemplateKey
        ? taskRefs.get(item.parentTemplateKey)
        : null;
      const parentTemplate = item.parentTemplateKey
        ? taskByKey.get(item.parentTemplateKey)
        : null;
      const parentKind = String(parentTemplate?.workItemType || "");
      const canonicalType = String(item.workItemType || "pbi").toLowerCase();
      const itemKey = nextWorkItemKey([
        ...tasks.map((task) => task.key || task.workItemKey),
        ...issuedItemKeys,
      ]);
      issuedItemKeys.push(itemKey);
      const assignedItem = withCreatorAssignee(item, {
        userId: user.uid,
        memberId: `${workspace.id}_${user.uid}`,
        email: user.email,
      }, workspaceMembers);
      batch.set(taskRef, {
        userId: user.uid,
        workspaceId: workspace.id,
        projectId: projectRef.id,
        ...buildTaskAccessPatch({
          task: assignedItem,
          workspaceId: workspace.id,
          userId: user.uid,
          email: user.email,
          members: workspaceMembers,
        }),
        title: assignedItem.title,
        normalizedTitle: String(assignedItem.title).trim().toLowerCase().replace(/\s+/g, " "),
        description: assignedItem.description || "",
        key: itemKey,
        type: canonicalType,
        workItemType: canonicalType,
        itemType: canonicalType,
        parentId: parentRef?.id || null,
        epicId: parentKind === "epic" ? parentRef?.id || null : null,
        featureId: parentKind === "feature" ? parentRef?.id || null : null,
        priority: assignedItem.priority || null,
        status: "backlog",
        startDate: assignedItem.startDate || null,
        dueDate: assignedItem.dueDate || null,
        assigneeIds: assignedItem.assigneeIds || [],
        assignees: assignedItem.assignees || [],
        owner: assignedItem.owner || "",
        order: Number(item.order ?? index),
        rank: Number(item.order ?? index),
        source: "project_template",
        sourceTemplateId: template.id,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    batch.set(conversationRef, {
      userId: user.uid,
      workspaceId: workspace.id,
      title: application.title.trim(),
      status: "active",
      sourceContext: "project",
      contextEntityId: projectRef.id,
      conversationType: "project",
      linkedProjectIds: [projectRef.id],
      linkedTaskIds: [],
      isChiefOfStaff: false,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    setConversationId(conversationRef.id);
    setMessages([]);
    setProjectConsoleId(projectRef.id);
    setPanel(null);
    goCenterView("project");
    navigate(`/work/projects/${projectRef.id}`);
    setNotice(
      `${application.title.trim()} created from ${template.name} with ${instantiatedItems.length} work items.`,
    );
  };

  return {
    createCostTemplate,
    updateCostTemplate,
    createProjectTemplate,
    deleteProjectTemplate,
    applyProjectTemplate,
  };
}
