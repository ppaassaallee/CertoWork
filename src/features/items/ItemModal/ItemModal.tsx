import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Bookmark,
  Bug,
  CheckSquare,
  ChevronDown,
  Copy,
  CornerDownRight,
  Flag,
  Gem,
  Inbox,
  Layers,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Sparkles,
  Target,
  Users,
  X,
} from "../../../components/ui/Icon";
import { DestructiveDialog } from "../../../components/ui/DestructiveDialog";
import { CompactTagPicker } from "../../../components/CompactTagPicker";
import { MultiAssigneePicker } from "../../../components/ProjectControls";
import { ControlledSelect } from "../../../components/ControlledSelect";
import { RoutineLaunchButton } from "../../../components/routines/RoutineHost";
import { dueDateTimingPatch } from "../../../lib/itemTiming";
import {
  checklistCaption,
  checklistItems,
  checklistProgress,
  newChecklistItem,
  appendStatusHistory,
  type KanbanComment,
} from "../../../lib/kanbanFeatures";
import { workCategory, productPhase, WORK_CATEGORIES, PRODUCT_PHASES } from "../../../lib/workClassification";
import { getLocale } from "../../../lib/i18n";
import { copy, priorityLabel, statusLabel, typeLabel } from "./labels";
import "./ItemModal.css";

export type WorkItemKind =
  | "epic"
  | "feature"
  | "pbi"
  | "story"
  | "bug"
  | "task"
  | "subtask"
  | "ticket"
  | "issue";

type Member = {
  id: string;
  displayName?: string;
  email?: string;
  emailLower?: string;
  status?: string;
  userId?: string;
  publicAlias?: string;
};

type SprintRecord = { id: string; name?: string; projectId?: string };

export type ItemModalProps = {
  item: any;
  projects: any[];
  tasks: any[];
  tags: any[];
  workspaceMembers: Member[];
  sprints: SprintRecord[];
  layout?: "panel" | "expanded";
  onLayoutChange?: (layout: "panel" | "expanded") => void;
  onClose: () => void;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onChangeType: (kind: WorkItemKind) => void;
  onArchive: () => void | Promise<void>;
  onAskOdysseus?: () => void;
  onOpenCollab?: () => void;
  onOpenProjectConsole?: () => void;
  onCreateControlledOption?: (
    group: "delivery_entity" | "client_entity" | "tag",
    name: string,
  ) => Promise<string | void> | string | void;
  onInviteAssigneeEmail?: (email: string) => Promise<void> | void;
  parentEditor: ReactNode;
  /** Optional: block WIP transitions; return true to reject */
  rejectStatusMove?: (item: any, nextStatus: string) => boolean;
  onStatusChanged?: (item: any, nextStatus: string) => void;
  itemKey?: string;
  parentBreadcrumb?: Array<{ id: string; title: string; kind: string }>;
  onOpenParent?: (id: string) => void;
  actionBoardBucketLabel?: string;
  deliveryEntityOptions?: string[];
  clientEntityOptions?: string[];
  deliveryEntityValue?: string;
  clientEntityValue?: string;
  subtaskItems?: any[];
  onAddSubtask?: (title: string) => void;
  onToggleSubtask?: (id: string, done: boolean) => void;
  deleteImpact?: string[];
};

const WORK_TYPES: WorkItemKind[] = [
  "epic",
  "feature",
  "pbi",
  "story",
  "bug",
  "task",
  "subtask",
  "ticket",
  "issue",
];
const WORK_STATUSES = [
  "backlog",
  "ready",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];
const PRIORITIES = ["1", "2", "3", "N/A"];
const GTD_TYPES = [
  { value: "", label: "—" },
  { value: "next_action", label: "Next action" },
  { value: "waiting_for", label: "Waiting for" },
  { value: "someday", label: "Someday" },
  { value: "reference", label: "Reference" },
  { value: "decision", label: "Decision" },
  { value: "delegated", label: "Delegated" },
  { value: "follow_up", label: "Follow-up" },
];

const TYPE_ICONS: Record<WorkItemKind, typeof Gem> = {
  epic: Gem,
  feature: Layers,
  story: Bookmark,
  pbi: Target,
  task: CheckSquare,
  bug: Bug,
  subtask: CornerDownRight,
  ticket: Inbox,
  issue: AlertCircle,
};

