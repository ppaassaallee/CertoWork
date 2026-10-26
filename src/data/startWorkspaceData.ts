import {
  collection,
  getDocs,
  onSnapshot,
  query,
  writeBatch,
  where,
  type Firestore,
  type QuerySnapshot,
} from "firebase/firestore";
import {
  createCompleteSnapshotMerge,
  hasConfirmedSnapshotData,
} from "../lib/firestoreSnapshotSafety";
import { isFirestorePermissionDenied, isFirestoreQuotaError, logFirestoreListenError } from "../lib/workspaceLoadError";
import {
  shouldTryWorkspacePortfolioQuery,
  projectAccessEmails,
  projectAccessLookupIds,
  projectAccessNameValues,
} from "../lib/accessControl";
import { selectHomeConversation } from "../lib/conversationScope";
import {
  clearWorkspaceCollectionStores,
  conversationsStore,
  membersStore,
  projectsStore,
  tasksStore,
  type ConversationDoc,
  type MemberDoc,
  type ProjectDoc,
  type TaskDoc,
} from "./collections";
import type { DocStore, DocRow } from "./createDocStore";

// The project page and My Work have separate subscriptions. Replacing My Work's
// snapshot must not erase project-visible rows that are only in the project feed.
let directRoleTasks: { workspaceId: string; rows: TaskDoc[] } | null = null;
let projectViewTasks: { workspaceId: string; projectId: string; rows: TaskDoc[] } | null = null;

function publishSharedTaskSources(workspaceId: string) {
  const merged = new Map<string, TaskDoc>();
  if (directRoleTasks?.workspaceId === workspaceId) {
    for (const row of directRoleTasks.rows) merged.set(row.id, row);
  }
  if (projectViewTasks?.workspaceId === workspaceId) {
    for (const row of projectViewTasks.rows) merged.set(row.id, row);
  }
  tasksStore.replaceAll([...merged.values()]);
}

/** Apply Firestore docChanges() into a Map-backed store (added/modified/removed). */
export function applyDocChanges<T extends DocRow>(
  store: DocStore<T>,
  snapshot: QuerySnapshot,
) {
  const changes = snapshot.docChanges();
  if (!changes.length) {
    // First snapshot often reports all as "added"; if empty changes, full replace.
    store.replaceAll(
      snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T),
    );
    return;
  }
  for (const change of changes) {
    if (change.type === "removed") {
      store.remove(change.doc.id);
      continue;
    }
    store.upsert({ id: change.doc.id, ...change.doc.data() } as T);
  }
}

export type WorkspaceDataActor = {
  uid: string;
  email?: string | null;
};

export type WorkspaceDataWorkspace = {
  id: string;
  ownerId?: string;
};

export type WorkspaceDataMember = MemberDoc & {
  id: string;
  alias?: string;
  displayName?: string;
  email?: string;
  emailLower?: string;
};

type StartArgs = {
  db: Firestore;
  user: WorkspaceDataActor;
  workspace: WorkspaceDataWorkspace;
  /** Current members snapshot used to build role queries (may be empty on first paint). */
  members: WorkspaceDataMember[];
  memberId: string;
  emailLower: string;
  onConversationId?: (updater: (current: string | null) => string | null) => void;
  onError?: (error: unknown) => void;
};

function timestamp(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  const stamp = value as { toMillis?: () => number; seconds?: number };
  if (typeof stamp.toMillis === "function") return stamp.toMillis();
  if (typeof stamp.seconds === "number") return stamp.seconds * 1000;
  return 0;
}

/**
 * Owns core Firestore listeners for projects / tasks / conversations / members.
 * Publishes into collection stores (signature-stable) so route components can
 * subscribe without the shell holding useState copies.
 */
