import type { Dispatch, SetStateAction } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import type { Workspace } from "../lib/AuthContext";
import { categoryGroup, type ControlledListOption } from "../lib/controlledLists";
import { WORK_CATEGORIES } from "../lib/workClassification";
import { recordClientException } from "../lib/clientExceptions";

export type ControlledOptionGroup = "delivery_entity" | "client_entity" | "tag";

export type UseControlledListsActionsDeps = {
  user: User | null;
  workspace: Workspace | null;
  categories: any[];
  projects: any[];
  tasks: any[];
  setCategories: Dispatch<SetStateAction<any[]>>;
  setProjects: Dispatch<SetStateAction<any[]>>;
  setTasks: Dispatch<SetStateAction<any[]>>;
  setNotice: (notice: string) => void;
};

export function useControlledListsActions({
  user,
  workspace,
  categories,
  projects,
  tasks,
  setCategories,
  setProjects,
  setTasks,
  setNotice,
}: UseControlledListsActionsDeps) {
  const createControlledOption = async (
    group: ControlledOptionGroup,
    name: string,
  ) => {
    if (!user || !workspace) return name;
    const cleaned = name.trim();
    if (!cleaned) return "";
    const exists = categories.some(
      (category) =>
        categoryGroup(category) === group &&
        String(category.name || "").trim().toLowerCase() ===
          cleaned.toLowerCase(),
    );
    const existing = categories.find(
      (category) =>
        categoryGroup(category) === group &&
        String(category.name || "").trim().toLowerCase() ===
          cleaned.toLowerCase(),
    );
    if (exists) return group === "tag" ? existing?.id || cleaned : cleaned;
    try {
      const created = await addDoc(collection(db, "categories"), {
        userId: user.uid,
        workspaceId: workspace.id,
        name: cleaned,
        group,
        color:
          group === "delivery_entity"
            ? "#315f46"
            : group === "client_entity"
              ? "#4b6988"
              : "#7b5ea7",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCategories((current) =>
        current.some((category) => category.id === created.id)
          ? current
          : [
              ...current,
              {
                id: created.id,
                userId: user.uid,
                workspaceId: workspace.id,
                name: cleaned,
                group,
                color:
                  group === "delivery_entity"
                    ? "#315f46"
                    : group === "client_entity"
                      ? "#4b6988"
                      : "#7b5ea7",
                createdBy: user.uid,
              },
            ],
      );
      setNotice(`${cleaned} added to ${group.replace(/_/g, " ")}.`);
      return group === "tag" ? created.id : cleaned;
    } catch (reason) {
      recordClientException("controlled_lists", "create", reason, {
        group,
        name: cleaned,
      });
      setNotice(`Could not add ${cleaned}. Open Exception trace in Settings for details.`);
      return "";
    }
  };

  const renameControlledOption = async (
    group: ControlledOptionGroup,
    option: ControlledListOption,
    name: string,
  ) => {
    if (!user || !workspace) return;
    const previous = String(option.name || "").trim();
    const next = name.trim();
    if (!previous || !next || previous === next) return;
    try {
      const batch = writeBatch(db);
      let createdCategoryId: string | null = null;
      if (option.id) {
        batch.update(doc(db, "categories", option.id), {
          name: next,
          updatedAt: serverTimestamp(),
        });
      } else {
        const existing = categories.find(
          (category) =>
            categoryGroup(category) === group &&
            String(category.name || "").trim().toLowerCase() ===
              next.toLowerCase(),
        );
        if (!existing) {
          const categoryRef = doc(collection(db, "categories"));
          createdCategoryId = categoryRef.id;
          batch.set(categoryRef, {
            userId: user.uid,
            workspaceId: workspace.id,
            name: next,
            group,
            color:
              group === "delivery_entity"
                ? "#315f46"
                : group === "client_entity"
                  ? "#4b6988"
                  : "#7b5ea7",
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      if (group === "delivery_entity") {
        projects
          .filter(
            (project) =>
              String(project.deliveryEntity || "").trim() === previous ||
              String(project.bpo || "").trim() === previous,
          )
          .forEach((project) =>
            batch.update(doc(db, "projects", project.id), {
              deliveryEntity: next,
              bpo: next,
              updatedAt: serverTimestamp(),
            }),
          );
        tasks
          .filter(
            (task) =>
              String(task.deliveryEntity || "").trim() === previous ||
              String(task.bpo || "").trim() === previous,
          )
          .forEach((task) =>
            batch.update(doc(db, "tasks", task.id), {
              deliveryEntity: next,
              bpo: next,
              updatedAt: serverTimestamp(),
            }),
          );
      }
      if (group === "client_entity") {
        projects
          .filter(
            (project) =>
              String(project.clientEntity || "").trim() === previous ||
              String(project.client || "").trim() === previous,
          )
          .forEach((project) =>
            batch.update(doc(db, "projects", project.id), {
              clientEntity: next,
              client: next,
              updatedAt: serverTimestamp(),
            }),
          );
        tasks
          .filter(
            (task) =>
              String(task.clientEntity || "").trim() === previous ||
              String(task.client || "").trim() === previous,
          )
          .forEach((task) =>
            batch.update(doc(db, "tasks", task.id), {
              clientEntity: next,
              client: next,
              updatedAt: serverTimestamp(),
            }),
          );
      }
      if (group === "tag") {
        const matchingTag = categories.find(
          (category) =>
            categoryGroup(category) === "tag" &&
            String(category.name || "").trim() === previous,
        );
        if (matchingTag?.id && !option.id) {
          batch.update(doc(db, "categories", matchingTag.id), {
            name: next,
          });
        }
      }
      await batch.commit();
      setCategories((current) => {
        const updated = current.map((category) =>
          categoryGroup(category) === group &&
          (category.id === option.id ||
            String(category.name || "").trim().toLowerCase() ===
              previous.toLowerCase())
            ? { ...category, name: next }
            : category,
        );
        const existsAfterUpdate = updated.some(
          (category) =>
            categoryGroup(category) === group &&
            String(category.name || "").trim().toLowerCase() ===
              next.toLowerCase(),
        );
        if (existsAfterUpdate) return updated;
        return [
          ...updated,
          {
            id: createdCategoryId || `local-${group}-${next}`,
            userId: user.uid,
            workspaceId: workspace.id,
            name: next,
            group,
            color:
              group === "delivery_entity"
                ? "#315f46"
                : group === "client_entity"
                  ? "#4b6988"
                  : "#7b5ea7",
            createdBy: user.uid,
          },
        ];
      });
      if (group === "delivery_entity") {
        setProjects((current) =>
          current.map((project) =>
            String(project.deliveryEntity || "").trim() === previous ||
            String(project.bpo || "").trim() === previous
              ? { ...project, deliveryEntity: next, bpo: next }
              : project,
          ),
        );
        setTasks((current) =>
          current.map((task) =>
            String(task.deliveryEntity || "").trim() === previous ||
            String(task.bpo || "").trim() === previous
              ? { ...task, deliveryEntity: next, bpo: next }
              : task,
          ),
        );
      }
      if (group === "client_entity") {
        setProjects((current) =>
          current.map((project) =>
            String(project.clientEntity || "").trim() === previous ||
            String(project.client || "").trim() === previous
              ? { ...project, clientEntity: next, client: next }
              : project,
          ),
        );
        setTasks((current) =>
          current.map((task) =>
            String(task.clientEntity || "").trim() === previous ||
            String(task.client || "").trim() === previous
              ? { ...task, clientEntity: next, client: next }
              : task,
          ),
        );
      }
      setNotice(`${previous} renamed to ${next}. Dropdowns and existing records were updated.`);
    } catch (reason) {
      recordClientException("controlled_lists", "rename", reason, {
        group,
        previous,
        next,
        optionId: option.id || null,
      });
      setNotice(`Could not rename ${previous}. Open Exception trace in Settings for details.`);
    }
  };

  const matchesCategory = (record: any, previous: string) =>
    [record?.workCategory, record?.portfolioCategory, record?.categoryGroup].some(
      (value) => String(value || "").trim() === previous,
    );

  const renameWorkCategory = async (previousName: string, name: string) => {
    if (!user || !workspace) return;
    const previous = previousName.trim();
    const next = name.trim();
    if (!previous || !next || previous === next) return;
    try {
      const batch = writeBatch(db);
      const alias = categories.find((category) => {
        const group = String(category.group || "");
        return group.startsWith("work_category:") && String(category.name || "").trim() === previous;
      });
      const custom = categories.find(
        (category) =>
          String(category.group || "") === "work_category" &&
          String(category.name || "").trim() === previous,
      );
      const builtin = (WORK_CATEGORIES as readonly string[]).includes(previous);
      if (alias?.id) {
        batch.update(doc(db, "categories", alias.id), {
          name: next,
          updatedAt: serverTimestamp(),
        });
      } else if (custom?.id) {
        batch.update(doc(db, "categories", custom.id), {
          name: next,
          updatedAt: serverTimestamp(),
        });
      } else if (builtin) {
        const categoryRef = doc(collection(db, "categories"));
        batch.set(categoryRef, {
          userId: user.uid,
          workspaceId: workspace.id,
          name: next,
          group: `work_category:${previous}`,
          color: "#5b6472",
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const categoryRef = doc(collection(db, "categories"));
        batch.set(categoryRef, {
          userId: user.uid,
          workspaceId: workspace.id,
          name: next,
          group: "work_category",
          color: "#5b6472",
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      projects
        .filter((project) => matchesCategory(project, previous))
        .forEach((project) =>
          batch.update(doc(db, "projects", project.id), {
            workCategory: next,
            updatedAt: serverTimestamp(),
          }),
        );
      tasks
        .filter((task) => matchesCategory(task, previous))
        .forEach((task) =>
          batch.update(doc(db, "tasks", task.id), {
            workCategory: next,
            updatedAt: serverTimestamp(),
          }),
        );
      await batch.commit();
      setCategories((current) => {
        const renamed = current.map((category) => {
          const group = String(category.group || "");
          const sameName = String(category.name || "").trim() === previous;
          if (sameName && (group === "work_category" || group.startsWith("work_category:"))) {
            return { ...category, name: next };
          }
          return category;
        });
        const visible = renamed.some(
          (category) =>
            String(category.group || "").startsWith("work_category") &&
            String(category.name || "").trim() === next,
        );
        if (visible) return renamed;
        return [
          ...renamed,
          {
            id: `local-work-category-${next}`,
            name: next,
            group: builtin ? `work_category:${previous}` : "work_category",
          },
        ];
      });
      const apply = (record: any) =>
        matchesCategory(record, previous) ? { ...record, workCategory: next } : record;
      setProjects((current) => current.map(apply));
      setTasks((current) => current.map(apply));
      setNotice(`${previous} renamed to ${next}.`);
    } catch (reason) {
      recordClientException("controlled_lists", "rename_work_category", reason, {
        previous,
        next,
      });
      setNotice(`Could not rename ${previous}.`);
    }
  };

  return { createControlledOption, renameControlledOption, renameWorkCategory };
}
