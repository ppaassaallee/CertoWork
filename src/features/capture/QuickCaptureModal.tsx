import { useEffect, useMemo, useState } from "react";
import { Clipboard, Paperclip, Sparkles, X } from "../../components/ui/Icon";
import { Kbd } from "../../components/ui/Kbd";
import { MediaPicker, type MediaAsset } from "../../components/ui/MediaPicker";
import { getLocale } from "../../lib/i18n";
import { parentLinkPatch } from "../../lib/itemHierarchy";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";
import { memberPublicLabel } from "../../lib/workspaceCollaboration";
import {
  blocksToAcceptanceCriteria,
  clipboardToCaptureDraft,
  compileItemSentence,
  type CaptureBlock,
} from "./compileItemSentence";
import {
  parseCaptureTitle,
  removeTokenFromTitle,
  type CapturePriority,
  type CaptureWorkType,
} from "./parseCaptureTitle";
import "./quickCapture.css";

export type QuickCaptureDefaults = {
  workItemType?: CaptureWorkType;
  projectId?: string | null;
  parentId?: string | null;
};

export type QuickCaptureCreatePayload = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  workItemType: CaptureWorkType;
  projectId: string;
  status: "backlog";
  priority: CapturePriority;
  dueDate: string | null;
  estimateHours: number | null;
  tagIds: string[];
  parent: any | null;
  assignmentPatch: Record<string, unknown>;
  source: "quick_capture";
  /** When clipboard/list mode proposes multiple items */
  bulkNodes?: Array<{ title: string; kind: "pbi" | "subtask"; children: any[] }>;
};

export type QuickCaptureModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: QuickCaptureCreatePayload, options?: { createAnother?: boolean }) => Promise<void> | void;
  projects: any[];
  tasks?: any[];
  members: WorkspaceMember[];
  tags?: Array<{ id: string; name?: string; label?: string }>;
  defaults?: QuickCaptureDefaults;
};

const TYPES: CaptureWorkType[] = ["pbi", "task", "bug", "subtask", "feature", "epic", "story"];

function typeLabel(type: CaptureWorkType, locale: string) {
  const es: Record<CaptureWorkType, string> = {
    pbi: "PBI",
    task: "Tarea",
    bug: "Bug",
    subtask: "Subtarea",
    feature: "Feature",
    epic: "Épica",
    story: "Story",
  };
  const en: Record<CaptureWorkType, string> = {
    pbi: "PBI",
    task: "Task",
    bug: "Bug",
    subtask: "Subtask",
    feature: "Feature",
    epic: "Epic",
    story: "Story",
  };
  return (locale === "es" ? es : en)[type];
}