export function startWorkspaceData(args: StartArgs): () => void {
  const {
    db,
    user,
    workspace,
    members,
    memberId,
    emailLower,
    onConversationId,
    onError,
  } = args;

  const report = (error: unknown) => {
    onError?.(error);
  };

  const currentMember = members.find((member) => {
    if (member.userId === user.uid) return true;
    const memberEmail = String(member.email || member.emailLower || "")
      .trim()
      .toLowerCase();
    return Boolean(emailLower && memberEmail && memberEmail === emailLower);
  });

  const canSeeWorkspacePortfolio = shouldTryWorkspacePortfolioQuery({
    isOwner: workspace.ownerId === user.uid,
    member: currentMember,
  });

  const roleLookupIds = projectAccessLookupIds({
    workspaceId: workspace.id,
    userId: user.uid,
    email: user.email,
    memberIds: [memberId, currentMember?.id],
  }).slice(0, 10);
  const roleEmails = projectAccessEmails(user.email);
  const roleNames = projectAccessNameValues({
    alias: currentMember?.alias,
    displayName: currentMember?.displayName,
    email: currentMember?.email || user.email,
    emailLower: currentMember?.emailLower || emailLower,
  }).slice(0, 10);

  const mergeQueries = (
    name: string,
    queryClauses: any[][],
    publish: (items: any[]) => void,
  ) => {
    const merge = createCompleteSnapshotMerge<any>(
      queryClauses.length,
      publish,
      (item) => item?.workspaceId === workspace.id,
    );
    return queryClauses.map((clauses, index) =>
      onSnapshot(
        query(collection(db, name), ...clauses),
        (snapshot) => {
          if (!hasConfirmedSnapshotData(snapshot)) return;
          merge.update(
            index,
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
          );
        },
          (error) => {
          logFirestoreListenError(`${name} ${index}`, error);
          merge.fail(index);
          report(error);
        },
      ),
    );
  };

  const makeQuery = (
    name: string,
    publish: (items: any[]) => void,
    activeOnly = false,
    personal = false,
  ) => {
    const clauses: any[] = personal
      ? [
          where("userId", "==", user.uid),
          where("workspaceId", "==", workspace.id),
        ]
      : [where("workspaceId", "==", workspace.id)];
    if (activeOnly) clauses.push(where("status", "==", "active"));
    return onSnapshot(
      query(collection(db, name), ...clauses),
      (snapshot) => {
        if (!hasConfirmedSnapshotData(snapshot)) return;
        publish(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => {
        logFirestoreListenError(name, error);
        report(error);
      },
    );
  };

  const projectRoleClauses = [
    [where("userId", "==", user.uid)],
    [where("visibleToUserIds", "array-contains", user.uid)],
    ...roleEmails.map((email) => [where("visibleToEmails", "array-contains", email)]),
    ...(roleLookupIds.length
      ? [
          [where("teamMemberIds", "array-contains-any", roleLookupIds)],
          [where("sponsorIds", "array-contains-any", roleLookupIds)],
          [where("projectManagerId", "in", roleLookupIds)],
          [where("productOwnerId", "in", roleLookupIds)],
        ]
      : []),
    ...(roleNames.length
      ? [
          [where("projectManager", "in", roleNames)],
          [where("contact", "in", roleNames)],
        ]
      : []),
  ].map((clauses) => [...clauses, where("workspaceId", "==", workspace.id)]);

  let cancelled = false;
  const extraUnsubscribers: Array<() => void> = [];
  const startRoleProjectQueries = () => {
    if (cancelled) return;
    extraUnsubscribers.push(
      ...mergeQueries("projects", projectRoleClauses, (items) =>
        projectsStore.replaceAll(items as ProjectDoc[]),
      ),
    );
  };

  const projectUnsubscribers = canSeeWorkspacePortfolio
    ? [
        onSnapshot(
          query(collection(db, "projects"), where("workspaceId", "==", workspace.id)),
          (snapshot) => {
            if (!hasConfirmedSnapshotData(snapshot)) return;
            projectsStore.replaceAll(
              snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ProjectDoc),
            );
          },
          (error) => {
            if (!isFirestorePermissionDenied(error)) {
              console.error("Workspace projects query failed; falling back to role queries", error);
            }
            report(error);
            if (!isFirestoreQuotaError(error)) startRoleProjectQueries();
          },
        ),
      ]
    : mergeQueries("projects", projectRoleClauses, (items) =>
        projectsStore.replaceAll(items as ProjectDoc[]),
      );

  const taskUnsubscribers =
    workspace.ownerId === user.uid
      ? [
          // Open tasks only for owners — closed tasks load per project via subscribeProjectTasks.
          onSnapshot(
            query(
              collection(db, "tasks"),
              where("workspaceId", "==", workspace.id),
              where("status", "in", [
                "backlog",
                "ready",
                "todo",
                "in_progress",
                "in_review",
                "blocked",
                "review",
                "new",
                "open",
                "waiting",
                "active",
                "planned",
                "doing",
                "not_started",
              ]),
            ),
            (snapshot) => {
              if (!hasConfirmedSnapshotData(snapshot)) return;
              applyDocChanges(tasksStore, snapshot);
            },
            (error) => {
              // Fallback: full workspace tasks if composite index missing.
              if (!isFirestorePermissionDenied(error)) {
                console.warn("Open-tasks query failed; falling back to full tasks", error);
              }
              report(error);
              extraUnsubscribers.push(
                makeQuery("tasks", (items) => tasksStore.replaceAll(items as TaskDoc[])),
              );
            },
          ),
        ]
      : mergeQueries(
          "tasks",
          [
            [where("userId", "==", user.uid)],
            [where("createdBy", "==", user.uid)],
            [where("visibleToUserIds", "array-contains", user.uid)],
            [where("visibleToEmails", "array-contains", emailLower)],
            [where("assigneeIds", "array-contains", memberId)],
            [where("collaboratorMemberIds", "array-contains", memberId)],
            [where("followerIds", "array-contains", memberId)],
            [where("accessMemberIds", "array-contains", memberId)],
            [where("sharedWithUserIds", "array-contains", user.uid)],
            ...roleNames.slice(0, 4).flatMap((name) => [
              [where("assignees", "array-contains", name)],
              [where("owner", "==", name)],
            ]),
          ].map((clauses) => [...clauses, where("workspaceId", "==", workspace.id)]),
          (items) => {
            directRoleTasks = { workspaceId: workspace.id, rows: items as TaskDoc[] };
            publishSharedTaskSources(workspace.id);
          },
        );

  const unsubscribers: Array<() => void> = [
    makeQuery(
      "boldi_conversations",
      (items) => {
        const sorted = (items as ConversationDoc[]).slice().sort(
          (left, right) =>
            timestamp(right.updatedAt || right.createdAt) -
            timestamp(left.updatedAt || left.createdAt),
        );
        conversationsStore.replaceAll(sorted);
        onConversationId?.((current) => {
          if (current) return current;
          return selectHomeConversation(sorted)?.id || null;
        });
      },
      true,
      true,
    ),
    ...projectUnsubscribers,
    ...taskUnsubscribers,
    onSnapshot(
      query(collection(db, "workspace_members"), where("workspaceId", "==", workspace.id)),
      (snapshot) => {
        if (!hasConfirmedSnapshotData(snapshot)) return;
        membersStore.replaceAll(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as MemberDoc,
          ),
        );
      },
      report,
    ),
  ];

  return () => {
    cancelled = true;
    for (const stop of [...unsubscribers, ...extraUnsubscribers]) stop();
    if (directRoleTasks?.workspaceId === workspace.id) directRoleTasks = null;
  };
}

