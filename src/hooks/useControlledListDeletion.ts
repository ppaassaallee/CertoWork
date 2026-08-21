import type { Dispatch, SetStateAction } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import type { Workspace } from "../lib/AuthContext";
import { categoryGroup, type ControlledListOption } from "../lib/controlledLists";
import { recordClientException } from "../lib/clientExceptions";
import type { ControlledOptionGroup } from "./useControlledListsActions";

export type UseControlledListDeletionDeps = {
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

export function useControlledListDeletion({
  user,
  workspace,
  categories,
  projects,
  tasks,
  setCategories,
  setProjects,
  setTasks,
  setNotice,
}: UseControlledListDeletionDeps) {
  const deleteControlledOption = async (
    group: ControlledOptionGroup,
    option: ControlledListOption,
  ) => {
    if (!user || !workspace) return;
    const previous = String(option.name || "").trim();
    if (!previous) return;
    const confirmed = window.confirm(
      group === "tag"
        ? `Remove "${previous}" from tags? Matching projects/items will have this tag cleared.`
        : `Remove "${previous}" from ${group.replace(/_/g, " ")}? Existing projects/items using it will be moved to Internal so it does not reappear.`,
    );
    if (!confirmed) return;
    try {
      const batch = writeBatch(db);
      const matchingCategoryIds = categories
        .filter(
          (category) =>
            categoryGroup(category) === group &&
            (category.id === option.id ||
              String(category.name || "").trim().toLowerCase() ===
                previous.toLowerCase()),
        )
        .map((category) => category.id)
        .filter(Boolean);
      matchingCategoryIds.forEach((categoryId) =>
        batch.delete(doc(db, "categories", categoryId)),
      );
      if (group === "delivery_entity") {
        projects
          .filter(
            (project) =>
              String(project.deliveryEntity || "").trim() === previous ||
              String(project.bpo || "").trim() === previous,
          )
          .forEach((project) =>
            batch.update(doc(db, "projects", project.id), {
              deliveryEntity: "Internal",
              bpo: "Internal",
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
              deliveryEntity: "Internal",
              bpo: "Internal",
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
              clientEntity: "Internal",
              client: "Internal",
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
              clientEntity: "Internal",
              client: "Internal",
              updatedAt: serverTimestamp(),
            }),
          );
      }
      if (group === "tag") {
        const removedKeys = [previous, option.id || "", ...matchingCategoryIds]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        const withoutRemoved = (record: any) => [
          ...new Set(
            [
              ...(Array.isArray(record.tagIds) ? record.tagIds : []),
              ...(Array.isArray(record.tags) ? record.tags : []),
              ...(Array.isArray(record.labels) ? record.labels : []),
            ]
              .map((value) => String(value || "").trim())
              .filter(
                (value) =>
                  value &&
                  !removedKeys.some(
                    (removed) =>
                      removed.toLowerCase() === value.toLowerCase(),
                  ),
              ),
          ),
        ];
        const hasRemovedTag = (record: any) => {
          const values = [
            ...(Array.isArray(record.tagIds) ? record.tagIds : []),
            ...(Array.isArray(record.tags) ? record.tags : []),
            ...(Array.isArray(record.labels) ? record.labels : []),
          ].map((value) => String(value || "").trim().toLowerCase());
          return removedKeys.some((removed) =>
            values.includes(removed.toLowerCase()),
          );
        };
        projects.filter(hasRemovedTag).forEach((project) => {
          const next = withoutRemoved(project);
          batch.update(doc(db, "projects", project.id), {
            tagIds: next,
            tags: next,
            labels: next,
            updatedAt: serverTimestamp(),
          });
        });
        tasks.filter(hasRemovedTag).forEach((task) => {
          const next = withoutRemoved(task);
          batch.update(doc(db, "tasks", task.id), {
            tagIds: next,
            tags: next,
            labels: next,
            updatedAt: serverTimestamp(),
          });
        });
      }
      await batch.commit();
      setCategories((current) =>
        current.filter(
          (category) =>
            !(
              categoryGroup(category) === group &&
              (matchingCategoryIds.includes(category.id) ||
                String(category.name || "").trim().toLowerCase() ===
                  previous.toLowerCase())
            ),
        ),
      );
      if (group === "delivery_entity") {
        setProjects((current) =>
          current.map((project) =>
            String(project.deliveryEntity || "").trim() === previous ||
            String(project.bpo || "").trim() === previous
              ? { ...project, deliveryEntity: "Internal", bpo: "Internal" }
              : project,
          ),
        );
        setTasks((current) =>
          current.map((task) =>
            String(task.deliveryEntity || "").trim() === previous ||
            String(task.bpo || "").trim() === previous
              ? { ...task, deliveryEntity: "Internal", bpo: "Internal" }
              : task,
          ),
        );
      }
      if (group === "client_entity") {
        setProjects((current) =>
          current.map((project) =>
            String(project.clientEntity || "").trim() === previous ||
            String(project.client || "").trim() === previous
              ? { ...project, clientEntity: "Internal", client: "Internal" }
              : project,
          ),
        );
        setTasks((current) =>
          current.map((task) =>
            String(task.clientEntity || "").trim() === previous ||
            String(task.client || "").trim() === previous
              ? { ...task, clientEntity: "Internal", client: "Internal" }
              : task,
          ),
        );
      }
      if (group === "tag") {
        const removedKeys = [previous, option.id || "", ...matchingCategoryIds]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        const cleanRecordTags = (record: any) => {
          const next = [
            ...new Set(
              [
                ...(Array.isArray(record.tagIds) ? record.tagIds : []),
                ...(Array.isArray(record.tags) ? record.tags : []),
                ...(Array.isArray(record.labels) ? record.labels : []),
              ]
                .map((value) => String(value || "").trim())
                .filter(
                  (value) =>
                    value &&
                    !removedKeys.some(
                      (removed) =>
                        removed.toLowerCase() === value.toLowerCase(),
                    ),
                ),
            ),
          ];
          return { ...record, tagIds: next, tags: next, labels: next };
        };
        setProjects((current) => current.map(cleanRecordTags));
        setTasks((current) => current.map(cleanRecordTags));
      }
      setNotice(
        group === "tag"
          ? `${previous} removed. Matching project/item tags were cleared.`
          : `${previous} removed. Matching projects/items were moved to Internal.`,
      );
    } catch (reason) {
      recordClientException("controlled_lists", "delete", reason, {
        group,
        previous,
        optionId: option.id || null,
      });
      setNotice(`Could not remove ${previous}. Open Exception trace in Settings for details.`);
    }
  };

  return { deleteControlledOption };
}