export function QuickCaptureModal({
  open,
  onClose,
  onCreate,
  projects,
  tasks = [],
  members,
  tags = [],
  defaults = {},
}: QuickCaptureModalProps) {
  const locale = getLocale();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [workItemType, setWorkItemType] = useState<CaptureWorkType>(defaults.workItemType || "task");
  const [projectId, setProjectId] = useState(String(defaults.projectId || ""));
  const [priority, setPriority] = useState<CapturePriority>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [parentId, setParentId] = useState(String(defaults.parentId || ""));
  const [busy, setBusy] = useState(false);
  const [aiGlow, setAiGlow] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [attachments, setAttachments] = useState<MediaAsset[]>([]);
  const [structurePreview, setStructurePreview] = useState<{
    title: string;
    description: string;
    blocks: CaptureBlock[];
  } | null>(null);
  const [listPreview, setListPreview] = useState<ReturnType<typeof clipboardToCaptureDraft> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<
    null | "status" | "priority" | "assignee" | "due" | "tags" | "parent" | "et" | "type" | "project"
  >(null);

  useEffect(() => {
    if (!open) return;
    const seed =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("certo-quick-capture-seed")
        : null;
    if (seed) {
      sessionStorage.removeItem("certo-quick-capture-seed");
      setTitle(seed);
    } else {
      setTitle("");
    }
    setBody("");
    setWorkItemType(defaults.workItemType || (defaults.projectId ? "pbi" : "task"));
    setProjectId(String(defaults.projectId || ""));
    setPriority(null);
    setAssigneeId("");
    setDueDate("");
    setEstimateHours("");
    setTagIds([]);
    setParentId(String(defaults.parentId || ""));
    setStructurePreview(null);
    setListPreview(null);
    setError("");
    setAttachments([]);
    setPicker(null);
  }, [open, defaults.workItemType, defaults.projectId, defaults.parentId]);

  const parsed = useMemo(() => parseCaptureTitle(title, members), [title, members]);

  useEffect(() => {
    if (!open) return;
    if (parsed.workItemType) setWorkItemType(parsed.workItemType);
    if (parsed.priority) setPriority(parsed.priority);
    if (parsed.dueDate) setDueDate(parsed.dueDate);
    if (parsed.assigneeMemberId) setAssigneeId(parsed.assigneeMemberId);
  }, [parsed, open]);

  const parent = tasks.find((task) => String(task.id) === parentId) || null;
  const projectOptions = projects.filter((project) => String(project.status || "") !== "archived");

  const copy = {
    title: locale === "es" ? "Nuevo ítem" : "New item",
    placeholderTitle:
      locale === "es"
        ? "Corregir el timeout #bug @persona mañana !alta"
        : "Fix the timeout #bug @person tomorrow !high",
    placeholderBody:
      locale === "es"
        ? "Descripción, criterios… usá líneas como Objetivo: …"
        : "Description, criteria… use lines like Goal: …",
    create: locale === "es" ? "Crear ítem" : "Create item",
    createAnother: locale === "es" ? "crear y otro" : "create & another",
    structure: locale === "es" ? "Estructurar" : "Structure",
    apply: locale === "es" ? "Aplicar" : "Apply",
    undo: locale === "es" ? "Deshacer" : "Undo",
    clipboard: locale === "es" ? "Portapapeles" : "Clipboard",
  };

  const buildPayload = (): QuickCaptureCreatePayload => {
    const cleanTitle = (structurePreview?.title || parsed.cleanTitle || title).trim();
    const member = members.find((entry) => String(entry.id) === assigneeId);
    const assignmentPatch = member
      ? parsed.assignmentPatch && parsed.assigneeMemberId === assigneeId
        ? parsed.assignmentPatch
        : {
            assigneeIds: [member.id],
            assignees: [memberPublicLabel(member)],
            owner: memberPublicLabel(member),
            assignee: memberPublicLabel(member),
            assigneeId: member.id,
          }
      : {};
    return {
      title: cleanTitle,
      description: structurePreview?.description || body.trim(),
      acceptanceCriteria: structurePreview
        ? blocksToAcceptanceCriteria(structurePreview.blocks)
        : "",
      workItemType,
      projectId,
      status: "backlog",
      priority,
      dueDate: dueDate || null,
      estimateHours: estimateHours ? Number(estimateHours) : null,
      tagIds,
      parent,
      assignmentPatch,
      source: "quick_capture",
      bulkNodes: listPreview?.mode === "list" ? listPreview.nodes : undefined,
    };
  };

  const submit = async (createAnother = false) => {
    const payload = buildPayload();
    if (!payload.title && !(payload.bulkNodes && payload.bulkNodes.length)) {
      setError(locale === "es" ? "Escribí un título." : "Enter a title.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate(payload, { createAnother });
      if (createAnother) {
        setTitle("");
        setBody("");
        setStructurePreview(null);
        setListPreview(null);
      } else {
        onClose();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const runStructure = () => {
    setAiGlow(true);
    const result = compileItemSentence({
      title: parsed.cleanTitle || title,
      body,
    });
    setStructurePreview(result);
    setTitle(result.title);
    setBody(result.description);
    window.setTimeout(() => setAiGlow(false), 700);
  };

  const runClipboard = async () => {
    setAiGlow(true);
    try {
      const text = await navigator.clipboard.readText();
      const draft = clipboardToCaptureDraft(text);
      setListPreview(draft.mode === "list" ? draft : null);
      setTitle(draft.title);
      setBody(draft.mode === "list" ? "" : draft.body);
      if (draft.mode === "single" && draft.body) {
        setStructurePreview(compileItemSentence({ title: draft.title, body: draft.body }));
      }
    } catch {
      setError(
        locale === "es"
          ? "No pude leer el portapapeles."
          : "Could not read the clipboard.",
      );
    } finally {
      window.setTimeout(() => setAiGlow(false), 700);
    }
  };

  if (!open) return null;

  return (
    <div className="cw-qc-backdrop" data-testid="quick-capture-modal">
      <div
        aria-modal="true"
        className={`cw-qc-modal ${aiGlow ? "cw-ai-glow" : ""}`}
        role="dialog"
      >
        <header className="cw-qc-head">
          <div className="cw-qc-head-left">
            <strong>{copy.title}</strong>
            <button className="cw-qc-chip is-set" onClick={() => setPicker(picker === "type" ? null : "type")} type="button">
              {typeLabel(workItemType, locale)} ▾
            </button>
            <button
              className={`cw-qc-chip ${projectId ? "is-set" : ""}`}
              onClick={() => setPicker(picker === "project" ? null : "project")}
              type="button"
            >
              {projectId
                ? String(
                    projectOptions.find((project) => project.id === projectId)?.title ||
                      projectOptions.find((project) => project.id === projectId)?.name ||
                      "Project",
                  )
                : locale === "es"
                  ? "Proyecto"
                  : "Project"}{" "}
              ▾
            </button>
          </div>
          <button aria-label="Close" className="cw-qc-icon" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        {picker === "type" && (
          <div className="cw-qc-menu">
            {TYPES.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setWorkItemType(type);
                  setPicker(null);
                }}
                type="button"
              >
                {typeLabel(type, locale)}
              </button>
            ))}
          </div>
        )}
        {picker === "project" && (
          <div className="cw-qc-menu">
            <button
              onClick={() => {
                setProjectId("");
                setPicker(null);
              }}
              type="button"
            >
              {locale === "es" ? "Sin proyecto" : "No project"}
            </button>
            {projectOptions.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setProjectId(String(project.id));
                  setPicker(null);
                }}
                type="button"
              >
                {project.title || project.name}
              </button>
            ))}
          </div>
        )}

        <div className="cw-qc-title-row">
          <input
            autoFocus
            className="cw-qc-title"
            data-testid="quick-capture-title"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void submit(event.shiftKey);
              }
            }}
            placeholder={copy.placeholderTitle}
            value={title}
          />
          {parsed.tokens.length > 0 && (
            <div className="cw-qc-inline-tokens">
              {parsed.tokens.map((token) => (
                <button
                  className={`cw-semantic-chip is-${token.kind}`}
                  key={`${token.kind}-${token.raw}`}
                  onClick={() => setTitle(removeTokenFromTitle(title, token.raw))}
                  title={locale === "es" ? "Quitar" : "Remove"}
                  type="button"
                >
                  {token.kind === "type"
                    ? `#${token.value}`
                    : token.kind === "person"
                      ? `@${token.value}`
                      : token.kind === "priority"
                        ? token.label
                        : token.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          className="cw-qc-body"
          data-testid="quick-capture-body"
          onChange={(event) => setBody(event.target.value)}
          placeholder={copy.placeholderBody}
          rows={6}
          value={body}
        />

        {structurePreview && (
          <div className="cw-qc-preview" data-testid="quick-capture-structure-preview">
            <div className="cw-qc-preview-head">
              <span>✦ {copy.structure}</span>
              <div>
                <button
                  onClick={() => {
                    setStructurePreview(null);
                  }}
                  type="button"
                >
                  {copy.undo}
                </button>
              </div>
            </div>
            <ul>
              {structurePreview.blocks.map((block) => (
                <li key={`${block.type}-${block.text.slice(0, 12)}`}>
                  <em>{block.type}</em> {block.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {listPreview?.mode === "list" && (
          <div className="cw-qc-preview" data-testid="quick-capture-list-preview">
            <div className="cw-qc-preview-head">
              <span>
                {locale === "es" ? "Lista detectada" : "List detected"} ·{" "}
                {listPreview.nodes.length}{" "}
                {locale === "es" ? "raíces" : "roots"}
              </span>
              <button onClick={() => setListPreview(null)} type="button">
                {copy.undo}
              </button>
            </div>
            <ul>
              {listPreview.nodes.slice(0, 12).map((node) => (
                <li key={node.title}>
                  {node.title}
                  {node.children.length ? ` (+${node.children.length})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="cw-qc-props">
          <button className="cw-qc-chip is-set" type="button">
            Backlog
          </button>
          <button
            className={`cw-qc-chip ${priority ? "is-set" : ""}`}
            onClick={() => setPicker(picker === "priority" ? null : "priority")}
            type="button"
          >
            {priority ? `P${priority}` : locale === "es" ? "Prioridad" : "Priority"}
          </button>
          <button
            className={`cw-qc-chip ${assigneeId ? "is-set" : ""}`}
            onClick={() => setPicker(picker === "assignee" ? null : "assignee")}
            type="button"
          >
            {assigneeId
              ? memberPublicLabel(members.find((m) => m.id === assigneeId) || {})
              : locale === "es"
                ? "Asignado"
                : "Assignee"}
          </button>
          <button
            className={`cw-qc-chip ${dueDate ? "is-set" : ""}`}
            onClick={() => setPicker(picker === "due" ? null : "due")}
            type="button"
          >
            {dueDate || (locale === "es" ? "Fecha" : "Due")}
          </button>
          <button
            className={`cw-qc-chip ${tagIds.length ? "is-set" : ""}`}
            onClick={() => setPicker(picker === "tags" ? null : "tags")}
            type="button"
          >
            {tagIds.length
              ? `${tagIds.length} ${locale === "es" ? "etiquetas" : "tags"}`
              : locale === "es"
                ? "Etiquetas"
                : "Labels"}
          </button>
          <button
            className={`cw-qc-chip ${parentId ? "is-set" : ""}`}
            onClick={() => setPicker(picker === "parent" ? null : "parent")}
            type="button"
          >
            {parent
              ? String(parent.title || parent.name)
              : locale === "es"
                ? "Padre"
                : "Parent"}
          </button>
          <button
            className={`cw-qc-chip ${estimateHours ? "is-set" : ""}`}
            onClick={() => setPicker(picker === "et" ? null : "et")}
            type="button"
          >
            {estimateHours ? `${estimateHours} h` : "ET"}
          </button>
        </div>

        {picker === "priority" && (
          <div className="cw-qc-menu">
            {[
              [null, "—"],
              ["1", "P1"],
              ["2", "P2"],
              ["3", "P3"],
            ].map(([value, label]) => (
              <button
                key={String(label)}
                onClick={() => {
                  setPriority(value as CapturePriority);
                  setPicker(null);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {picker === "assignee" && (
          <div className="cw-qc-menu">
            <button
              onClick={() => {
                setAssigneeId("");
                setPicker(null);
              }}
              type="button"
            >
              —
            </button>
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  setAssigneeId(String(member.id));
                  setPicker(null);
                }}
                type="button"
              >
                {memberPublicLabel(member)}
              </button>
            ))}
          </div>
        )}
        {picker === "due" && (
          <div className="cw-qc-menu is-form">
            <input
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
            <button onClick={() => setPicker(null)} type="button">
              OK
            </button>
          </div>
        )}
        {picker === "et" && (
          <div className="cw-qc-menu is-form">
            <input
              inputMode="decimal"
              onChange={(event) => setEstimateHours(event.target.value)}
              placeholder="4"
              value={estimateHours}
            />
            <button onClick={() => setPicker(null)} type="button">
              OK
            </button>
          </div>
        )}
        {picker === "tags" && (
          <div className="cw-qc-menu">
            {tags.map((tag) => {
              const id = String(tag.id);
              const active = tagIds.includes(id);
              return (
                <button
                  key={id}
                  onClick={() =>
                    setTagIds((current) =>
                      active ? current.filter((entry) => entry !== id) : [...current, id],
                    )
                  }
                  type="button"
                >
                  {active ? "✓ " : ""}
                  {tag.name || tag.label || id}
                </button>
              );
            })}
            {!tags.length && <span className="cw-qc-empty">—</span>}
          </div>
        )}
        {picker === "parent" && (
          <div className="cw-qc-menu">
            <button
              onClick={() => {
                setParentId("");
                setPicker(null);
              }}
              type="button"
            >
              —
            </button>
            {tasks
              .filter((task) => !projectId || String(task.projectId) === projectId)
              .slice(0, 40)
              .map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    setParentId(String(task.id));
                    setPicker(null);
                  }}
                  type="button"
                >
                  {task.title || task.name}
                </button>
              ))}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="cw-qc-attachments">
            {attachments.map((asset) => (
              <span key={asset.id}>{asset.name}</span>
            ))}
          </div>
        )}

        {error && <p className="cw-qc-error">{error}</p>}

        <footer className="cw-qc-foot">
          <button
            className="cw-btn cw-btn-primary"
            data-testid="quick-capture-submit"
            disabled={busy}
            onClick={() => void submit(false)}
            type="button"
          >
            {copy.create} <Kbd>⌘↵</Kbd>
          </button>
          <button
            className="cw-qc-secondary"
            disabled={busy}
            onClick={() => void submit(true)}
            type="button"
          >
            <Kbd>⇧⌘↵</Kbd> {copy.createAnother}
          </button>
          <div className="cw-qc-foot-icons">
            <button
              aria-label="Attach"
              onClick={() => setMediaOpen(true)}
              type="button"
            >
              <Paperclip size={16} />
            </button>
            <button
              aria-label={copy.structure}
              className="cw-qc-ai"
              onClick={runStructure}
              type="button"
            >
              <Sparkles size={16} />
            </button>
            <button aria-label={copy.clipboard} onClick={() => void runClipboard()} type="button">
              <Clipboard size={16} />
            </button>
          </div>
        </footer>
      </div>

      <MediaPicker
        onAdd={({ files, selected }) => {
          const uploaded = files.map((file, index) => ({
            id: `local-${Date.now()}-${index}`,
            name: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }));
          setAttachments((current) => [...current, ...uploaded, ...selected]);
          setMediaOpen(false);
        }}
        onClose={() => setMediaOpen(false)}
        open={mediaOpen}
      />
    </div>
  );
}

/** Re-export for callers that need parent patch when creating. */
export { parentLinkPatch };