function itemTitle(item: any) {
  return String(item?.title || item?.name || "Untitled");
}

function workItemKind(item: any): WorkItemKind {
  const structuralValue = String(
    item?.workItemType || item?.taskType || item?.issueType || item?.kind || item?.type || "",
  ).toLowerCase();
  const legacyItemType = String(item?.itemType || "").toLowerCase();
  const value =
    structuralValue ||
    (WORK_TYPES.includes(legacyItemType as WorkItemKind) ? legacyItemType : "");
  if (value.includes("epic")) return "epic";
  if (value.includes("feature")) return "feature";
  if (value.includes("subtask") || value.includes("sub_task")) return "subtask";
  if (value.includes("ticket")) return "ticket";
  if (value === "issue" || value.includes("issue")) return "issue";
  if (value.includes("story")) return "story";
  if (value.includes("bug")) return "bug";
  if (value === "task" || value.includes("project_task")) return "task";
  return "pbi";
}

function priorityValue(value: any) {
  const normalized = String(value || "").toUpperCase();
  if (["1", "P1", "HIGH", "URGENT", "CRITICAL"].includes(normalized)) return "1";
  if (["2", "P2", "MEDIUM"].includes(normalized)) return "2";
  if (["3", "P3", "LOW"].includes(normalized)) return "3";
  if (["4", "P4"].includes(normalized)) return "4";
  return "N/A";
}

function canonicalStatus(item: any) {
  const status = String(item?.status || "").toLowerCase();
  if (WORK_STATUSES.includes(status)) return status;
  return "backlog";
}

function dateInputValue(value: any) {
  if (!value) return "";
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  } catch {
    return String(value).slice(0, 10);
  }
}

function relativeDateLabel(value: any, locale: "en" | "es") {
  if (!value) return locale === "es" ? "Sin fecha" : "No date";
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return locale === "es" ? "Sin fecha" : "No date";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return locale === "es" ? "Hoy" : "Today";
    if (diff === 1) return locale === "es" ? "Mañana" : "Tomorrow";
    if (diff === -1) return locale === "es" ? "Ayer" : "Yesterday";
    if (diff > 1 && diff < 7) return locale === "es" ? "Esta semana" : "This week";
    if (diff < 0) return locale === "es" ? "Atrasado" : "Overdue";
    return date.toLocaleDateString(locale === "es" ? "es" : "en", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return locale === "es" ? "Sin fecha" : "No date";
  }
}

function memberName(member: Member) {
  return (
    member.publicAlias ||
    member.displayName ||
    member.email ||
    member.emailLower ||
    "Member"
  );
}

function gtdActionValue(item: any) {
  return String(item?.gtdActionType || item?.actionType || item?.globalStageId || "");
}

function gtdActionPatch(value: string) {
  return {
    actionType: value || null,
    gtdActionType: value || null,
    globalStageId: value || null,
  };
}

function activityEntries(item: any) {
  const comments = Array.isArray(item?.comments) ? item.comments : [];
  const history = Array.isArray(item?.statusHistory) ? item.statusHistory : [];
  const rows: Array<{ id: string; text: string; at: string; author: string }> = [];
  for (const entry of history.slice(-5)) {
    rows.push({
      id: `hist-${entry.at || entry.status}-${rows.length}`,
      text: `${entry.from || "—"} → ${entry.to || entry.status || "—"}`,
      at: String(entry.at || ""),
      author: String(entry.by || "System"),
    });
  }
  for (const entry of comments.slice(-5)) {
    rows.push({
      id: String(entry.id || `c-${rows.length}`),
      text: String(entry.text || ""),
      at: String(entry.at || ""),
      author: String(entry.author || "Teammate"),
    });
  }
  return rows
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 5);
}

function isInherited(
  itemValue: string | null | undefined,
  projectValue: string | null | undefined,
) {
  if (!itemValue) return Boolean(projectValue);
  if (!projectValue) return false;
  return String(itemValue).toLowerCase() === String(projectValue).toLowerCase();
}

