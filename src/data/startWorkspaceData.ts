import {
  collection,
  onSnapshot,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  createCompleteSnapshotMerge,
  hasConfirmedSnapshotData,
} from "../lib/firestoreSnapshotSafety";
import { isFirestoreQuotaError } from "../lib/workspaceLoadError";
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
          console.error(`Firestore ${name} query ${index} failed`, error);
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
        console.error(`Firestore ${name} query failed`, error);
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
          [where("projectManager", "in", roleNames), where("workspaceId", "==", workspace.id)],
          [where("contact", "in", roleNames), where("workspaceId", "==", workspace.id)],
        ]
      : []),
  ];

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
            console.error("Workspace projects query failed; falling back to role queries", error);
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
          makeQuery("tasks", (items) => tasksStore.replaceAll(items as TaskDoc[])),
        ]
      : mergeQueries(
          "tasks",
          [
            [where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)],
            [where("createdBy", "==", user.uid), where("workspaceId", "==", workspace.id)],
            [where("visibleToUserIds", "array-contains", user.uid)],
            [where("visibleToEmails", "array-contains", emailLower)],
            [where("assigneeIds", "array-contains", memberId)],
            [where("accessMemberIds", "array-contains", memberId)],
            [where("sharedWithUserIds", "array-contains", user.uid)],
          ],
          (items) => tasksStore.replaceAll(items as TaskDoc[]),
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
  };
}

export function clearWorkspaceDataStores() {
  clearWorkspaceCollectionStores();
}