export function clearWorkspaceDataStores() {
  directRoleTasks = null;
  projectViewTasks = null;
  clearWorkspaceCollectionStores();
}

/** Subscribe to all project tasks for the owner, or project-visible tasks for a teammate.
 * A teammate's private assigned items arrive through direct access queries.
 * Querying all project items for a teammate is rejected when any private item exists.
 */
export function subscribeProjectTasks(
  db: Firestore,
  workspaceId: string,
  projectId: string,
  isWorkspaceOwner: boolean,
  onError?: (error: unknown) => void,
): () => void {
  let cancelled = false;
  let explicitProjectRows: TaskDoc[] = [];
  let legacyProjectRows: TaskDoc[] = [];
  const visibilityBackfillInFlight = new Set<string>();
  const visibilityMigrationKey = `certo:project-task-visibility:v1:${workspaceId}:${projectId}`;

  const publishProjectRows = () => {
    if (cancelled || isWorkspaceOwner) return;
    const merged = new Map<string, TaskDoc>();
    for (const row of [...legacyProjectRows, ...explicitProjectRows]) merged.set(row.id, row);
    projectViewTasks = { workspaceId, projectId, rows: [...merged.values()] };
    publishSharedTaskSources(workspaceId);
  };

  const normalizeLegacyVisibility = async (snapshot: QuerySnapshot) => {
    if (cancelled) return false;
    let succeeded = true;
    const legacy = snapshot.docs.filter(
      (item) => !("visibility" in item.data()) && !visibilityBackfillInFlight.has(item.id),
    );
    for (let offset = 0; offset < legacy.length; offset += 400) {
      const chunk = legacy.slice(offset, offset + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        visibilityBackfillInFlight.add(item.id);
        batch.update(item.ref, { visibility: "project" });
      }
      try {
        await batch.commit();
      } catch (error) {
        succeeded = false;
        for (const item of chunk) visibilityBackfillInFlight.delete(item.id);
        onError?.(error);
      }
    }
    return succeeded;
  };

  const baseProjectQuery = query(
    collection(db, "tasks"),
    where("workspaceId", "==", workspaceId),
    where("projectId", "==", projectId),
  );

  const stop = onSnapshot(
    isWorkspaceOwner
      ? baseProjectQuery
      : query(
          collection(db, "tasks"),
          where("workspaceId", "==", workspaceId),
          where("projectId", "==", projectId),
          where("visibility", "==", "project"),
        ),
    (snapshot) => {
      if (!hasConfirmedSnapshotData(snapshot)) return;
      if (!isWorkspaceOwner) {
        explicitProjectRows = snapshot.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as TaskDoc,
        );
        publishProjectRows();
        return;
      }
      void normalizeLegacyVisibility(snapshot);
      for (const change of snapshot.docChanges()) {
        if (change.type === "removed") {
          // Only remove if it still belongs to this project in the store.
          const existing = tasksStore.getMap().get(change.doc.id);
          if (existing && String(existing.projectId) === projectId) {
            tasksStore.remove(change.doc.id);
          }
          continue;
        }
        tasksStore.upsert({
          id: change.doc.id,
          ...change.doc.data(),
        } as TaskDoc);
      }
    },
    (error) => onError?.(error),
  );

  // Older project items predate the visibility field. The rules treat those as
  // project-visible, so a one-shot read makes them available immediately when
  // the project contains no inaccessible private item. If a private item makes
  // Firestore reject the broad query, the explicit project feed remains active;
  // an owner visit safely normalizes only the legacy rows above.
  const visibilityAlreadyNormalized = typeof window !== "undefined"
    && window.localStorage.getItem(visibilityMigrationKey) === "done";
  if (!isWorkspaceOwner && !visibilityAlreadyNormalized) {
    void getDocs(baseProjectQuery)
      .then(async (snapshot) => {
        if (cancelled || !hasConfirmedSnapshotData(snapshot)) return;
        legacyProjectRows = snapshot.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as TaskDoc,
        );
        publishProjectRows();
        const normalized = await normalizeLegacyVisibility(snapshot);
        if (normalized && !cancelled && typeof window !== "undefined") {
          window.localStorage.setItem(visibilityMigrationKey, "done");
        }
      })
      .catch((error) => {
        if (!isFirestorePermissionDenied(error)) onError?.(error);
      });
  }

  return () => {
    cancelled = true;
    stop();
    if (projectViewTasks?.workspaceId === workspaceId && projectViewTasks.projectId === projectId) {
      projectViewTasks = null;
      if (!isWorkspaceOwner) publishSharedTaskSources(workspaceId);
    }
  };
}