export function ItemModal({
  item,
  projects,
  tags,
  workspaceMembers,
  sprints,
  layout: layoutProp,
  onLayoutChange,
  onClose,
  onUpdateTask,
  onChangeType,
  onArchive,
  onAskOdysseus,
  onOpenCollab,
  onCreateControlledOption,
  onInviteAssigneeEmail,
  parentEditor,
  rejectStatusMove,
  onStatusChanged,
  itemKey,
  parentBreadcrumb = [],
  onOpenParent,
  actionBoardBucketLabel,
  deliveryEntityOptions = ["Internal"],
  clientEntityOptions = ["Internal"],
  deliveryEntityValue,
  clientEntityValue,
  subtaskItems = [],
  onAddSubtask,
  onToggleSubtask,
  deleteImpact,
}: ItemModalProps) {
  const locale = getLocale();
  const [layout, setLayout] = useState<"panel" | "expanded">(layoutProp || "expanded");
  const [titleDraft, setTitleDraft] = useState(itemTitle(item));
  const [bodyDraft, setBodyDraft] = useState(
    String(item.description || item.definitionOfDone || ""),
  );
  const [bodyFocused, setBodyFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const kind = workItemKind(item);
  const TypeIcon = TYPE_ICONS[kind] || Target;
  const project = projects.find((entry) => entry.id === item.projectId) || null;
  const projectSprints = sprints.filter(
    (sprint) => !sprint.projectId || sprint.projectId === item.projectId,
  );
  const checklist = checklistItems(item);
  const progress = checklistProgress(checklist);
  const comments = Array.isArray(item.comments) ? item.comments : [];
  const keyLabel = itemKey || item.projectKey || item.key || item.id?.slice(0, 8) || "—";

  const deliveryDisplay =
    deliveryEntityValue ||
    item.deliveryEntity ||
    item.bpo ||
    project?.deliveryEntity ||
    project?.bpo ||
    "Internal";
  const clientDisplay =
    clientEntityValue ||
    item.clientEntity ||
    item.client ||
    project?.clientEntity ||
    project?.client ||
    "Internal";
  const categoryDisplay = workCategory(item, project);
  const phaseDisplay = productPhase(item, project);
  const deliveryInherited = isInherited(
    item.deliveryEntity || item.bpo,
    project?.deliveryEntity || project?.bpo,
  );
  const clientInherited = isInherited(
    item.clientEntity || item.client,
    project?.clientEntity || project?.client,
  );
  const categoryInherited = isInherited(item.workCategory, project?.workCategory);
  const phaseInherited = isInherited(
    item.productPhase || item.phase,
    project?.productPhase || project?.phase,
  );

  const classificationSummary = [
    deliveryDisplay,
    clientDisplay,
    categoryDisplay,
    phaseDisplay,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    setTitleDraft(itemTitle(item));
    setBodyDraft(String(item.description || item.definitionOfDone || ""));
  }, [item.id, item.title, item.description, item.definitionOfDone]);

  useEffect(() => {
    if (layoutProp) setLayout(layoutProp);
  }, [layoutProp]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (deleteOpen) {
          setDeleteOpen(false);
          return;
        }
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [deleteOpen, menuOpen, onClose]);

  const setLayoutSafe = (next: "panel" | "expanded") => {
    setLayout(next);
    onLayoutChange?.(next);
  };

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!next || next === itemTitle(item)) {
      setTitleDraft(itemTitle(item));
      return;
    }
    void onUpdateTask(item.id, { title: next });
  };

  const commitBody = () => {
    const current = String(item.description || item.definitionOfDone || "");
    if (bodyDraft === current) return;
    void onUpdateTask(item.id, { description: bodyDraft });
  };

  const updateStatus = (nextStatus: string) => {
    if (rejectStatusMove?.(item, nextStatus)) return;
    void onUpdateTask(item.id, {
      status: nextStatus,
      statusHistory: appendStatusHistory(item, nextStatus, nextStatus),
      completedAt:
        nextStatus === "done" ? item.completedAt || new Date().toISOString() : null,
    });
    onStatusChanged?.(item, nextStatus);
  };

  const assigneeName = useMemo(() => {
    const names = Array.isArray(item.assignees)
      ? item.assignees
      : [item.owner || item.assignee].filter(Boolean);
    return String(names[0] || "");
  }, [item]);

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?item=${item.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    setMenuOpen(false);
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(String(keyLabel));
    } catch {
      /* ignore */
    }
  };

  const doneSubtasks = subtaskItems.filter((entry) =>
    ["done", "completed", "closed"].includes(String(entry.status || "").toLowerCase()),
  ).length;

  return (
    <div
      className={`cw-item-modal-backdrop ${layout === "panel" ? "is-panel" : "is-expanded"}`}
      data-testid="item-modal-v2"
      onClick={onClose}
    >
      <aside
        aria-label={`${typeLabel(kind, locale)} detail`}
        className={`cw-item-modal ${layout === "panel" ? "is-panel" : "is-expanded"}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="cw-item-modal-bar">
          <div className="cw-item-modal-bar-left">
            <label className="cw-item-type-chip">
              <TypeIcon size={14} />
              <select
                aria-label="Item type"
                data-testid="item-assign-type"
                onChange={(event) => onChangeType(event.target.value as WorkItemKind)}
                value={kind}
              >
                {WORK_TYPES.map((entry) => (
                  <option key={entry} value={entry}>
                    {typeLabel(entry, locale)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="cw-item-key"
              onClick={() => void copyKey()}
              title="Copy key"
              type="button"
            >
              {keyLabel}
            </button>
            {parentBreadcrumb.length > 0 && (
              <nav className="cw-item-breadcrumb" aria-label="Parent">
                {parentBreadcrumb.map((crumb, index) => (
                  <Fragment key={crumb.id}>
                    {index > 0 && <span aria-hidden="true">›</span>}
                    <button onClick={() => onOpenParent?.(crumb.id)} type="button">
                      {crumb.title}
                    </button>
                  </Fragment>
                ))}
              </nav>
            )}
          </div>
          <div className="cw-item-modal-bar-right">
            <button
              aria-label="Odysseus"
              className="cw-item-icon-btn"
              onClick={onAskOdysseus}
              title="Odysseus"
              type="button"
            >
              <Sparkles size={15} />
            </button>
            {onOpenCollab && (
              <button
                aria-label={copy("openCollab", locale)}
                className="cw-item-icon-btn"
                onClick={onOpenCollab}
                title={copy("openCollab", locale)}
                type="button"
              >
                <Users size={15} />
              </button>
            )}
            <button
              aria-label={layout === "expanded" ? copy("collapse", locale) : copy("expand", locale)}
              className="cw-item-icon-btn"
              onClick={() => setLayoutSafe(layout === "expanded" ? "panel" : "expanded")}
              type="button"
            >
              {layout === "expanded" ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <div className="cw-item-more">
              <button
                aria-label={copy("more", locale)}
                className="cw-item-icon-btn"
                onClick={() => setMenuOpen((open) => !open)}
                type="button"
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div className="cw-item-more-menu" role="menu">
                  <button onClick={copyLink} type="button">
                    <Copy size={13} /> {copy("copyLink", locale)}
                  </button>
                  <button
                    className="is-danger"
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteOpen(true);
                    }}
                    type="button"
                  >
                    {copy("deleteItem", locale)}
                  </button>
                </div>
              )}
            </div>
            <button
              aria-label="Close"
              className="cw-item-icon-btn"
              onClick={onClose}
              type="button"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="cw-item-modal-body">
          <div className="cw-item-content">
            <input
              aria-label="Selected item title"
              className="cw-item-title"
              onBlur={commitTitle}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  (event.target as HTMLInputElement).blur();
                }
                if (event.key === "Escape") {
                  setTitleDraft(itemTitle(item));
                  (event.target as HTMLInputElement).blur();
                }
              }}
              ref={titleRef}
              value={titleDraft}
            />

            <div className="cw-item-quick-chips">
              <button
                className={`cw-item-chip is-status is-${canonicalStatus(item)}`}
                onClick={() =>
                  setActivePicker(activePicker === "status" ? null : "status")
                }
                type="button"
              >
                {statusLabel(canonicalStatus(item), locale)}
              </button>
              <button
                className="cw-item-chip is-priority"
                onClick={() =>
                  setActivePicker(activePicker === "priority" ? null : "priority")
                }
                type="button"
              >
                <Flag size={12} />
                {priorityLabel(priorityValue(item.priority), locale)}
              </button>
              <button
                className="cw-item-chip"
                onClick={() =>
                  setActivePicker(activePicker === "assignee" ? null : "assignee")
                }
                type="button"
              >
                <span className="cw-item-avatar">
                  {(assigneeName || "?").slice(0, 1).toUpperCase()}
                </span>
                {assigneeName || copy("undefined", locale)}
              </button>
              <button
                className="cw-item-chip"
                onClick={() => setActivePicker(activePicker === "dates" ? null : "dates")}
                type="button"
              >
                {relativeDateLabel(item.dueDate || item.targetDate, locale)}
              </button>
            </div>

            {activePicker === "status" && (
              <div className="cw-item-inline-picker">
                <select
                  aria-label={copy("status", locale)}
                  onChange={(event) => {
                    updateStatus(event.target.value);
                    setActivePicker(null);
                  }}
                  value={canonicalStatus(item)}
                >
                  {WORK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activePicker === "priority" && (
              <div className="cw-item-inline-picker">
                <select
                  aria-label={copy("priority", locale)}
                  onChange={(event) => {
                    void onUpdateTask(item.id, {
                      priority: event.target.value === "N/A" ? null : event.target.value,
                    });
                    setActivePicker(null);
                  }}
                  value={priorityValue(item.priority)}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabel(priority, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div
              className={`cw-item-body-wrap ${bodyFocused ? "is-focused" : ""}`}
            >
              <textarea
                aria-label="Selected item description"
                className="cw-item-body"
                onBlur={() => {
                  setBodyFocused(false);
                  commitBody();
                }}
                onChange={(event) => setBodyDraft(event.target.value)}
                onFocus={() => setBodyFocused(true)}
                placeholder={copy("bodyPlaceholder", locale)}
                value={bodyDraft}
              />
              {bodyFocused && (
                <button
                  className="cw-item-structure"
                  onClick={() => {
                    const result = compileItemSentence({
                      title: titleDraft || itemTitle(item),
                      body: bodyDraft,
                    });
                    setTitleDraft(result.title);
                    setBodyDraft(result.description);
                    void onUpdateTask(item.id, {
                      title: result.title,
                      description: result.description,
                      acceptanceCriteria:
                        result.blocks.find((block) => block.type === "criterios_aceptacion")
                          ?.text || item.acceptanceCriteria || "",
                    });
                  }}
                  title={copy("structure", locale)}
                  type="button"
                >
                  <Sparkles size={13} /> {copy("structure", locale)}
                </button>
              )}
            </div>

            <section className="cw-item-card" data-testid="item-checklist">
              <header>
                <strong>
                  {copy("subtasks", locale)}{" "}
                  {subtaskItems.length > 0
                    ? `${doneSubtasks}/${subtaskItems.length}`
                    : checklist.length > 0
                      ? checklistCaption(checklist)
                      : ""}
                </strong>
                {checklist.length > 0 && (
                  <span className="cw-item-progress">
                    <i style={{ width: `${progress.percent}%` }} />
                  </span>
                )}
              </header>
              {subtaskItems.map((entry) => (
                <label className="cw-item-check-row" key={entry.id}>
                  <input
                    checked={["done", "completed", "closed"].includes(
                      String(entry.status || "").toLowerCase(),
                    )}
                    onChange={(event) =>
                      onToggleSubtask?.(entry.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>{itemTitle(entry)}</span>
                </label>
              ))}
              {checklist.map((entry) => (
                <label className="cw-item-check-row" key={entry.id}>
                  <input
                    checked={entry.done}
                    onChange={() =>
                      onUpdateTask(item.id, {
                        checklist: checklist.map((candidate) =>
                          candidate.id === entry.id
                            ? { ...candidate, done: !candidate.done }
                            : candidate,
                        ),
                      })
                    }
                    type="checkbox"
                  />
                  <span className={entry.done ? "is-done" : ""}>{entry.text}</span>
                </label>
              ))}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (onAddSubtask && subtaskDraft.trim()) {
                    onAddSubtask(subtaskDraft.trim());
                    setSubtaskDraft("");
                    return;
                  }
                  const text = checklistDraft.trim();
                  if (!text) return;
                  void onUpdateTask(item.id, {
                    checklist: [...checklist, newChecklistItem(text, checklist)],
                  });
                  setChecklistDraft("");
                }}
              >
                <input
                  aria-label="Add checklist item"
                  onChange={(event) => {
                    setChecklistDraft(event.target.value);
                    setSubtaskDraft(event.target.value);
                  }}
                  placeholder="+"
                  value={onAddSubtask ? subtaskDraft : checklistDraft}
                />
              </form>
            </section>

            <section className="cw-item-card" data-testid="item-comments">
              <header>
                <strong>
                  {copy("comments", locale)} {comments.length || ""}
                </strong>
                {onOpenCollab && (
                  <button onClick={onOpenCollab} type="button">
                    {copy("openCollab", locale)}
                  </button>
                )}
              </header>
              {comments.slice(-8).map((entry: KanbanComment) => (
                <article key={entry.id}>
                  <span>
                    {entry.author || "Teammate"} ·{" "}
                    {relativeDateLabel(entry.at, locale)}
                  </span>
                  <p>{entry.text}</p>
                </article>
              ))}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = commentDraft.trim();
                  if (!text) return;
                  const author = workspaceMembers.find(
                    (member) => member.userId === member.id,
                  );
                  const next: KanbanComment = {
                    id: `comment-${Date.now()}`,
                    at: new Date().toISOString(),
                    author: author ? memberName(author) : "Me",
                    text,
                  };
                  void onUpdateTask(item.id, {
                    comments: [...comments, next],
                  });
                  setCommentDraft("");
                }}
              >
                <input
                  aria-label="Add a comment"
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder={copy("commentPlaceholder", locale)}
                  value={commentDraft}
                />
              </form>
            </section>
          </div>

          <aside className="cw-item-props">
            <section className="cw-item-prop-group is-open">
              <h3>{copy("properties", locale)}</h3>
              <PropRow label={copy("status", locale)}>
                <select
                  onChange={(event) => updateStatus(event.target.value)}
                  value={canonicalStatus(item)}
                >
                  {WORK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status, locale)}
                    </option>
                  ))}
                </select>
              </PropRow>
              <PropRow label={copy("priority", locale)}>
                <select
                  onChange={(event) =>
                    onUpdateTask(item.id, {
                      priority:
                        event.target.value === "N/A" ? null : event.target.value,
                    })
                  }
                  value={priorityValue(item.priority)}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabel(priority, locale)}
                    </option>
                  ))}
                </select>
              </PropRow>
              <PropRow label={copy("assignee", locale)}>
                <MultiAssigneePicker
                  helperText=""
                  label={copy("assignee", locale)}
                  maxSelections={1}
                  members={workspaceMembers}
                  onInviteEmail={onInviteAssigneeEmail}
                  onChange={(assigneeIds, assignees) =>
                    onUpdateTask(item.id, {
                      assigneeIds,
                      assignees,
                      owner: assignees[0] || "",
                      assignee: assignees[0] || "",
                      assigneeId: assigneeIds[0] || "",
                    })
                  }
                  selectedIds={
                    Array.isArray(item.assigneeIds) ? item.assigneeIds.slice(0, 1) : []
                  }
                  selectedNames={
                    Array.isArray(item.assignees)
                      ? item.assignees.slice(0, 1)
                      : [item.owner || item.assignee].filter(Boolean).slice(0, 1)
                  }
                />
              </PropRow>
              <PropRow label={copy("dates", locale)}>
                <div className="cw-item-date-range">
                  <input
                    aria-label="Start date"
                    defaultValue={dateInputValue(item.startDate)}
                    onBlur={(event) =>
                      onUpdateTask(item.id, {
                        startDate: event.target.value || null,
                      })
                    }
                    type="date"
                  />
                  <span>→</span>
                  <input
                    aria-label="Due date"
                    defaultValue={dateInputValue(item.dueDate || item.targetDate)}
                    onBlur={(event) =>
                      onUpdateTask(
                        item.id,
                        dueDateTimingPatch(event.target.value || null),
                      )
                    }
                    type="date"
                  />
                </div>
              </PropRow>
              <PropRow label={copy("sprint", locale)}>
                <select
                  onChange={(event) =>
                    onUpdateTask(item.id, {
                      sprintId: event.target.value || null,
                    })
                  }
                  value={item.sprintId || ""}
                >
                  <option value="">{copy("noSprint", locale)}</option>
                  {projectSprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name || "Sprint"}
                    </option>
                  ))}
                </select>
              </PropRow>
              <PropRow label={copy("estimate", locale)}>
                <input
                  aria-label="Estimate hours"
                  defaultValue={item.estimateHours ?? ""}
                  inputMode="decimal"
                  onBlur={(event) =>
                    onUpdateTask(item.id, {
                      estimateHours: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  type="number"
                />
              </PropRow>
              <PropRow label={copy("tags", locale)}>
                <CompactTagPicker
                  label={copy("tags", locale)}
                  onCreateTag={(name) => onCreateControlledOption?.("tag", name)}
                  onChange={(patch) => onUpdateTask(item.id, patch)}
                  record={item}
                  tags={tags}
                />
              </PropRow>
              <PropRow label={copy("parent", locale)}>
                <div className="cw-item-parent">{parentEditor}</div>
              </PropRow>
            </section>

            <CollapsibleGroup
              open={classificationOpen}
              onToggle={() => setClassificationOpen((open) => !open)}
              summary={classificationSummary}
              title={copy("classification", locale)}
              hint={copy("inheritedFromProject", locale)}
            >
              <PropRow label={copy("delivery", locale)} inherited={deliveryInherited}>
                <ControlledSelect
                  ariaLabel={copy("delivery", locale)}
                  onAddOption={(name) =>
                    onCreateControlledOption?.("delivery_entity", name)
                  }
                  onChange={(next) =>
                    onUpdateTask(item.id, {
                      deliveryEntity: next || "Internal",
                      bpo: next || "Internal",
                    })
                  }
                  options={deliveryEntityOptions}
                  value={deliveryDisplay}
                />
              </PropRow>
              <PropRow label={copy("client", locale)} inherited={clientInherited}>
                <ControlledSelect
                  ariaLabel={copy("client", locale)}
                  onAddOption={(name) =>
                    onCreateControlledOption?.("client_entity", name)
                  }
                  onChange={(next) =>
                    onUpdateTask(item.id, {
                      clientEntity: next || "Internal",
                      client: next || "Internal",
                    })
                  }
                  options={clientEntityOptions}
                  value={clientDisplay}
                />
              </PropRow>
              <PropRow label={copy("category", locale)} inherited={categoryInherited}>
                <select
                  onChange={(event) =>
                    onUpdateTask(item.id, { workCategory: event.target.value })
                  }
                  value={categoryDisplay}
                >
                  {WORK_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </PropRow>
              <PropRow label={copy("phase", locale)} inherited={phaseInherited}>
                <select
                  onChange={(event) =>
                    onUpdateTask(item.id, { productPhase: event.target.value })
                  }
                  value={phaseDisplay}
                >
                  {PRODUCT_PHASES.map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </PropRow>
              <PropRow label={copy("project", locale)}>
                <select
                  onChange={(event) =>
                    onUpdateTask(item.id, {
                      projectId: event.target.value || null,
                    })
                  }
                  value={item.projectId || ""}
                >
                  <option value="">—</option>
                  {projects.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title || entry.name}
                    </option>
                  ))}
                </select>
              </PropRow>
              <PropRow label={copy("collaborators", locale)}>
                <MultiAssigneePicker
                  helperText=""
                  label={copy("collaborators", locale)}
                  members={workspaceMembers}
                  onInviteEmail={onInviteAssigneeEmail}
                  onChange={(collaboratorMemberIds, collaborators) =>
                    onUpdateTask(item.id, {
                      collaboratorMemberIds,
                      collaborators,
                    })
                  }
                  selectedIds={
                    Array.isArray(item.collaboratorMemberIds)
                      ? item.collaboratorMemberIds
                      : []
                  }
                  selectedNames={
                    Array.isArray(item.collaborators) ? item.collaborators : []
                  }
                />
              </PropRow>
              <PropRow label={copy("storyPoints", locale)}>
                <input
                  defaultValue={item.storyPoints ?? ""}
                  onBlur={(event) =>
                    onUpdateTask(item.id, {
                      storyPoints: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  type="number"
                />
              </PropRow>
              <PropRow label={copy("logged", locale)}>
                <input
                  defaultValue={item.loggedHours ?? ""}
                  onBlur={(event) =>
                    onUpdateTask(item.id, {
                      loggedHours: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  type="number"
                />
              </PropRow>
              <PropRow label={copy("repeat", locale)}>
                <select
                  onChange={(event) =>
                    onUpdateTask(item.id, {
                      recurrenceType: event.target.value || "none",
                      isRoutineTask: Boolean(
                        event.target.value && event.target.value !== "none",
                      ),
                      recurrenceStatus:
                        event.target.value && event.target.value !== "none"
                          ? "active"
                          : "ended",
                    })
                  }
                  value={item.recurrenceType || "none"}
                >
                  <option value="none">—</option>
                  <option value="daily">Daily</option>
                  <option value="workdays">Workdays</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </PropRow>
            </CollapsibleGroup>

            <CollapsibleGroup
              open={planningOpen}
              onToggle={() => setPlanningOpen((open) => !open)}
              summary={
                actionBoardBucketLabel ||
                GTD_TYPES.find((entry) => entry.value === gtdActionValue(item))
                  ?.label ||
                copy("undefined", locale)
              }
              title={copy("planning", locale)}
              hint={copy("onlyYou", locale)}
            >
              <PropRow label={copy("actionBoard", locale)}>
                <span className="cw-item-readonly">
                  {actionBoardBucketLabel || "—"}
                </span>
              </PropRow>
              <PropRow label={copy("gtd", locale)}>
                <select
                  onChange={(event) =>
                    onUpdateTask(item.id, gtdActionPatch(event.target.value))
                  }
                  value={gtdActionValue(item)}
                >
                  {GTD_TYPES.map((entry) => (
                    <option key={entry.value || "none"} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </PropRow>
            </CollapsibleGroup>

            <section className="cw-item-prop-group">
              <h3>{copy("routines", locale)}</h3>
              <RoutineLaunchButton
                compact
                scope={{
                  entityType: "task",
                  entityId: String(item.id),
                  entityTitle: itemTitle(item),
                }}
                testId="item-routine-button"
              />
            </section>

            <section className="cw-item-prop-group">
              <h3>{copy("activity", locale)}</h3>
              <ul className="cw-item-activity">
                {activityEntries(item).map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.author}</strong> {entry.text}
                    <small>{relativeDateLabel(entry.at, locale)}</small>
                  </li>
                ))}
                {activityEntries(item).length === 0 && (
                  <li className="is-empty">—</li>
                )}
              </ul>
            </section>
          </aside>
        </div>
      </aside>

      <DestructiveDialog
        open={deleteOpen}
        verb={copy("deleteItem", locale)}
        entityName={itemTitle(item)}
        impact={
          deleteImpact || [
            `${checklist.length} checklist item${checklist.length === 1 ? "" : "s"}`,
            `${subtaskItems.length} subtask${subtaskItems.length === 1 ? "" : "s"}`,
            `${comments.length} comment${comments.length === 1 ? "" : "s"} stay on the archive`,
          ]
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await onArchive();
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}

function PropRow({
  label,
  children,
  inherited,
}: {
  label: string;
  children: ReactNode;
  inherited?: boolean;
}) {
  return (
    <div className="cw-item-prop-row">
      <span>
        {label}
        {inherited && <em>{copy("inherited")}</em>}
      </span>
      <div>{children}</div>
    </div>
  );
}

function CollapsibleGroup({
  title,
  hint,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`cw-item-prop-group ${open ? "is-open" : ""}`}>
      <button className="cw-item-prop-toggle" onClick={onToggle} type="button">
        <span>
          <ChevronDown className={open ? "" : "is-collapsed"} size={13} />
          {title}
          {hint && <small>{hint}</small>}
        </span>
        {!open && <em>{summary}</em>}
      </button>
      {open && <div className="cw-item-prop-body">{children}</div>}
    </section>
  );
}

